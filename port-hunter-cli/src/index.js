#!/usr/bin/env node

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Table from 'cli-table3';
import blessed from 'blessed';
import chalk from 'chalk';

const execFileAsync = promisify(execFile);
const EXEC_TIMEOUT_MS = 15000;
const argv = process.argv.slice(2);

function runCommand(command, args, timeout = EXEC_TIMEOUT_MS) {
  return execFileAsync(command, args, {
    timeout,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
  });
}

function formatMemory(rssKB) {
  if (rssKB > 1048576) return `${(rssKB / 1048576).toFixed(1)}G`;
  if (rssKB > 1024) return `${(rssKB / 1024).toFixed(1)}M`;
  return `${rssKB}K`;
}

/** ps etime varies (MM:SS vs DD-HH:MM:SS); fixed-width + right-align for column alignment. */
const UPTIME_COL_WIDTH = 12;
const MEMORY_COL_WIDTH = 8;
/** "100.0%" etc.; right-aligned */
const CPU_COL_WIDTH = 6;
const STATUS_COL_WIDTH = 3;

function formatUptimeDisplay(raw) {
  const s = String(raw || '').trim();
  if (!s || s === '-') return '-'.padStart(UPTIME_COL_WIDTH);
  const cut = s.length > UPTIME_COL_WIDTH ? `${s.slice(0, UPTIME_COL_WIDTH - 1)}…` : s;
  return cut.padStart(UPTIME_COL_WIDTH);
}

function formatMemoryDisplay(memStr) {
  const s = String(memStr || '').trim();
  if (!s || s === '-') return '-'.padStart(MEMORY_COL_WIDTH);
  const cut = s.length > MEMORY_COL_WIDTH ? `${s.slice(0, MEMORY_COL_WIDTH - 1)}…` : s;
  return cut.padStart(MEMORY_COL_WIDTH);
}

/** %cpu from ps (darwin); one decimal, right-aligned. */
function formatCpuDisplay(pct) {
  if (pct == null || !Number.isFinite(pct)) return '-'.padStart(CPU_COL_WIDTH);
  const s = `${pct.toFixed(1)}%`;
  if (s.length > CPU_COL_WIDTH) return s.slice(0, CPU_COL_WIDTH);
  return s.padStart(CPU_COL_WIDTH);
}

function statusSymbol(status) {
  switch (String(status || '').toLowerCase()) {
    case 'zombie':
      return 'Z';
    case 'orphaned':
      return '○';
    case 'healthy':
      return '●';
    default:
      return '?';
  }
}

function findProjectRoot(dir) {
  const markers = ['package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml', 'Gemfile'];
  let current = dir;
  let depth = 0;
  while (current !== '/' && current !== path.dirname(current) && depth < 15) {
    for (const marker of markers) {
      if (fs.existsSync(path.join(current, marker))) return current;
    }
    current = path.dirname(current);
    depth += 1;
  }
  return dir;
}

function detectFramework(projectRoot, command = '', processName = '') {
  const cmd = String(command || '').toLowerCase();
  if (cmd.includes('next')) return 'Next.js';
  if (cmd.includes('vite')) return 'Vite';
  if (cmd.includes('nuxt')) return 'Nuxt';
  if (cmd.includes('webpack')) return 'Webpack';
  if (cmd.includes('flask')) return 'Flask';
  if (cmd.includes('django')) return 'Django';
  if (cmd.includes('rails')) return 'Rails';
  const pkgPath = path.join(projectRoot || '', 'package.json');
  if (projectRoot && fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.next) return 'Next.js';
      if (deps.vite) return 'Vite';
      if (deps.nuxt || deps.nuxt3) return 'Nuxt';
      if (deps.react) return 'React';
      if (deps.vue) return 'Vue';
      if (deps.express) return 'Express';
    } catch {
      // Ignore parse errors.
    }
  }
  const lowerName = String(processName || '').toLowerCase();
  if (lowerName === 'node') return 'Node.js';
  if (lowerName.startsWith('python')) return 'Python';
  if (lowerName === 'java') return 'Java';
  return '-';
}

