/**
 * Circular buffer of backend log lines (shared by HTTP /api/logs and MCP debug tools).
 */

export const SERVER_LOG_BUFFER_LIMIT = 2000;

const serverLogs = [];
let serverLogSeq = 0;

const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

function formatLogArg(arg) {
  if (arg instanceof Error) {
    return `${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`;
  }
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

export function appendServerLog(level, args, source = 'backend') {
  const entry = {
    id: ++serverLogSeq,
    timestamp: new Date().toISOString(),
    level,
    source,
    message: args.map(formatLogArg).join(' '),
  };
  serverLogs.push(entry);
  if (serverLogs.length > SERVER_LOG_BUFFER_LIMIT) {
    serverLogs.splice(0, serverLogs.length - SERVER_LOG_BUFFER_LIMIT);
  }
}

export function getServerLogsTail(limit = 500) {
  const n = Math.min(Math.max(1, limit), SERVER_LOG_BUFFER_LIMIT);
  return serverLogs.slice(-n);
}

export function clearServerLogs() {
  serverLogs.length = 0;
}

/**
 * Patch global console.* to also append to buffer (once).
 */
export function installBackendLogCapture() {
  if (globalThis.__REBEBUCA_LOG_CAPTURE_INSTALLED__) return;
  globalThis.__REBEBUCA_LOG_CAPTURE_INSTALLED__ = true;

  console.log = (...args) => {
    originalConsole.log(...args);
    appendServerLog('info', args);
  };
  console.info = (...args) => {
    originalConsole.info(...args);
    appendServerLog('info', args);
  };
  console.warn = (...args) => {
    originalConsole.warn(...args);
    appendServerLog('warn', args);
  };
  console.error = (...args) => {
    originalConsole.error(...args);
    appendServerLog('error', args);
  };
  console.debug = (...args) => {
    originalConsole.debug(...args);
    appendServerLog('debug', args);
  };
}
