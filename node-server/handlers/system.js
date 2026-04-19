/**
 * System Handler
 *
 * Provides platform information, shell/terminal discovery,
 * process management, and port listing.
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { enrichListeningPorts, isDevProcess } from './port-enrichment.js';

const execFileAsync = promisify(execFile);

// ============================================================================
// Platform helpers
// ============================================================================

/**
 * Normalize os.platform() to the adapter's expected values.
 */
export function getPlatform() {
  const p = os.platform();
  if (p === 'darwin') return 'darwin';
  if (p === 'win32') return 'windows';
  return 'linux';
}

export function getArch() {
  return os.arch();
}

export function getHomeDirectory() {
  return os.homedir();
}

// ============================================================================
// Shell discovery
// ============================================================================

/** Known shells to probe on Unix-like systems */
const UNIX_SHELLS = [
  '/bin/sh',
  '/bin/bash',
  '/bin/zsh',
  '/bin/fish',
  '/usr/bin/bash',
  '/usr/bin/zsh',
  '/usr/bin/fish',
  '/usr/local/bin/bash',
  '/usr/local/bin/zsh',
  '/usr/local/bin/fish',
  '/opt/homebrew/bin/bash',
  '/opt/homebrew/bin/zsh',
  '/opt/homebrew/bin/fish',
];

/** Known shells on Windows */
const WINDOWS_SHELLS = [
  { id: 'cmd', name: 'Command Prompt', path: 'cmd.exe' },
  { id: 'powershell', name: 'Windows PowerShell', path: 'powershell.exe' },
  { id: 'pwsh', name: 'PowerShell Core', path: 'pwsh.exe' },
];

/**
 * Return a list of available shell programs.
 */
export async function getAvailableShells() {
  const defaultShell = process.env.SHELL || '';
  const platform = os.platform();

  if (platform === 'win32') {
    const shells = [];
    for (const s of WINDOWS_SHELLS) {
      shells.push({ id: s.id, name: s.name, path: s.path, available: true, is_default: false });
    }
    return shells;
  }

  // Unix-like: try reading /etc/shells first
  let shellPaths = [...UNIX_SHELLS];
  try {
    const content = fs.readFileSync('/etc/shells', 'utf8');
    const etcShells = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && path.isAbsolute(l));
    // Merge without duplicates
    for (const s of etcShells) {
      if (!shellPaths.includes(s)) shellPaths.push(s);
    }
  } catch (_) {
    // /etc/shells may not exist
  }

  const shells = [];
  for (const shellPath of shellPaths) {
    if (fs.existsSync(shellPath)) {
      const name = path.basename(shellPath);
      shells.push({
        id: name,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        path: shellPath,
        available: true,
        is_default: shellPath === defaultShell,
      });
    }
  }

  // Deduplicate by path
  const seen = new Set();
  return shells.filter((s) => {
    if (seen.has(s.path)) return false;
    seen.add(s.path);
    return true;
  });
}

/**
 * Return a list of available terminal emulators (for "Open in Terminal" feature).
 */
export async function getAvailableTerminals() {
  const platform = os.platform();
  const terminals = [];

  if (platform === 'darwin') {
    // Terminal.app moved to /System/Applications on modern macOS; keep legacy path for older releases
    const terminalPath = [
      '/System/Applications/Utilities/Terminal.app',
      '/Applications/Utilities/Terminal.app',
    ].find((p) => fs.existsSync(p));
    if (terminalPath) {
      terminals.push({
        id: 'terminal',
        name: 'Terminal',
        path: terminalPath,
        available: true,
        is_default: true,
      });
    }
    const itermPath = '/Applications/iTerm.app';
    if (fs.existsSync(itermPath)) {
      terminals.push({
        id: 'iterm2',
        name: 'iTerm2',
        path: itermPath,
        available: true,
        is_default: false,
      });
    }
  } else if (platform === 'win32') {
    terminals.push({ id: 'cmd', name: 'Command Prompt', path: 'cmd.exe', available: true, is_default: true });
    terminals.push({ id: 'powershell', name: 'PowerShell', path: 'powershell.exe', available: true, is_default: false });
  } else {
    // Linux: probe common terminal emulators
    const candidates = [
      { id: 'gnome-terminal', name: 'GNOME Terminal', path: 'gnome-terminal' },
      { id: 'konsole', name: 'Konsole', path: 'konsole' },
      { id: 'xterm', name: 'xterm', path: 'xterm' },
      { id: 'xfce4-terminal', name: 'XFCE4 Terminal', path: 'xfce4-terminal' },
      { id: 'alacritty', name: 'Alacritty', path: 'alacritty' },
    ];
    for (const t of candidates) {
      try {
        await execFileAsync('which', [t.path]);
        terminals.push({ ...t, available: true, is_default: terminals.length === 0 });
      } catch (_) {
        // Not found
      }
    }
  }

  return terminals;
}