async function listPortsUnixRaw() {
  const platform = os.platform();
  const portMap = new Map();
  if (platform !== 'darwin') {
    try {
      const { stdout } = await runCommand('ss', ['-tlnp']);
      for (const line of stdout.split('\n').slice(1)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 4) continue;
        const localAddr = parts[3];
        const portMatch = localAddr.match(/:(\d+)$/);
        if (!portMatch) continue;
        const port = parseInt(portMatch[1], 10);
        if (portMap.has(port)) continue;
        const pidMatch = line.match(/pid=(\d+)/);
        const procMatch = line.match(/users:\(\("([^"]+)"/);
        if (port > 0) {
          portMap.set(port, {
            port,
            pid: pidMatch ? parseInt(pidMatch[1], 10) : 0,
            process: procMatch ? procMatch[1] : '',
            protocol: 'tcp',
          });
        }
      }
      if (portMap.size > 0) return [...portMap.values()];
    } catch {
      // Fallback to lsof.
    }
  }
  const { stdout } = await runCommand('lsof', ['-iTCP', '-sTCP:LISTEN', '-n', '-P']);
  for (const line of stdout.split('\n').slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;
    const processName = parts[0];
    const pid = parseInt(parts[1], 10);
    const addrPort = parts[8];
    const portMatch = addrPort.match(/:(\d+)$/);
    if (!portMatch) continue;
    const port = parseInt(portMatch[1], 10);
    if (port > 0 && !portMap.has(port)) {
      portMap.set(port, { port, pid, process: processName, protocol: 'tcp' });
    }
  }
  return [...portMap.values()];
}

async function listPortsWindowsRaw() {
  const portMap = new Map();
  const { stdout } = await runCommand('netstat', ['-ano']);
  for (const line of stdout.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] !== 'TCP' || parts[3] !== 'LISTENING') continue;
    const portMatch = parts[1].match(/:(\d+)$/);
    if (!portMatch) continue;
    const port = parseInt(portMatch[1], 10);
    const pid = parseInt(parts[4], 10);
    if (port > 0 && !portMap.has(port)) {
      portMap.set(port, { port, pid, process: 'unknown', protocol: 'tcp' });
    }
  }
  return [...portMap.values()];
}

/** pid ppid stat rss %cpu etime command */
const PS_LINE = /^(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s+([\d.]+)\s+(\S+)\s+(.*)$/;

async function batchProcessInfoDarwin(pids) {
  const map = new Map();
  if (pids.length === 0) return map;
  const { stdout } = await runCommand(
    'ps',
    ['-ww', '-p', pids.join(','), '-o', 'pid=,ppid=,stat=,rss=,%cpu=,etime=,command='],
    10000,
  );
  for (const line of stdout.trim().split('\n')) {
    const m = line.trim().match(PS_LINE);
    if (!m) continue;
    map.set(parseInt(m[1], 10), {
      ppid: parseInt(m[2], 10),
      stat: m[3],
      rss: parseInt(m[4], 10),
      cpuPct: (() => {
        const x = parseFloat(m[5]);
        return Number.isFinite(x) ? x : undefined;
      })(),
      etime: m[6],
      command: m[7],
    });
  }
  return map;
}

async function batchCwdDarwin(pids) {
  const map = new Map();
  if (pids.length === 0) return map;
  try {
    const { stdout } = await runCommand('lsof', ['-a', '-d', 'cwd', '-p', pids.join(',')], 10000);
    for (const line of stdout.trim().split('\n').slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) continue;
      const pid = parseInt(parts[1], 10);
      const cwdPath = parts.slice(8).join(' ');
      if (cwdPath && cwdPath.startsWith('/')) map.set(pid, cwdPath);
    }
  } catch {
    // Best effort.
  }
  return map;
}

