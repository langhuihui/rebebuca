/**
 * Headless CLI helpers (list / run / shell / completion) — no HTTP server.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { listPorts, killProcess, killProcessForce } from './handlers/system.js';

const STORE_PATH = path.join(os.homedir(), '.rebebuca', 'store.json');
const KILL_PORT_TIMEOUT_MS = 15000;

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
async function withTimeout(promise, ms, label) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let t;
  try {
    const timeout = new Promise((_, reject) => {
      t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return await Promise.race([promise, timeout]);
  } finally {
    if (t) clearTimeout(t);
  }
}

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[rebebuca] Failed to read store (${STORE_PATH}):`, e.message);
    return null;
  }
}

/**
 * @returns {Record<string, unknown>[]}
 */
export function loadPersistedUserTasks() {
  const store = readStore();
  if (store == null) return [];
  const groups = store.userGroups;
  if (!Array.isArray(groups)) return [];
  /** @type {Record<string, unknown>[]} */
  const out = [];
  for (const g of groups) {
    if (!g || typeof g !== 'object' || !Array.isArray(g.tasks)) continue;
    for (const t of g.tasks) {
      if (t && typeof t === 'object' && t.id) out.push(t);
    }
  }
  return out;
}

function quoteShellArg(arg) {
  if (arg === '') return "''";
  return `'${String(arg).replace(/'/g, `'\"'\"'`)}'`;
}

function buildCommandString(command, args) {
  return [command, ...(args || [])].map(quoteShellArg).join(' ');
}