// ============================================================================
// Process management
// ============================================================================

/**
 * Return basic info about a process by PID.
 * Returns null if the process doesn't exist.
 */
export async function getProcessInfo(pid) {
  try {
    process.kill(pid, 0); // Throws if process doesn't exist
    return { pid, name: '', cpuUsage: 0, memoryUsage: 0 };
  } catch (_) {
    return null;
  }
}

/**
 * Kill a process by PID (SIGTERM).
 */
export async function killProcess(pid) {
  try {
    if (os.platform() === 'win32') {
      await execFileAsync('taskkill', ['/PID', String(pid)], { timeout: 15000, windowsHide: true });
      return;
    }
    process.kill(pid, 'SIGTERM');
  } catch (err) {
    throw new Error(`Failed to kill process ${pid}: ${err.message}`);
  }
}

/**
 * Kill a process by PID (SIGKILL / taskkill /F on Windows).
 */
export async function killProcessForce(pid) {
  try {
    if (os.platform() === 'win32') {
      await execFileAsync('taskkill', ['/F', '/PID', String(pid)], {
        timeout: 15000,
        windowsHide: true,
      });
      return;
    }
    process.kill(pid, 'SIGKILL');
  } catch (err) {
    throw new Error(`Failed to force-kill process ${pid}: ${err.message}`);
  }
}

// ============================================================================
// Port listing
// ============================================================================

/**
 * List TCP ports in LISTEN state with enriched metadata (project, framework, Docker, uptime, …).
 * @param {{ showAll?: boolean }} [options] - If showAll is false, keep only dev-like listeners (port-whisperer-style).
 * @returns {Promise<Array>} Port rows for the UI / API.
 */
export async function listPorts(options = {}) {
  const { showAll = true } = options;
  try {
    const raw =
      os.platform() === 'win32' ? await listPortsWindowsRaw() : await listPortsUnixRaw();
    let enriched = await enrichListeningPorts(raw);
    if (!showAll) {
      enriched = enriched.filter((row) => isDevProcess(row.process, row.command || ''));
    }
    return enriched.sort((a, b) => a.port - b.port);
  } catch (err) {
    console.warn('[System] listPorts failed:', err.message);
    return [];
  }
}

async function listPortsUnixRaw() {
  const platform = os.platform();
  /** @type {Map<number, { port: number, pid: number, process: string, protocol: string }>} */
  const portMap = new Map();

  if (platform !== 'darwin') {
    try {
      const { stdout } = await execFileAsync('ss', ['-tlnp']);
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
      /* fall through to lsof */
    }
  }

  try {
    const { stdout } = await execFileAsync('lsof', ['-iTCP', '-sTCP:LISTEN', '-n', '-P']);
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
  } catch (err) {
    console.warn('[System] Port listing failed:', err.message);
  }

  return [...portMap.values()];
}