async function enrichRows(rawRows) {
  const pids = [...new Set(rawRows.map((r) => r.pid).filter((p) => p > 0))];
  let psMap = new Map();
  let cwdMap = new Map();
  if (os.platform() === 'darwin') {
    psMap = await batchProcessInfoDarwin(pids);
    cwdMap = await batchCwdDarwin(pids);
  }

  return rawRows.map((row) => {
    const ps = psMap.get(row.pid);
    const cwdRaw = cwdMap.get(row.pid);
    const command = ps?.command || '';
    const root = cwdRaw ? findProjectRoot(cwdRaw) : '';
    const project = root ? path.basename(root) : '-';
    const status = ps?.stat?.includes('Z') ? 'zombie' : 'healthy';
    return {
      ...row,
      command,
      cwd: root || '-',
      project,
      framework: detectFramework(root, command, row.process),
      uptime: ps?.etime || '-',
      memory: ps?.rss ? formatMemory(ps.rss) : '-',
      cpu: ps?.cpuPct,
      status,
    };
  });
}

async function listPortsDetailed() {
  const raw = os.platform() === 'win32' ? await listPortsWindowsRaw() : await listPortsUnixRaw();
  const rows = await enrichRows(raw);
  return rows.sort((a, b) => a.port - b.port);
}

async function killPid(pid, force) {
  if (pid === process.pid) throw new Error(`Refusing to kill current process ${pid}`);
  if (os.platform() === 'win32') {
    await runCommand('taskkill', force ? ['/F', '/PID', String(pid)] : ['/PID', String(pid)]);
    return;
  }
  process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
}

/** Blessed treats `{` / `}` as inline tags; strip to avoid parseContent blowing the stack. */
function blessedPlain(text) {
  return String(text).replace(/\{/g, '\uFF5B').replace(/\}/g, '\uFF5D');
}

/** Word-wrap for modal body; breaks at spaces, hard-breaks long tokens. */
function wrapLines(text, maxLen) {
  const max = Math.max(8, maxLen);
  const out = [];
  for (const para of String(text).replace(/\r\n/g, '\n').split('\n')) {
    let rest = para.trim();
    if (!rest) continue;
    while (rest.length > max) {
      const breakAt = rest.lastIndexOf(' ', max);
      if (breakAt > 0) {
        out.push(rest.slice(0, breakAt).trimEnd());
        rest = rest.slice(breakAt).trimStart();
      } else {
        out.push(rest.slice(0, max));
        rest = rest.slice(max);
      }
    }
    if (rest) out.push(rest);
  }
  return out;
}

/**
 * blessed uses its own EventEmitter (no `prependListener`). Run `listener` before existing ones.
 */
function prependBlessedListener(emitter, type, listener) {
  if (typeof emitter.prependListener === 'function') {
    emitter.prependListener(type, listener);
    return;
  }
  if (!emitter._events) emitter._events = {};
  const existing = emitter._events[type];
  if (!existing) {
    emitter.on(type, listener);
    return;
  }
  if (typeof existing === 'function') {
    emitter._events[type] = [listener, existing];
  } else {
    existing.unshift(listener);
  }
  if (typeof emitter._emit === 'function') {
    emitter._emit('newListener', [type, listener]);
  }
}

/** Fixed-width columns before Command (single spaces between fields). Kept in sync with formatRowLine. */
const ROW_PREFIX_CHARS =
  5 +
  1 +
  7 +
  1 +
  14 +
  1 +
  14 +
  1 +
  10 +
  1 +
  UPTIME_COL_WIDTH +
  1 +
  MEMORY_COL_WIDTH +
  1 +
  CPU_COL_WIDTH +
  1 +
  STATUS_COL_WIDTH +
  1;

function truncateCmd(text, maxLen) {
  const s = String(text);
  if (s.length <= maxLen) return s;
  if (maxLen <= 3) return s.slice(0, maxLen);
  return `${s.slice(0, maxLen - 1)}…`;
}

/**
 * Single Command column: exe first, then args; when truncated, keep exe prefix and args tail.
 */
