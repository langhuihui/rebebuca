/**
 * Terminal Handler
 *
 * Manages PTY (pseudo-terminal) processes using node-pty.
 * Handles terminal creation, I/O, resizing, and cleanup.
 */

import os from 'os';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { chmodSync, existsSync, readdirSync, statSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { spawn as spawnProcess, execFile as execFileCallback, spawnSync } from 'child_process';
import { promisify } from 'util';

const execFile = promisify(execFileCallback);
const nodeRequire = createRequire(import.meta.url);
const treeKill = promisify(nodeRequire('tree-kill'));

/**
 * npm's node-pty macOS tarballs sometimes ship spawn-helper as 644 (non-executable),
 * which breaks pty.spawn with "posix_spawnp failed". Fix once at load time.
 * @see https://github.com/microsoft/node-pty/issues/850
 */
function ensureNodePtySpawnHelperExecutable() {
  if (os.platform() !== 'darwin') return;
  try {
    const require = createRequire(import.meta.url);
    const pkgJson = require.resolve('node-pty/package.json');
    const root = path.dirname(pkgJson);
    const prebuilds = path.join(root, 'prebuilds');
    if (!existsSync(prebuilds)) return;
    for (const name of readdirSync(prebuilds)) {
      if (!name.startsWith('darwin-')) continue;
      const helper = path.join(prebuilds, name, 'spawn-helper');
      if (!existsSync(helper)) continue;
      const mode = statSync(helper).mode;
      if ((mode & 0o100) === 0) {
        chmodSync(helper, 0o755);
        console.warn(`[Terminal] Restored execute bit on node-pty spawn-helper (${helper})`);
      }
    }
  } catch (e) {
    console.warn('[Terminal] Could not verify node-pty spawn-helper permissions:', e.message);
  }
}

// Dynamically import node-pty to allow graceful fallback if native build fails
let pty;
try {
  const nodePty = await import('node-pty');
  pty = nodePty.default ?? nodePty;
  ensureNodePtySpawnHelperExecutable();
} catch (err) {
  console.warn('[Terminal] node-pty not available, PTY terminals will be disabled:', err.message);
}

/** Map from ptyId -> { ptyProcess|childProcess, pid, running, mode, meta } */
const ptys = new Map();

/** Captured PTY output for page refresh / reattach (per session) */
const ptyScrollback = new Map();
const SCROLLBACK_MAX_CHARS = 600000;

function appendScrollback(ptyId, chunk) {
  if (chunk == null || chunk === '') return;
  const cur = ptyScrollback.get(ptyId) || '';
  const next = cur + chunk;
  if (next.length <= SCROLLBACK_MAX_CHARS) {
    ptyScrollback.set(ptyId, next);
  } else {
    ptyScrollback.set(ptyId, next.slice(next.length - SCROLLBACK_MAX_CHARS));
  }
}

/** Global event emitter for terminal data/exit events */
export const terminalEvents = new EventEmitter();

let childFallbackWarned = false;

/**
 * Generate a random PTY ID
 */
function generatePtyId() {
  return `pty-${randomUUID()}`;
}

/**
 * Determine the default shell for the current platform
 */
function getDefaultShell() {
  const platform = os.platform();
  if (platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe';
  }
  if (platform === 'darwin') {
    return process.env.SHELL || '/bin/zsh';
  }
  return process.env.SHELL || '/bin/bash';
}

function quoteShellArg(arg) {
  // Safe for sh/zsh/bash when building a single -lc string
  if (arg === '') return "''";
  return `'${String(arg).replace(/'/g, `'\"'\"'`)}'`;
}

function buildCommandString(command, args) {
  return [command, ...(args || [])].map(quoteShellArg).join(' ');
}

/**
 * Build a Windows cmd.exe-compatible command string.
 * Uses double-quote quoting (single quotes have no special meaning in cmd.exe).
 */
function buildWindowsCommandString(command, args) {
  return [command, ...(args || [])]
    .map((arg) => {
      const s = String(arg);
      if (s === '') return '""';
      // Wrap in double quotes if the arg contains spaces, tabs, double quotes,
      // or cmd.exe special characters (&, |, <, >, ^, %)
      if (/[\s"&|<>^%]/.test(s)) {
        // Escape embedded double quotes by doubling them (cmd.exe convention)
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    })
    .join(' ');
}

/**
 * Frontend already sends cmd + ['/c', line] or ['/k', line]. Spawn that executable
 * with those argv entries directly. Wrapping as `cmd /s /c cmd /c "pnpm run dev"` nests
 * quotes into one argv slot and CMD then treats '\"pnpm run dev\"' as a program name.
 */
function isWindowsCmdSlashInvocation(command, args) {
  if (!command || !Array.isArray(args) || args.length < 2) return false;
  const base = path.basename(String(command)).toLowerCase();
  if (base !== 'cmd.exe' && base !== 'cmd') return false;
  const a0 = String(args[0]).toLowerCase();
  return a0 === '/c' || a0 === '/k';
}

function resolveWindowsCmdExecutable(command) {
  const s = String(command);
  const norm = s.replace(/\\/g, '/').toLowerCase();
  if (norm === 'cmd' || norm.endsWith('/cmd') || norm.endsWith('/cmd.exe')) {
    const comspec = process.env.ComSpec || process.env.COMSPEC;
    if (comspec && existsSync(comspec)) return comspec;
    const fb = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe');
    if (existsSync(fb)) return fb;
  }
  if (existsSync(s)) return s;
  return s;
}

/** PowerShell -Command / -File: spawn exe + argv directly (same quoting class of bugs). */
function isWindowsPowerShellInvocation(command, args) {
  if (!command || !Array.isArray(args) || args.length < 2) return false;
  const base = path.basename(String(command)).toLowerCase();
  if (!['powershell.exe', 'pwsh.exe'].includes(base)) return false;
  const a0 = String(args[0]).toLowerCase();
  return a0 === '-command' || a0 === '-file';
}

function resolveWindowsSpawnExecutable(command) {
  const s = String(command);
  if (existsSync(s)) return s;
  return s;
}

function registerPtyEntry(ptyId, processLike, mode = 'pty', meta = {}) {
  ptys.set(ptyId, { processLike, pid: processLike.pid, running: true, mode, meta });

  if (mode === 'pty') {
    processLike.onData((data) => {
      appendScrollback(ptyId, data);
      terminalEvents.emit('data', { ptyId, data });
    });
    processLike.onExit(({ exitCode, signal }) => {
      const entry = ptys.get(ptyId);
      if (entry) entry.running = false;
      terminalEvents.emit('exit', { ptyId, exitCode: exitCode ?? (signal ? -1 : 0) });
      ptys.delete(ptyId);
      ptyScrollback.delete(ptyId);
    });
    return;
  }

  // child_process fallback
  processLike.stdout?.on('data', (chunk) => {
    const s = chunk.toString();
    appendScrollback(ptyId, s);
    terminalEvents.emit('data', { ptyId, data: s });
  });
  processLike.stderr?.on('data', (chunk) => {
    const s = chunk.toString();
    appendScrollback(ptyId, s);
    terminalEvents.emit('data', { ptyId, data: s });
  });
  processLike.on('close', (code, signal) => {
    const entry = ptys.get(ptyId);
    if (entry) entry.running = false;
    terminalEvents.emit('exit', { ptyId, exitCode: code ?? (signal ? -1 : 0) });
    ptys.delete(ptyId);
    ptyScrollback.delete(ptyId);
  });
}

/**
 * Create a new PTY terminal process.
 *
 * @param {object} params
 * @returns {{ ptyId: string, pid: number }}
 */
export async function createTerminal(params) {
  if (!pty) {
    throw new Error('node-pty is not available. Install node-pty to enable terminal support.');
  }

  const {
    ptyId: requestedId,
    command,
    args = [],
    cwd,
    env = {},
    rows = 24,
    cols = 80,
    shellPath,
    meta: sessionMeta = {},
  } = params;

  // Resolve shell / command
  // - command === 'default': open an interactive shell
  // - task command:
  //   - explicit shell -c (sh/bash/zsh): execute with that shell directly
  //   - other command: execute through login shell (-lc) for PATH consistency
  const defaultShell = shellPath || getDefaultShell();
  const isTaskCommand = command && command !== 'default';
  const lowerCmd = String(command || '').toLowerCase();
  const isExplicitShellCmd = ['sh', 'bash', 'zsh', '/bin/sh', '/bin/bash', '/bin/zsh'].includes(lowerCmd);
  const isShellScriptRun =
    isExplicitShellCmd &&
    Array.isArray(args) &&
    args[0] === '-c';

  let shell = defaultShell;
  if (isTaskCommand && isShellScriptRun) {
    // Prefer concrete absolute shells for stability
    if (lowerCmd === 'sh') shell = '/bin/sh';
    else if (lowerCmd === 'bash') shell = '/bin/bash';
    else if (lowerCmd === 'zsh') shell = '/bin/zsh';
    else shell = command;
  }
  const workingDir = cwd || os.homedir();
  const ptyId = requestedId || generatePtyId();

  if (sessionMeta.label || command !== 'default') {
    console.log('[Terminal] create:', {
      ptyId,
      label: sessionMeta.label,
      command,
      argsPreview: Array.isArray(args) ? args.slice(0, 8) : args,
      cwd: workingDir,
      shellPath: shellPath || '(default shell)',
    });
  }

  // Merge environment with current process env, preferring caller-supplied vars
  const mergedEnvRaw = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    ...env,
  };

  // node-pty expects env values to be strings; filter/normalize to avoid spawn failures
  const mergedEnv = {};
  for (const [k, v] of Object.entries(mergedEnvRaw)) {
    if (v === undefined || v === null) continue;
    mergedEnv[k] = typeof v === 'string' ? v : String(v);
  }

  if (!existsSync(workingDir)) {
    throw new Error(`[Terminal] cwd does not exist: ${workingDir}`);
  }
  if (os.platform() !== 'win32' && !existsSync(shell)) {
    throw new Error(`[Terminal] shell does not exist: ${shell}`);
  }

  let finalArgs = args;
  if (isTaskCommand) {
    // If task already provides an explicit shell -c command, run it directly.
    if (!isShellScriptRun) {
      if (os.platform() === 'win32') {
        if (isWindowsCmdSlashInvocation(command, args)) {
          shell = resolveWindowsCmdExecutable(command);
          finalArgs = args;
        } else if (isWindowsPowerShellInvocation(command, args)) {
          shell = resolveWindowsSpawnExecutable(command);
          finalArgs = args;
        } else {
          // Build a Windows-compatible command string using double-quote quoting.
          // Omit /d so that AutoRun registry entries (e.g. Conda, NVM for Windows,
          // pyenv-win) can run and set up the shell environment — the Windows
          // equivalent of the Unix login-shell (-l) flag used on other platforms.
          const winCmdString = buildWindowsCommandString(command, args);
          finalArgs = ['/s', '/c', winCmdString];
        }
      } else {
        const cmdString = buildCommandString(command, args);
        // Use login shell to load PATH and env (zsh/bash)
        finalArgs = ['-lc', cmdString];
      }
    }
  }

  let ptyProcess;
  try {
    ptyProcess = pty.spawn(shell, finalArgs, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: workingDir,
    env: mergedEnv,
    });
  } catch (err) {
    // Retry with fallback shells on POSIX
    if (os.platform() !== 'win32') {
      const fallbackShells = ['/bin/sh', '/bin/bash', '/bin/zsh'].filter((s) => s !== shell && existsSync(s));
      for (const fallback of fallbackShells) {
        try {
          ptyProcess = pty.spawn(fallback, finalArgs, {
            name: 'xterm-256color',
            cols,
            rows,
            cwd: workingDir,
            env: mergedEnv,
          });
          shell = fallback;
          break;
        } catch (_) {
          // continue fallback chain
        }
      }
    }
    if (!ptyProcess) {
      // Fallback when node-pty.spawn fails (e.g. Node v25 + broken native build).
      // Do NOT wrap with `script`: stdio is pipes, and script needs a real TTY →
      // "tcgetattr/ioctl: Operation not supported on socket".
      if (isTaskCommand) {
        try {
          if (!childFallbackWarned) {
            childFallbackWarned = true;
            console.warn(
              '[Terminal] node-pty spawn failed; using child_process (no real PTY). ' +
                'Some interactive CLIs may show little or no live output. ' +
                'On macOS, ensure node-pty prebuilds/darwin-*/spawn-helper is executable (644 in npm tarball is a known issue). ' +
                `Current Node: ${process.version}.`,
            );
          }
          const childEnv = {
            ...mergedEnv,
            PYTHONUNBUFFERED: '1',
          };
          const child = spawnProcess(shell, finalArgs, {
            cwd: workingDir,
            env: childEnv,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false,
          });
          registerPtyEntry(ptyId, child, 'child', sessionMeta);
          // Immediate user-visible hint in the terminal panel
          const fallbackHint =
            '\r\n\x1b[33m[Rebebuca]\x1b[0m Running without PTY (node-pty spawn failed). ' +
            'Live output may be limited. On macOS try restarting the backend after install; ' +
            'if it persists, run: chmod +x node_modules/node-pty/prebuilds/darwin-*/spawn-helper\r\n\r\n';
          appendScrollback(ptyId, fallbackHint);
          terminalEvents.emit('data', { ptyId, data: fallbackHint });
          return { ptyId, pid: child.pid || 0 };
        } catch (_) {
          // keep original error below
        }
      }
      const details = {
        ptyId,
        shell,
        args: finalArgs,
        cwd: workingDir,
        command,
      };
      throw new Error(`[Terminal] Failed to spawn PTY: ${err.message}\n${JSON.stringify(details, null, 2)}`);
    }
  }

  registerPtyEntry(ptyId, ptyProcess, 'pty', sessionMeta);

  return { ptyId, pid: ptyProcess.pid };
}

/**
 * Write data to a PTY.
 */
export function writeTerminal(ptyId, data) {
  const entry = ptys.get(ptyId);
  if (!entry || !entry.running) {
    throw new Error(`PTY not found or not running: ${ptyId}`);
  }
  if (entry.mode === 'pty') {
    entry.processLike.write(data);
    return;
  }
  entry.processLike.stdin?.write(data);
}

/**
 * Resize a PTY.
 */
export function resizeTerminal(ptyId, cols, rows) {
  const entry = ptys.get(ptyId);
  if (!entry || !entry.running) return;
  if (entry.mode === 'pty') {
    entry.processLike.resize(cols, rows);
  }
}

/**
 * Windows: taskkill /T sometimes fails with access denied or "circular" process trees
 * (conhost ↔ powershell ↔ children). Retry root-only kill + PowerShell Stop-Process.
 */
function killWindowsProcessTreeBestEffort(pid) {
  const id = String(pid);
  const spawnOpts = {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  };

  const summarize = (r) => [r.stderr, r.stdout].filter(Boolean).join(' ').trim();

  const attempts = [
    { cmd: 'taskkill', args: ['/PID', id, '/T', '/F'], label: 'taskkill /T /F' },
    { cmd: 'taskkill', args: ['/PID', id, '/F'], label: 'taskkill /F (root)' },
  ];

  for (const { cmd, args, label } of attempts) {
    try {
      const r = spawnSync(cmd, args, spawnOpts);
      if (r.status === 0) {
        console.log(`[Terminal] ${label}: ok pid=${id}`);
        return true;
      }
      const text = summarize(r);
      const benign =
        !text ||
        /not find|could not find|no tasks running|not running|没有找到进程|no process/i.test(text);
      if (!benign) {
        console.warn(`[Terminal] ${label} pid=${id}:`, text.slice(0, 600));
      }
    } catch (e) {
      console.warn(`[Terminal] ${label} threw:`, e?.message || e);
    }
  }

  const psExe = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  const exe = existsSync(psExe) ? psExe : 'powershell.exe';
  try {
    const r = spawnSync(
      exe,
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-WindowStyle',
        'Hidden',
        '-Command',
        `try { Stop-Process -Id ${Number(pid)} -Force -ErrorAction Stop; exit 0 } catch { exit 1 }`,
      ],
      spawnOpts,
    );
    if (r.status === 0) {
      console.log('[Terminal] Stop-Process -Force: ok pid=', id);
      return true;
    }
    const psOut = summarize(r);
    if (psOut && !/Cannot find a process|找不到进程/i.test(psOut)) {
      console.warn('[Terminal] Stop-Process failed pid=', id, psOut.slice(0, 400));
    }
  } catch (e) {
    console.warn('[Terminal] Stop-Process threw:', e?.message || e);
  }

  return false;
}

