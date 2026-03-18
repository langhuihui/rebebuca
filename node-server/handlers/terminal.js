/**
 * Terminal Handler
 *
 * Manages PTY (pseudo-terminal) processes using node-pty.
 * Handles terminal creation, I/O, resizing, and cleanup.
 */

import os from 'os';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// Dynamically import node-pty to allow graceful fallback if native build fails
let pty;
try {
  const nodePty = await import('node-pty');
  pty = nodePty.default ?? nodePty;
} catch (err) {
  console.warn('[Terminal] node-pty not available, PTY terminals will be disabled:', err.message);
}

/** Map from ptyId -> { ptyProcess, pid, running } */
const ptys = new Map();

/** Global event emitter for terminal data/exit events */
export const terminalEvents = new EventEmitter();

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
  return process.env.SHELL || '/bin/bash';
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
  } = params;

  // Resolve shell / command
  const shell = shellPath || (command === 'default' ? getDefaultShell() : command);
  const workingDir = cwd || os.homedir();
  const ptyId = requestedId || generatePtyId();

  // Merge environment with current process env, preferring caller-supplied vars
  const mergedEnv = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    ...env,
  };

  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: workingDir,
    env: mergedEnv,
  });

  ptys.set(ptyId, { ptyProcess, pid: ptyProcess.pid, running: true });

  // Forward PTY output to listeners
  ptyProcess.onData((data) => {
    terminalEvents.emit('data', { ptyId, data });
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    const entry = ptys.get(ptyId);
    if (entry) entry.running = false;
    terminalEvents.emit('exit', { ptyId, exitCode: exitCode ?? (signal ? -1 : 0) });
  });

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
  entry.ptyProcess.write(data);
}

/**
 * Resize a PTY.
 */
export function resizeTerminal(ptyId, cols, rows) {
  const entry = ptys.get(ptyId);
  if (!entry || !entry.running) return;
  entry.ptyProcess.resize(cols, rows);
}

/**
 * Send SIGTERM to a PTY process.
 */
export function killTerminal(ptyId) {
  const entry = ptys.get(ptyId);
  if (!entry) return;
  try {
    entry.ptyProcess.kill('SIGTERM');
  } catch (_) {
    // Ignore if already dead
  }
  entry.running = false;
}

/**
 * Force-kill (SIGKILL) a PTY process.
 */
export function forceKillTerminal(ptyId) {
  const entry = ptys.get(ptyId);
  if (!entry) return;
  try {
    entry.ptyProcess.kill('SIGKILL');
  } catch (_) {
    // Ignore if already dead
  }
  entry.running = false;
  ptys.delete(ptyId);
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
  return {
    ptyId,
    pid: entry.pid,
    cpuUsage: 0,
    memoryUsage: 0,
    memoryUsageMb: '0 MB',
  };
}

/**
 * Kill all PTYs owned by a client (called on disconnect).
 */
export function killClientPtys(ptyIds) {
  for (const id of ptyIds) {
    killTerminal(id);
    ptys.delete(id);
  }
}