async function listPortsWindowsRaw() {
  /** @type {Map<number, { port: number, pid: number, process: string, protocol: string }>} */
  const portMap = new Map();
  try {
    const { stdout } = await execFileAsync('netstat', ['-ano']);
    for (const line of stdout.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] !== 'TCP' || parts[3] !== 'LISTENING') continue;
      const portMatch = parts[1].match(/:(\d+)$/);
      if (!portMatch) continue;
      const port = parseInt(portMatch[1], 10);
      const pid = parseInt(parts[4], 10);
      if (port > 0 && !portMap.has(port)) {
        portMap.set(port, { port, pid, process: '', protocol: 'tcp' });
      }
    }
  } catch (err) {
    console.warn('[System] Windows port listing failed:', err.message);
  }
  return [...portMap.values()];
}

// ============================================================================
// Log path utilities
// ============================================================================

const LOG_DIR = path.join(os.homedir(), '.rebebuca', 'logs');

/**
 * Generate a log file path for a task run.
 * Returns { logFilename, logPath }.
 */
export async function generateLogPath(taskId, pid) {
  const timestamp = Date.now();
  const suffix = pid ? `_pid${pid}` : '';
  const logFilename = `task_${taskId}_${timestamp}${suffix}.log`;
  const logPath = path.join(LOG_DIR, logFilename);
  return { logFilename, logPath };
}

/**
 * Rename a log file with updated task ID / PID.
 */
export async function renameLogFile(oldFilename, taskId, pid) {
  const oldPath = path.join(LOG_DIR, oldFilename);
  const timestamp = Date.now();
  const newFilename = `task_${taskId}_${timestamp}_pid${pid}.log`;
  const newPath = path.join(LOG_DIR, newFilename);
  try {
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }
  } catch (_) {
    // Best effort
  }
  return newFilename;
}

/**
 * Read a task log file content by filename.
 * Returns UTF-8 text content, or empty string if file is missing.
 */