/**
 * Kill PTY root PID and all descendants (pnpm/npm/node leaves children otherwise).
 * Windows: custom fallbacks (see killWindowsProcessTreeBestEffort). Unix: tree-kill.
 */
async function killProcessTree(pid, signal) {
  const n = Number(pid);
  if (!Number.isFinite(n) || n <= 0) return;

  if (os.platform() === 'win32') {
    killWindowsProcessTreeBestEffort(n);
    return;
  }

  try {
    await treeKill(n, signal);
  } catch (err) {
    const msg = String(err?.message || err);
    if (!msg.includes('not found') && !msg.includes('No such process')) {
      console.warn('[Terminal] killProcessTree:', msg);
    }
  }
}

/**
 * Send SIGTERM to a PTY process tree (not only the shell — fixes orphan children).
 */
export async function killTerminal(ptyId) {
  const entry = ptys.get(ptyId);
  if (!entry) return;
  const pid = entry.pid;
  try {
    // Close PTY first so conhost/cmd tear down; then kill any surviving children (pnpm/node).
    try {
      entry.processLike.kill('SIGTERM');
    } catch (_) {
      // Ignore if already dead
    }
    if (os.platform() === 'win32') {
      await new Promise((r) => setTimeout(r, 120));
    }
    if (pid) {
      await killProcessTree(pid, 'SIGTERM');
    }
  } catch (e) {
    console.warn('[Terminal] killTerminal:', e?.message || e);
  }
  entry.running = false;
}