function formatCommandCell(cmd, maxLen) {
  const s = String(cmd || '').trim() || '-';
  if (s === '-') return '-';
  const m = s.match(/^(\S+)\s+(.*)$/);
  const tail = m && m[2].trim() ? m[2].trim() : '';
  if (!tail) return truncateCmd(s, maxLen);
  const head = m[1];
  const full = `${head} ${tail}`;
  if (full.length <= maxLen) return full;
  const headBudget = Math.min(head.length, Math.max(8, Math.floor(maxLen * 0.4)));
  const headPart =
    head.length <= headBudget ? head : `${head.slice(0, Math.max(1, headBudget - 1))}…`;
  const tb = maxLen - headPart.length - 1;
  if (tb < 4) return truncateCmd(full, maxLen);
  const tailPart =
    tail.length <= tb ? tail : `…${tail.slice(-(Math.max(1, tb - 1)))}`;
  return `${headPart} ${tailPart}`;
}

function commandMaxForWidth(innerCols) {
  return Math.max(24, Math.min(2048, innerCols - ROW_PREFIX_CHARS));
}

function fuzzySubsequenceMatch(needle, haystack) {
  const n = String(needle || '').toLowerCase();
  const h = String(haystack || '').toLowerCase();
  if (!n) return true;
  let j = 0;
  for (let i = 0; i < h.length && j < n.length; i += 1) {
    if (h[i] === n[j]) j += 1;
  }
  return j === n.length;
}

function fuzzyMatchQuery(query, row) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const hay = [
    row.port,
    row.pid,
    row.process,
    row.project,
    row.framework,
    row.uptime,
    row.memory,
    row.cpu,
    row.status,
    row.command,
  ]
    .map((x) => String(x || ''))
    .join(' ')
    .toLowerCase();

  // All tokens must match: either substring or subsequence (for quick fuzzy typing).
  return tokens.every((t) => hay.includes(t) || fuzzySubsequenceMatch(t, hay));
}

function formatRowLine(row, commandMaxChars) {
  const rawCmd = row.command || '-';
  const command = blessedPlain(formatCommandCell(rawCmd, commandMaxChars));
  const processName = blessedPlain((row.process || '-').slice(0, 14));
  const project = blessedPlain((row.project || '-').slice(0, 14));
  const framework = blessedPlain((row.framework || '-').slice(0, 10));
  const uptimeCell = formatUptimeDisplay(row.uptime);
  const memCell = formatMemoryDisplay(row.memory);
  const cpuCell = formatCpuDisplay(row.cpu);
  const statusCell = blessedPlain(statusSymbol(row.status)).padEnd(STATUS_COL_WIDTH);
  return `${String(row.port).padEnd(5)} ${String(row.pid).padEnd(7)} ${processName.padEnd(14)} ${project.padEnd(14)} ${framework.padEnd(10)} ${uptimeCell} ${memCell} ${cpuCell} ${statusCell} ${command}`;
}

function tableHeaderLine(commandMaxChars) {
  const cmdLabel = 'Command'.padEnd(Math.max(7, commandMaxChars));
  const upHead = 'Uptime'.padStart(UPTIME_COL_WIDTH);
  const memHead = 'Memory'.padStart(MEMORY_COL_WIDTH);
  const cpuHead = 'CPU'.padStart(CPU_COL_WIDTH);
  const stHead = 'St'.padEnd(STATUS_COL_WIDTH);
  return `${'Port'.padEnd(5)} ${'PID'.padEnd(7)} ${'Process'.padEnd(14)} ${'Project'.padEnd(14)} ${'Framework'.padEnd(10)} ${upHead} ${memHead} ${cpuHead} ${stHead} ${cmdLabel}`;
}

function printTableOnce(rows) {
  const cols = process.stdout.columns || 120;
  const cmdMax = commandMaxForWidth(cols);
  const table = new Table({
    head: [
      chalk.cyan('Port'),
      chalk.cyan('PID'),
      chalk.cyan('Process'),
      chalk.cyan('Project'),
      chalk.cyan('Framework'),
      chalk.cyan('Uptime'),
      chalk.cyan('Memory'),
      chalk.cyan('CPU'),
      chalk.cyan('St'),
      chalk.cyan('Command'),
    ],
    style: { head: [], border: [] },
    wordWrap: true,
  });
  for (const row of rows) {
    table.push([
      row.port,
      row.pid || '-',
      row.process || '-',
      row.project || '-',
      row.framework || '-',
      formatUptimeDisplay(row.uptime),
      formatMemoryDisplay(row.memory),
      formatCpuDisplay(row.cpu),
      statusSymbol(row.status),
      formatCommandCell(row.command || '-', cmdMax),
    ]);
  }
  console.log(table.toString());
}

