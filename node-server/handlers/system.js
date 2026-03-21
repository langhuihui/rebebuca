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
    process.kill(pid, 'SIGTERM');
  } catch (err) {
    throw new Error(`Failed to kill process ${pid}: ${err.message}`);
  }
}

/**
 * Kill a process by PID (SIGKILL).
 */
export async function killProcessForce(pid) {
  try {
    process.kill(pid, 'SIGKILL');
  } catch (err) {
    throw new Error(`Failed to force-kill process ${pid}: ${err.message}`);
  }
}

// ============================================================================
// Port listing
// ============================================================================

/**
 * List TCP ports that are in LISTEN state along with their owning process.
 * Returns an array of { port, pid, process, protocol }.
 */
export async function listPorts() {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      return await listPortsWindows();
    } else {
      return await listPortsUnix();
    }
  } catch (err) {
    console.warn('[System] listPorts failed:', err.message);
    return [];
  }
}

async function listPortsUnix() {
  const platform = os.platform();
  const ports = [];

  try {
    // Try ss first (Linux), then lsof (macOS/Linux)
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
          const pidMatch = line.match(/pid=(\d+)/);
          const procMatch = line.match(/users:\(\("([^"]+)"/);
          if (port > 0) {
            ports.push({
              port,
              pid: pidMatch ? parseInt(pidMatch[1], 10) : 0,
              process: procMatch ? procMatch[1] : '',
              protocol: 'tcp',
            });
          }
        }
        return ports;
      } catch (_) {
        // Fall through to lsof
      }
    }

    // lsof fallback
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
      if (port > 0) {
        ports.push({ port, pid, process: processName, protocol: 'tcp' });
      }
    }
  } catch (err) {
    console.warn('[System] Port listing failed:', err.message);
  }

  return ports;
}

async function listPortsWindows() {
  const ports = [];
  try {
    const { stdout } = await execFileAsync('netstat', ['-ano']);
    for (const line of stdout.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] !== 'TCP' || parts[3] !== 'LISTENING') continue;
      const portMatch = parts[1].match(/:(\d+)$/);
      if (!portMatch) continue;
      const port = parseInt(portMatch[1], 10);
      const pid = parseInt(parts[4], 10);
      if (port > 0) {
        ports.push({ port, pid, process: '', protocol: 'tcp' });
      }
    }
  } catch (err) {
    console.warn('[System] Windows port listing failed:', err.message);
  }
  return ports;
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

/**
 * Open a command in the system terminal.
 * In web/server mode this is a no-op (users have their own terminal).
 */
export async function openInSystemTerminal(_command, _cwd) {
  // No-op in server mode – the user's browser cannot open a local terminal window.
}

/**
 * Open a command in a specific terminal emulator.
 */
export async function openInSpecificTerminal(_terminalId, _command, _cwd) {
  // No-op in server mode
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