/**
 * Force-kill (SIGKILL / taskkill /T /F on Windows) a PTY process tree.
 */
export async function forceKillTerminal(ptyId) {
  const entry = ptys.get(ptyId);
  if (!entry) return;
  const pid = entry.pid;
  try {
    try {
      entry.processLike.kill('SIGKILL');
    } catch (_) {
      // Ignore if already dead
    }
    if (os.platform() === 'win32') {
      await new Promise((r) => setTimeout(r, 80));
    }
    if (pid) {
      await killProcessTree(pid, 'SIGKILL');
    }
  } catch (e) {
    console.warn('[Terminal] forceKillTerminal:', e?.message || e);
  }
  entry.running = false;
  ptys.delete(ptyId);
  ptyScrollback.delete(ptyId);
}

/**
 * Check if a PTY is still running.
 */
export function isTerminalRunning(ptyId) {
  const entry = ptys.get(ptyId);
  return entry ? entry.running : false;
}

/**
 * Get basic process stats for a PTY.
 * Returns null if not available on this platform.
 */
export async function getTerminalProcessStats(ptyId) {
  const entry = ptys.get(ptyId);
  if (!entry || !entry.running) return null;

  try {
    if (!entry.pid || Number(entry.pid) <= 0) return null;

    if (os.platform() === 'win32') {
      return null;
    }

    // Collect stats from OS process table with a strict timeout to avoid hanging.
    // Note: Many terminal tasks run the real workload in child processes; the PTY "master"
    // PID might be mostly idle, so we sum CPU/RSS for the PTY PID + its direct children.
    //
    // - pcpu: CPU %
    // - rss: resident memory (KB)
    const parentPid = Number(entry.pid);

    const getChildPids = async (pid) => {
      try {
        // macOS: pgrep -P <ppid>
        const { stdout } = await execFile('pgrep', ['-P', String(pid)], { timeout: 800 });
        return String(stdout || '')
          .split(/\s+/)
          .map((s) => Number.parseInt(s, 10))
          .filter((n) => Number.isFinite(n) && n > 0);
      } catch {
        return [];
      }
    };

    const psSumStats = async (pids) => {
      if (pids.length === 0) return { cpuUsage: 0, memoryUsageBytes: 0 };
      const pidList = pids.join(',');
      const { stdout } = await execFile(
        'ps',
        ['-p', pidList, '-o', 'pcpu=,rss='],
        { timeout: 1200 },
      );

      const lines = String(stdout || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      let cpuSum = 0;
      let rssKbSum = 0;
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length < 2) continue;
        const cpu = Number.parseFloat(parts[0]);
        const rssKb = Number.parseInt(parts[1], 10);
        if (Number.isFinite(cpu)) cpuSum += cpu;
        if (Number.isFinite(rssKb)) rssKbSum += rssKb;
      }

      return {
        cpuUsage: Math.max(0, cpuSum),
        memoryUsageBytes: Math.max(0, rssKbSum * 1024),
      };
    };

    const directChildren = await getChildPids(parentPid);
    const pidSet = new Set([parentPid, ...directChildren]);

    // Clamp to avoid pathological cases with lots of descendants
    const pidList = Array.from(pidSet).slice(0, 50);
    const { cpuUsage, memoryUsageBytes } = await psSumStats(pidList);

    const memoryUsageMbValue = memoryUsageBytes / (1024 * 1024);
    return {
      ptyId,
      pid: parentPid,
      cpuUsage,
      memoryUsage: memoryUsageBytes,
      memoryUsageMb: `${memoryUsageMbValue.toFixed(1)} MB`,
    };
  } catch {
    return null;
  }
}

/**
 * Kill all PTYs owned by a client (called on disconnect).
 */
export async function killClientPtys(ptyIds) {
  for (const id of ptyIds) {
    await killTerminal(id);
    ptys.delete(id);
    ptyScrollback.delete(id);
  }
}

/**
 * List PTY sessions still running (for UI refresh / reattach).
 */
export function listRunningPtySessions() {
  const out = [];
  for (const [ptyId, entry] of ptys) {
    if (!entry.running) continue;
    out.push({
      ptyId,
      pid: entry.pid,
      running: true,
      meta: entry.meta && typeof entry.meta === 'object' ? entry.meta : {},
    });
  }
  return out;
}

/**
 * Return captured output for a PTY (for replay in xterm after refresh).
 */
export function getTerminalScrollback(ptyId) {
  return ptyScrollback.get(ptyId) || '';
}