async function runInteractiveTui() {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Port Hunter CLI',
    fullUnicode: true,
    /** Dark canvas so fg colors stay readable on light-terminal profiles too */
    style: { bg: 'black' },
  });

  const title = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: 1,
    content:
      ' Port Hunter CLI | Click row: kill (2× confirm) | Enter: same | Arrows: move | r: refresh | q: quit | /: filter… | Esc: clear filter ',
    style: { fg: 'white', bg: 'blue', bold: true },
  });

  const info = blessed.box({
    parent: screen,
    top: 1,
    left: 0,
    width: '100%',
    height: 1,
    content: ' Loading...',
    style: { fg: 'cyan', bg: 'black' },
  });

  const list = blessed.list({
    parent: screen,
    top: 2,
    left: 0,
    width: '100%',
    height: '100%-5',
    keys: true,
    mouse: true,
    vi: true,
    tags: false,
    border: 'line',
    style: {
      fg: 'lightgray',
      bg: 'black',
      selected: { bg: 'blue', fg: 'white', bold: true },
      item: { fg: 'lightgray', bg: 'black' },
      border: { fg: 'cyan' },
    },
    scrollbar: { ch: '│', inverse: true },
  });

  const status = blessed.box({
    parent: screen,
    bottom: 1,
    left: 0,
    width: '100%',
    height: 1,
    content: ' Ready',
    style: { fg: 'green', bg: 'black' },
  });

  const siteFooter = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    align: 'center',
    valign: 'middle',
    content: ' https://rebebuca.com ',
    tags: false,
    style: { fg: 'gray', bg: 'black' },
  });

  const btnRefresh = blessed.button({
    parent: screen,
    bottom: 1,
    right: 8,
    mouse: true,
    keys: true,
    shrink: true,
    padding: { left: 1, right: 1 },
    content: 'Refresh',
    style: {
      fg: 'white',
      bg: 'blue',
      focus: { bg: 'cyan', fg: 'black' },
      hover: { bg: 'cyan', fg: 'black' },
    },
  });
  const btnQuit = blessed.button({
    parent: screen,
    bottom: 1,
    right: 0,
    mouse: true,
    keys: true,
    shrink: true,
    padding: { left: 1, right: 1 },
    content: 'Quit',
    style: {
      fg: 'white',
      bg: 'gray',
      focus: { bg: 'lightgray', fg: 'black' },
      hover: { bg: 'lightgray', fg: 'black' },
    },
  });

  let rows = [];
  /** Current view after filter is applied. */
  let visibleRows = [];
  /** When true, ignore `select item` from blessed (setItems/select re-emit synchronously). */
  let ignoreSelectItem = false;
  /** After arrow / wheel navigation, `select()` emits `select item` — do not start kill flow. */
  let skipToggleOnNextSelectItem = false;
  let filterQuery = '';
  let killDialogOpen = false;
  let filterModalOpen = false;

  async function openFilterModal() {
    if (filterModalOpen || killDialogOpen) return;
    filterModalOpen = true;
    const initialQuery = filterQuery;

    await new Promise((resolve) => {
      const w = Math.min(Math.max(screen.width - 4, 42), 82);
      let finished = false;

      const modal = blessed.box({
        parent: screen,
        top: 'center',
        left: 'center',
        width: w,
        height: 13,
        border: 'line',
        mouse: true,
        keys: true,
        tags: false,
        label: ' Filter ',
        style: {
          fg: 'white',
          bg: 'blue',
          border: { fg: 'cyan' },
        },
      });

      blessed.box({
        parent: modal,
        top: 1,
        left: 1,
        right: 1,
        height: 2,
        content:
          ' Fuzzy filter (space-separated tokens).\n Enter · Apply   Esc · Cancel   Ctrl-U · clear field   Tab · buttons',
        style: { fg: 'lightgray', bg: 'blue' },
      });

      const input = blessed.textbox({
        parent: modal,
        top: 4,
        left: 1,
        right: 1,
        height: 1,
        inputOnFocus: false,
        mouse: true,
        keys: true,
        value: initialQuery,
        style: {
          fg: 'white',
          bg: 'black',
          focus: { bg: 'gray', fg: 'black' },
        },
      });

      const btnApply = blessed.button({
        parent: modal,
        bottom: 1,
        left: 2,
        width: 14,
        height: 1,
        mouse: true,
        keys: true,
        content: ' Apply (↵) ',
        style: {
          fg: 'black',
          bg: 'yellow',
          bold: true,
          focus: { bg: 'green', fg: 'white' },
          hover: { bg: 'green', fg: 'white' },
        },
      });

      const btnClear = blessed.button({
        parent: modal,
        bottom: 1,
        left: 18,
        width: 14,
        height: 1,
        mouse: true,
        keys: true,
        content: ' Clear all ',
        style: {
          fg: 'white',
          bg: 'red',
          focus: { bg: 'magenta', fg: 'white' },
          hover: { bg: 'magenta', fg: 'white' },
        },
      });

      const btnCancel = blessed.button({
        parent: modal,
        bottom: 1,
        right: 2,
        width: 14,
        height: 1,
        mouse: true,
        keys: true,
        content: ' Cancel (Esc) ',
        style: {
          fg: 'white',
          bg: 'gray',
          focus: { bg: 'lightgray', fg: 'black' },
          hover: { bg: 'lightgray', fg: 'black' },
        },
      });

      function teardown() {
        input.removeListener('focus', onInputFocus);
        input.removeListener('keypress', onInputKeyFirst);
        btnApply.removeListener('press', onApplyPress);
        btnClear.removeListener('press', onClearPress);
        btnCancel.removeListener('press', onCancelPress);
        modal.removeListener('keypress', onModalKeypress);
        modal.detach();
        screen.restoreFocus();
        screen.render();
      }

      function done() {
        if (finished) return;
        finished = true;
        teardown();
        filterModalOpen = false;
        resolve();
      }

      function applyFilter() {
        const q = String(input.getValue() || '').trim();
        setFilterQuery(q);
        done();
        list.focus();
      }

      function clearFilterAndClose() {
        setFilterQuery('');
        done();
        list.focus();
      }

      function cancelModal() {
        done();
        list.focus();
      }

      function onApplyPress() {
        applyFilter();
      }
      function onClearPress() {
        clearFilterAndClose();
      }
      function onCancelPress() {
        cancelModal();
      }

      function onModalKeypress(ch, key) {
        if (key.name === 'escape') cancelModal();
      }

      function onInputFocus() {
        input.readInput(() => {});
      }

      function onInputKeyFirst(ch, key) {
        if (key.ctrl && key.name === 'c') process.exit(0);
        if (key.full === 'enter') {
          queueMicrotask(() => applyFilter());
        }
        if (key.full === 'C-u') {
          input.setValue('');
          screen.render();
        }
      }

      prependBlessedListener(input, 'keypress', onInputKeyFirst);

      btnApply.on('press', onApplyPress);
      btnClear.on('press', onClearPress);
      btnCancel.on('press', onCancelPress);
      modal.on('keypress', onModalKeypress);
      input.on('focus', onInputFocus);

      screen.saveFocus();
      modal.setFront();
      input.focus();
      screen.render();
    });
  }

  /**
   * blessed.question's Cancel often misses mouse hits (list steals clicks). Custom modal + setFront().
   */
  function confirmModal(message, opts = {}) {
    const detail = opts.detail != null ? String(opts.detail) : '';
    return new Promise((resolve) => {
      const w = Math.min(Math.max(screen.width - 4, 36), 78);
      const innerW = Math.max(24, w - 6);
      const MAX_CMD_LINES = 28;
      const msgLines = wrapLines(blessedPlain(message), innerW);
      let cmdLines = detail
        ? wrapLines(`Command: ${blessedPlain(detail)}`, innerW)
        : [];
      if (cmdLines.length > MAX_CMD_LINES) {
        cmdLines = [...cmdLines.slice(0, MAX_CMD_LINES), ' ... (truncated)'];
      }
      const bodyLines = [
        '',
        ...msgLines.map((l) => ` ${l}`),
        ...(cmdLines.length ? ['', ...cmdLines.map((l) => ` ${l}`)] : []),
        '',
        ' Y / Enter = OK    N / Esc = Cancel',
      ];
      const content = bodyLines.join('\n');
      const modalHeight = Math.min(
        Math.max(screen.height - 4, 14),
        Math.max(12, bodyLines.length + 6),
      );

      const modal = blessed.box({
        parent: screen,
        top: 'center',
        left: 'center',
        width: w,
        height: modalHeight,
        border: 'line',
        mouse: true,
        keys: true,
        tags: false,
        label: ' Confirm ',
        content,
        style: {
          fg: 'white',
          bg: 'blue',
          border: { fg: 'cyan' },
        },
      });

      const btnOk = blessed.button({
        parent: modal,
        bottom: 1,
        left: 3,
        width: 16,
        height: 1,
        mouse: true,
        keys: true,
        content: ' OK (Y) ',
        style: {
          fg: 'black',
          bg: 'yellow',
          bold: true,
          focus: { bg: 'green', fg: 'white' },
          hover: { bg: 'green', fg: 'white' },
        },
      });

      const btnCancel = blessed.button({
        parent: modal,
        bottom: 1,
        right: 3,
        width: 16,
        height: 1,
        mouse: true,
        keys: true,
        content: ' Cancel (N) ',
        style: {
          fg: 'white',
          bg: 'gray',
          focus: { bg: 'lightgray', fg: 'black' },
          hover: { bg: 'lightgray', fg: 'black' },
        },
      });

      let finished = false;
      function done(ok) {
        if (finished) return;
        finished = true;
        btnOk.removeListener('press', onOk);
        btnCancel.removeListener('press', onCancel);
        modal.removeListener('keypress', onModalKey);
        screen.removeListener('keypress', onConfirmScreenKey);
        modal.detach();
        screen.restoreFocus();
        screen.render();
        resolve(ok);
      }

      function onOk() {
        done(true);
      }
      function onCancel() {
        done(false);
      }

      function onModalKey(ch, key) {
        if (key.name === 'escape') done(false);
        else if (key.name === 'enter') done(true);
        else if (key.name === 'y') done(true);
        else if (key.name === 'n') done(false);
      }

      /** So Y/N work even when focus is on a button (child eats keys before modal). */
      function onConfirmScreenKey(ch, key) {
        if (finished || key.name === 'mouse') return;
        if (key.name === 'y') onOk();
        else if (key.name === 'n') onCancel();
      }

      btnOk.on('press', onOk);
      btnCancel.on('press', onCancel);
      modal.on('keypress', onModalKey);
      prependBlessedListener(screen, 'keypress', onConfirmScreenKey);

      screen.saveFocus();
      modal.setFront();
      btnCancel.focus();
      screen.render();
    });
  }

  function helpAsk(text, modalOpts) {
    return confirmModal(text, modalOpts || {});
  }

  async function offerKillCurrentRow() {
    if (ignoreSelectItem || killDialogOpen || filterModalOpen) return;
    const idx = list.selected;
    if (idx <= 0) return;
    const row = visibleRows[idx - 1];
    if (!row) return;
    if (!row.pid) {
      status.setContent(' No PID for this row');
      status.style.fg = 'yellow';
      screen.render();
      return;
    }
    killDialogOpen = true;
    try {
      const cmd = row.command || '-';
      const ok1 = await helpAsk(
        `End listener on TCP ${row.port}?  ${row.process || 'process'}  PID ${row.pid}`,
        { detail: cmd },
      );
      if (!ok1) return;
      const ok2 = await helpAsk('Second confirm: send SIGTERM to this process?', { detail: cmd });
      if (!ok2) return;
      try {
        await killPid(row.pid, false);
        status.setContent(` SIGTERM sent to PID ${row.pid} (port ${row.port})`);
        status.style.fg = 'green';
        await refresh();
      } catch (e) {
        status.setContent(` Kill failed: ${e.message || e}`);
        status.style.fg = 'red';
        screen.render();
      }
    } finally {
      killDialogOpen = false;
    }
  }

  function updateList() {
    ignoreSelectItem = true;
    try {
      visibleRows = filterQuery ? rows.filter((r) => fuzzyMatchQuery(filterQuery, r)) : rows;
      const innerCols = Math.max(
        48,
        (typeof list.width === 'number' && list.width > 0 ? list.width : screen.width) - 4,
      );
      const cmdMax = commandMaxForWidth(innerCols);
      const items = [
        tableHeaderLine(cmdMax),
        ...visibleRows.map((r) => formatRowLine(r, cmdMax)),
      ];
      const prevIdx = list.selected;
      list.setItems(items);
      if (items.length > 1) {
        const nextIdx = prevIdx >= 1 && prevIdx < items.length ? prevIdx : 1;
        list.select(nextIdx);
      }
      info.setContent(
        blessedPlain(
          ` ${visibleRows.length}/${rows.length} ports | filter: ${filterQuery || '(none)'}  (/ · popup)`,
        ),
      );
      screen.render();
    } finally {
      ignoreSelectItem = false;
    }
  }

  async function refresh() {
    status.setContent(' Scanning ports...');
    status.style.fg = 'yellow';
    screen.render();
    try {
      rows = await listPortsDetailed();
      status.setContent(` Refreshed: ${rows.length} listening ports`);
      status.style.fg = 'green';
      updateList();
    } catch (error) {
      status.setContent(` Scan failed: ${error.message || error}`);
      status.style.fg = 'red';
      screen.render();
    }
  }

  function markNavigationSelectItem() {
    skipToggleOnNextSelectItem = true;
    queueMicrotask(() => {
      skipToggleOnNextSelectItem = false;
    });
  }

  prependBlessedListener(list, 'keypress', (ch, key) => {
    if (key.name === 'up' || key.name === 'down') markNavigationSelectItem();
    if (list.options.vi && (key.name === 'k' || key.name === 'j')) markNavigationSelectItem();
  });
  prependBlessedListener(list, 'element wheeldown', () => markNavigationSelectItem());
  prependBlessedListener(list, 'element wheelup', () => markNavigationSelectItem());
  prependBlessedListener(list, 'keypress', (ch, key) => {
    if (key.name !== 'escape') return;
    if (filterModalOpen || killDialogOpen) return;
    if (!filterQuery) return;
    setFilterQuery('');
    screen.render();
  });

  list.on('select item', () => {
    if (ignoreSelectItem) return;
    if (skipToggleOnNextSelectItem) return;
    void offerKillCurrentRow();
  });
  list.on('action', (_el, index) => {
    if (ignoreSelectItem) return;
    if (typeof index !== 'number' || index <= 0) return;
    void offerKillCurrentRow();
  });

  screen.key(['q', 'C-c'], () => process.exit(0));
  screen.key(['r'], () => void refresh());
  screen.key(['/'], () => {
    void openFilterModal();
  });

  screen.on('resize', () => {
    updateList();
  });

  function setFilterQuery(next) {
    filterQuery = String(next || '').trim();
    updateList();
  }

  btnRefresh.on('press', () => void refresh());
  btnQuit.on('press', () => process.exit(0));

  screen.append(title);
  screen.append(info);
  screen.append(list);
  screen.append(status);
  screen.render();
  await refresh();
  list.focus();
}

function printHelp() {
  console.log(`
Port Hunter CLI

Usage:
  port-hunter               Start mouse-enabled TUI
  port-hunter --once        Scan and print detailed listening ports once
  port-hunter --help        Show this help

Website: https://rebebuca.com
`);
}

async function runOnce() {
  const rows = await listPortsDetailed();
  if (rows.length === 0) {
    console.log('No listening ports found.');
    return;
  }
  printTableOnce(rows);
}

async function main() {
  if (argv.includes('--help') || argv.includes('-h')) return printHelp();
  if (argv.includes('--once')) return runOnce();
  return runInteractiveTui();
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