function getDefaultShell() {
  if (os.platform() === 'win32') {
    return process.env.COMSPEC || 'cmd.exe';
  }
  if (os.platform() === 'darwin') {
    return process.env.SHELL || '/bin/zsh';
  }
  return process.env.SHELL || '/bin/bash';
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @param {Record<string, string>} [envExtra]
 * @returns {Promise<number>} exit code
 */
function spawnTaskLike(command, args, cwd, envExtra = {}) {
  return new Promise((resolve, reject) => {
    const defaultShell = getDefaultShell();
    const lowerCmd = String(command || '').toLowerCase();
    const isExplicitShellCmd = ['sh', 'bash', 'zsh', '/bin/sh', '/bin/bash', '/bin/zsh'].includes(lowerCmd);
    const isShellScriptRun =
      isExplicitShellCmd && Array.isArray(args) && args[0] === '-c';

    let shell = defaultShell;
    if (command && isShellScriptRun) {
      if (lowerCmd === 'sh') shell = '/bin/sh';
      else if (lowerCmd === 'bash') shell = '/bin/bash';
      else if (lowerCmd === 'zsh') shell = '/bin/zsh';
      else shell = command;
    }

    let finalArgs = args || [];
    if (command && command !== 'default') {
      if (!isShellScriptRun) {
        const cmdString = buildCommandString(command, args || []);
        if (os.platform() === 'win32') {
          finalArgs = ['/d', '/s', '/c', cmdString];
        } else {
          finalArgs = ['-lc', cmdString];
        }
      }
    } else {
      finalArgs = args || [];
    }

    const mergedEnv = { ...process.env, ...envExtra };
    const child =
      os.platform() === 'win32'
        ? spawn(shell, finalArgs, {
            cwd,
            env: mergedEnv,
            stdio: 'inherit',
            windowsHide: true,
          })
        : spawn(shell, finalArgs, {
            cwd,
            env: mergedEnv,
            stdio: 'inherit',
          });

    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

function isMacroTask(task) {
  return (
    task.type === 'macro' ||
    (!task.command && (task.dependsOn?.length || task.subTasks?.length))
  );
}

function resolveTaskDepsOrder(taskId, tasksById, visited = new Set()) {
  if (visited.has(taskId)) {
    throw new Error(`Circular task dependency involving ${taskId}`);
  }
  visited.add(taskId);
  const task = tasksById.get(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  if (!task.dependsOn?.length) {
    return [taskId];
  }
  const resolved = [];
  for (const depId of task.dependsOn) {
    const sub = resolveTaskDepsOrder(depId, tasksById, new Set(visited));
    for (const id of sub) {
      if (!resolved.includes(id)) resolved.push(id);
    }
  }
  resolved.push(taskId);
  return resolved;
}

/**
 * @param {Record<string, unknown>} task
 * @param {Map<string, Record<string, unknown>>} tasksById
 * @param {string} [cwdOverride]
 * @returns {Promise<number>} last exit code (0 if all ok)
 */
async function runTaskRecursive(task, tasksById, cwdOverride) {
  if (task.sshConfigId) {
    throw new Error('SSH tasks cannot be run from the CLI; use the Rebebuca UI.');
  }
  if (task.useSystemTerminal) {
    throw new Error(
      'Tasks configured for system terminal cannot run from the CLI; use the UI or disable system terminal.',
    );
  }

  if (isMacroTask(task)) {
    if (task.executionMode === 'parallel' && task.subTasks?.length) {
      const results = await Promise.all(
        task.subTasks.map((id) => {
          const t = tasksById.get(String(id));
          if (!t) throw new Error(`Task not found: ${id}`);
          return runTaskRecursive(t, tasksById, cwdOverride);
        }),
      );
      return results.some((c) => c !== 0) ? 1 : 0;
    }
    if (task.subTasks?.length) {
      for (const id of task.subTasks) {
        const t = tasksById.get(String(id));
        if (!t) throw new Error(`Task not found: ${id}`);
        const code = await runTaskRecursive(t, tasksById, cwdOverride);
        if (code !== 0) return code;
      }
      return 0;
    }
    if (task.dependsOn?.length) {
      const order = resolveTaskDepsOrder(String(task.id), tasksById);
      for (const id of order) {
        const t = tasksById.get(id);
        if (!t) throw new Error(`Task not found: ${id}`);
        if (isMacroTask(t) && !t.command) continue;
        if (!t.command) continue;
        const code = await runTaskRecursive(t, tasksById, cwdOverride);
        if (code !== 0) return code;
      }
      return 0;
    }
    throw new Error(`Macro task ${task.id} has no subTasks or dependsOn`);
  }

  if (!task.command) {
    throw new Error(`Task ${task.id} has no command`);
  }

  const cwd = cwdOverride || task.cwd || os.homedir();
  const env = task.env && typeof task.env === 'object' ? task.env : {};
  return spawnTaskLike(
    task.command,
    Array.isArray(task.args) ? task.args : [],
    cwd,
    env,
  );
}

/**
 * @param {string} query
 * @param {Record<string, unknown>[]} tasks
 * @returns {Record<string, unknown>[]}
 */
export async function fuzzyFilterTasks(query, tasks) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [...tasks];

  let uf;
  try {
    const mod = await import('@leeoniya/ufuzzy');
    const U = mod.default || mod;
    uf = new U({ intraMode: 1 });
  } catch {
    uf = null;
  }

  if (!uf) {
    return tasks.filter((t) => {
      const id = String(t.id || '').toLowerCase();
      const name = String(t.name || '').toLowerCase();
      const cmd = String(t.command || '').toLowerCase();
      return id.includes(q) || name.includes(q) || cmd.includes(q);
    });
  }

  const haystack = tasks.map((t) => `${t.id} ${t.name} ${t.command || ''}`);
  const [idxs] = uf.search(haystack, q, 0);
  if (!idxs || idxs.length === 0) return [];
  return idxs.map((i) => tasks[i]);
}

/**
 * @param {string} query
 */
export async function cmdRunTask(query) {
  const q = (query || '').trim();
  if (!q) {
    console.error('Usage: rebebuca run <task-id-or-name>');
    process.exit(1);
  }

  const tasks = loadPersistedUserTasks();
  if (tasks.length === 0) {
    console.error(
      '[rebebuca] No user tasks in ~/.rebebuca/store.json (userGroups). Open Rebebuca and ensure tasks are saved.',
    );
    process.exit(1);
  }

  const tasksById = new Map(tasks.map((t) => [String(t.id), t]));
  const exact = tasksById.get(q);
  if (exact) {
    const code = await runTaskRecursive(exact, tasksById);
    process.exit(code);
  }

  const matches = await fuzzyFilterTasks(q, tasks);
  if (matches.length === 0) {
    console.error(`[rebebuca] No task matches "${q}". Try: rebebuca list tasks`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`[rebebuca] Ambiguous "${q}" — multiple matches:`);
    for (const t of matches.slice(0, 20)) {
      console.error(`  ${t.id}\t${t.name}`);
    }
    if (matches.length > 20) console.error(`  ... and ${matches.length - 20} more`);
    process.exit(1);
  }

  const code = await runTaskRecursive(matches[0], tasksById);
  process.exit(code);
}

/**
 * End processes listening on the given TCP port(s). Uses the same discovery as the UI (ss / lsof / netstat).
 *
 * @param {string[]} argv flags and port numbers: [--force|-f] <port> [<port>...]
 */
export async function cmdKillPort(argv) {
  /** @type {number[]} */
  const ports = [];
  let force = false;
  for (const a of argv) {
    if (a === '--force' || a === '-f') {
      force = true;
      continue;
    }
    const n = parseInt(a, 10);
    if (String(n) !== String(a) || n <= 0 || n > 65535) {
      console.error(`[rebebuca] Invalid port: ${a}`);
      process.exit(1);
    }
    ports.push(n);
  }
  if (ports.length === 0) {
    console.error('Usage: rebebuca kill-port [--force|-f] <port> [<port>...]');
    process.exit(1);
  }

  /** @type {Awaited<ReturnType<typeof listPorts>>} */
  let listed;
  try {
    listed = await withTimeout(listPorts(), KILL_PORT_TIMEOUT_MS, 'listPorts');
  } catch (e) {
    console.error('[rebebuca]', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const uniquePorts = [...new Set(ports)];
  let exitCode = 0;
  for (const port of uniquePorts) {
    const matches = listed.filter((x) => x.port === port && x.pid > 0);
    const pids = [...new Set(matches.map((m) => m.pid))];
    if (pids.length === 0) {
      console.error(`[rebebuca] No process is listening on TCP port ${port}.`);
      exitCode = 1;
      continue;
    }
    for (const pid of pids) {
      if (pid === process.pid) {
        console.error(`[rebebuca] Refusing to kill the current process (PID ${pid}).`);
        exitCode = 1;
        continue;
      }
      const names = [
        ...new Set(matches.filter((m) => m.pid === pid).map((m) => m.process || 'unknown')),
      ];
      const label = names.join(', ') || 'unknown';
      try {
        if (force) {
          await killProcessForce(pid);
        } else {
          await killProcess(pid);
        }
        console.log(
          `[rebebuca] Sent ${force ? 'SIGKILL' : 'SIGTERM'} to PID ${pid} (${label}) listening on TCP ${port}`,
        );
      } catch (e) {
        console.error(`[rebebuca] Failed to kill PID ${pid}:`, e instanceof Error ? e.message : e);
        exitCode = 1;
      }
    }
  }
  process.exit(exitCode);
}

/**
 * @param {string} what tasks | options | all
 * @param {boolean} json
 */
export function cmdList(what, json) {
  const w = what || 'tasks';
  if (!['tasks', 'options', 'all'].includes(w)) {
    console.error('Usage: rebebuca list [tasks|options|all] [--json]');
    process.exit(1);
  }

  const optionRows = [
    ['--port <n>', 'HTTP port (default 3000)'],
    ['--host <addr>', 'Bind address (default 127.0.0.1)'],
    ['--no-open', 'Do not open browser'],
    ['--no-mcp', 'Disable MCP HTTP routes'],
    ['list [tasks|options|all]', 'Print tasks and/or CLI flags'],
    ['run <query>', 'Run a persisted user task by id or fuzzy name'],
    ['-- <command...>', 'Run a shell command (no web UI)'],
    ['complete bash|zsh', 'Print shell completion script for bash or zsh'],
  ];

  if (json) {
    const tasks = loadPersistedUserTasks();
    const options = optionRows.map(([flag, description]) => ({ flag, description }));
    if (w === 'options') {
      console.log(JSON.stringify({ options }, null, 2));
    } else if (w === 'tasks') {
      console.log(JSON.stringify(tasks, null, 2));
    } else {
      console.log(JSON.stringify({ options, tasks }, null, 2));
    }
    return;
  }

  if (w === 'options' || w === 'all') {
    console.log('CLI flags & subcommands:');
    for (const [a, b] of optionRows) console.log(`  ${a.padEnd(28)} ${b}`);
    if (w === 'all') console.log('');
  }

  if (w === 'tasks' || w === 'all') {
    console.log('User tasks (from userGroups in store):');
    const tasks = loadPersistedUserTasks();
    if (tasks.length === 0) {
      console.log('  (none — open Rebebuca and add tasks under user groups)');
    } else {
      const idw = Math.max(...tasks.map((t) => String(t.id).length), 2);
      const namew = Math.max(...tasks.map((t) => String(t.name || '').length), 4);
      for (const t of tasks) {
        const cwd = t.cwd ? String(t.cwd) : '';
        console.log(
          `  ${String(t.id).padEnd(idw)}  ${String(t.name || '').padEnd(namew)}  ${t.command || ''} ${(t.args || []).join(' ')}`.trimEnd(),
        );
        if (cwd) console.log(`${''.padEnd(idw + 2)}  cwd: ${cwd}`);
      }
    }
  }
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>} exit code
 */
export function cmdShellPassthrough(argv) {
  if (!argv.length) {
    console.error('Usage: rebebuca -- <command> [args...]');
    return Promise.resolve(1);
  }
  const isWin = os.platform() === 'win32';
  const shell = getDefaultShell();
  const line = argv.join(' ');
  const child = isWin
    ? spawn(shell, ['/d', '/s', '/c', line], { stdio: 'inherit', windowsHide: true })
    : spawn(shell, ['-lc', line], { stdio: 'inherit' });
  return new Promise((resolve) => {
    child.on('error', (e) => {
      console.error(e.message);
      resolve(1);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

/**
 * Internal: newline-separated completion candidates (id<TAB>label).
 * @param {string} sub
 * @param {string} partial
 */
export async function cmdCompleteInternal(sub, partial) {
  if (sub !== 'run') return;
  const tasks = loadPersistedUserTasks();
  const matches = await fuzzyFilterTasks(partial, tasks);
  for (const t of matches) {
    const id = String(t.id);
    const name = String(t.name || '');
    const label = name ? `${name} (${id})` : id;
    console.log(`${id}\t${label}`);
  }
}

function completionScriptBash() {
  return `#!/usr/bin/env bash
# Rebebuca bash completion — install: source <(rebebuca complete bash)

_rebebuca() {
  local cur run_idx=-1 i
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"

  for (( i=1; i<COMP_CWORD; i++ )); do
    if [[ "\${COMP_WORDS[i]}" == "run" ]]; then
      run_idx=$i
      break
    fi
  done

  if [[ $run_idx -ge 0 && $COMP_CWORD -gt $run_idx ]]; then
    mapfile -t COMPREPLY < <(rebebuca __complete run "$cur" | cut -f1)
    return
  fi

  if [[ "$cur" == -* ]]; then
    mapfile -t COMPREPLY < <(compgen -W '--port --host --no-open --no-mcp --help -h --version -v' -- "$cur")
    return
  fi

  if [[ $COMP_CWORD -eq 1 ]]; then
    mapfile -t COMPREPLY < <(compgen -W 'list run kill-port complete --' -- "$cur")
    return
  fi

  if [[ "\${COMP_WORDS[1]}" == "kill-port" && "$cur" == -* ]]; then
    mapfile -t COMPREPLY < <(compgen -W '--force -f' -- "$cur")
    return
  fi

  if [[ "\${COMP_WORDS[1]}" == "list" && $COMP_CWORD -eq 2 ]]; then
    mapfile -t COMPREPLY < <(compgen -W 'tasks options all --json' -- "$cur")
    return
  fi

  if [[ "\${COMP_WORDS[1]}" == "complete" && $COMP_CWORD -eq 2 ]]; then
    mapfile -t COMPREPLY < <(compgen -W 'bash zsh' -- "$cur")
    return
  fi
}

complete -F _rebebuca rebebuca
`;
}

function completionScriptZsh() {
  return `#compdef rebebuca
# Rebebuca zsh completion — install: eval "\$(rebebuca complete zsh)"

_rebebuca() {
  if [[ -n \$words[$CURRENT] && \$words[$CURRENT] == -* ]]; then
    _arguments \\
      '(-h --help)'{-h,--help}'[Show help]' \\
      '(-v --version)'{-v,--version}'[Show version]' \\
      '--port[HTTP port]:port:' \\
      '--host[Bind host]:host:' \\
      '--no-open[Do not open browser]' \\
      '--no-mcp[Disable MCP routes]'
    return
  fi

  if (( CURRENT == 2 )); then
    compadd list run kill-port complete --
    return
  fi

  case \${words[2]} in
    list)
      compadd tasks options all --json
      ;;
    run)
      local -a ids
      ids=( \${(f)"\$(rebebuca __complete run \$words[$CURRENT] | cut -f1)"} )
      compadd -a ids
      ;;
    complete)
      compadd bash zsh
      ;;
  esac
}
`;
}

/**
 * @param {'bash' | 'zsh'} shell
 */
export function cmdPrintCompletion(shell) {
  if (shell === 'bash') {
    process.stdout.write(completionScriptBash());
    return;
  }
  if (shell === 'zsh') {
    process.stdout.write(completionScriptZsh());
    return;
  }
  console.error('Usage: rebebuca complete bash|zsh');
  process.exit(1);
}

export function getStorePathForHelp() {
  return STORE_PATH;
}