export async function readLogFile(logFilename) {
  if (!logFilename) {
    return '';
  }

  const logPath = path.join(LOG_DIR, logFilename);
  try {
    if (!fs.existsSync(logPath)) {
      return '';
    }
    return fs.readFileSync(logPath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read log file ${logFilename}: ${err.message}`);
  }
}

// ============================================================================
// Other system operations
// ============================================================================

/**
 * Open a URL in the default browser.
 */
export async function openExternal(url) {
  const platform = os.platform();
  if (platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  } else if (platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * Prefix command with a cwd change appropriate for the target shell.
 * Windows cmd.exe does not treat single quotes like POSIX shells — the old POSIX-only
 * cd broke "open in system terminal" so only an empty cmd window appeared.
 *
 * @param {'posix'|'cmd'|'powershell'} cwdStyle
 */
function buildTerminalCommand(command, cwd, cwdStyle = 'posix') {
  if (!cwd) return command;
  if (cwdStyle === 'powershell') {
    const lit = String(cwd).replace(/'/g, "''");
    return `Set-Location -LiteralPath '${lit}'; ${command}`;
  }
  if (cwdStyle === 'cmd') {
    const escaped = String(cwd).replace(/"/g, '""');
    return `cd /d "${escaped}" && ${command}`;
  }
  return `cd ${shellQuote(cwd)}; ${command}`;
}

/** Merge caller env overrides into process.env for detached spawns */
function mergeSpawnEnv(extraEnv) {
  const merged = { ...process.env };
  if (!extraEnv || typeof extraEnv !== 'object') return merged;
  for (const [k, v] of Object.entries(extraEnv)) {
    if (v === undefined || v === null) continue;
    merged[k] = typeof v === 'string' ? v : String(v);
  }
  return merged;
}

function escapeAppleScriptString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Open a command in the system terminal.
 * @param {Record<string, string>} [extraEnv] Optional env vars merged into the spawned process (and children).
 */
export async function openInSystemTerminal(command, cwd, extraEnv) {
  const platform = os.platform();
  const cwdStyle = platform === 'win32' ? 'cmd' : 'posix';
  const finalCommand = buildTerminalCommand(command, cwd, cwdStyle);
  const spawnEnv = mergeSpawnEnv(extraEnv);

  if (platform === 'darwin') {
    const script = [
      'tell application "Terminal"',
      '  activate',
      `  do script "${escapeAppleScriptString(finalCommand)}"`,
      'end tell',
    ].join('\n');
    spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore', env: spawnEnv }).unref();
    return;
  }

  if (platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', 'cmd.exe', '/k', finalCommand], {
      detached: true,
      stdio: 'ignore',
      env: spawnEnv,
      windowsHide: true,
    }).unref();
    return;
  }

  // Linux default: x-terminal-emulator is the most portable entrypoint.
  spawn('x-terminal-emulator', ['-e', finalCommand], { detached: true, stdio: 'ignore', env: spawnEnv }).unref();
}

/**
 * Open a command in a specific terminal emulator.
 * @param {Record<string, string>} [extraEnv] Optional env vars merged into the spawned process.
 */
export async function openInSpecificTerminal(terminalId, command, cwd, extraEnv) {
  const platform = os.platform();
  const spawnEnv = mergeSpawnEnv(extraEnv);

  if (platform === 'darwin') {
    const finalCommand = buildTerminalCommand(command, cwd, 'posix');
    if (terminalId === 'iterm2') {
      const script = [
        'tell application "iTerm"',
        '  activate',
        '  if (count of windows) = 0 then',
        '    create window with default profile',
        '  end if',
        `  tell current session of current window to write text "${escapeAppleScriptString(finalCommand)}"`,
        'end tell',
      ].join('\n');
      spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore', env: spawnEnv }).unref();
      return;
    }

    // Fallback to default Terminal.app for unknown terminal IDs on macOS.
    await openInSystemTerminal(command, cwd, extraEnv);
    return;
  }

  if (platform === 'win32') {
    const cwdStyle = terminalId === 'powershell' || terminalId === 'pwsh' ? 'powershell' : 'cmd';
    const finalCommand = buildTerminalCommand(command, cwd, cwdStyle);
    if (terminalId === 'powershell' || terminalId === 'pwsh') {
      const shellExe = terminalId === 'pwsh' ? 'pwsh.exe' : 'powershell.exe';
      spawn('cmd', ['/c', 'start', '', shellExe, '-NoExit', '-Command', finalCommand], {
        detached: true,
        stdio: 'ignore',
        env: spawnEnv,
        windowsHide: true,
      }).unref();
      return;
    }
    spawn('cmd', ['/c', 'start', '', 'cmd.exe', '/k', finalCommand], {
      detached: true,
      stdio: 'ignore',
      env: spawnEnv,
      windowsHide: true,
    }).unref();
    return;
  }

  const finalCommand = buildTerminalCommand(command, cwd, 'posix');
  // Linux common terminals
  const linuxTerminalArgs = {
    'gnome-terminal': ['--', 'bash', '-lc', finalCommand],
    konsole: ['-e', 'bash', '-lc', finalCommand],
    'xfce4-terminal': ['--command', `bash -lc ${shellQuote(finalCommand)}`],
    xterm: ['-e', 'bash', '-lc', finalCommand],
    alacritty: ['-e', 'bash', '-lc', finalCommand],
  };
  const args = linuxTerminalArgs[terminalId];
  if (args) {
    spawn(terminalId, args, { detached: true, stdio: 'ignore', env: spawnEnv }).unref();
    return;
  }

  await openInSystemTerminal(command, cwd, extraEnv);
}

/**
 * Execute a command with elevated privileges.
 * Returns { success, stdout, stderr }.
 */
export async function executeWithAdmin(command, args) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args);
    return { success: true, stdout: stdout || '', stderr: stderr || '' };
  } catch (err) {
    return {
      success: false,
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || 'Command failed',
    };
  }
}

/**
 * Full-disk access check (macOS-specific). Always true on other platforms.
 */
export async function checkFullDiskAccess() {
  return true;
}

/**
 * Open full-disk access settings (macOS-specific). No-op elsewhere.
 */
export async function openFullDiskAccessSettings() {
  // No-op
}
