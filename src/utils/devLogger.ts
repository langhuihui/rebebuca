/**
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  source: 'frontend' | 'tauri';
  message: string;
  data?: any;
}

// Max logs to keep in memory
const MAX_LOGS = 1000;

// In-memory log storage
const logEntries: LogEntry[] = [];

// Original console methods
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

/**
 * Format any value to string for logging
 */
function formatValue(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack || ''}`;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Format multiple arguments to a single message
 */
function formatArgs(args: any[]): string {
  return args.map(formatValue).join(' ');
}

/**
 * Add a log entry
 */
function addLogEntry(level: LogLevel, source: 'frontend' | 'tauri', args: any[]) {
  const entry: LogEntry = {
    timestamp: new Date(),
    level,
    source,
    message: formatArgs(args),
  };
  
  logEntries.push(entry);
  
  // Keep only last MAX_LOGS entries
  while (logEntries.length > MAX_LOGS) {
    logEntries.shift();
  }
}

/**
 * Initialize the dev logger by intercepting console methods
 */
export function initDevLogger() {
  // Intercept console.log
  console.log = (...args: any[]) => {
    addLogEntry('info', 'frontend', args);
    originalConsole.log(...args);
  };
  
  // Intercept console.info
  console.info = (...args: any[]) => {
    addLogEntry('info', 'frontend', args);
    originalConsole.info(...args);
  };
  
  // Intercept console.warn
  console.warn = (...args: any[]) => {
    addLogEntry('warn', 'frontend', args);
    originalConsole.warn(...args);
  };
  
  // Intercept console.error
  console.error = (...args: any[]) => {
    addLogEntry('error', 'frontend', args);
    originalConsole.error(...args);
  };
  
  // Intercept console.debug
  console.debug = (...args: any[]) => {
    addLogEntry('debug', 'frontend', args);
    originalConsole.debug(...args);
  };
  
  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    addLogEntry('error', 'frontend', [
      `Uncaught Error: ${event.message}`,
      `at ${event.filename}:${event.lineno}:${event.colno}`,
    ]);
  });
  
  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    addLogEntry('error', 'frontend', [
      'Unhandled Promise Rejection:',
      event.reason,
    ]);
  });
  
  console.info('[DevLogger] Initialized');
}

/**
 * Get all log entries
 */
export function getLogEntries(): LogEntry[] {
  return [...logEntries];
}

/**
 * Get filtered log entries
 */
export function getFilteredLogs(options: {
  level?: LogLevel[];
  source?: ('frontend' | 'tauri')[];
  search?: string;
  startTime?: Date;
  endTime?: Date;
}): LogEntry[] {
  return logEntries.filter(entry => {
    if (options.level && options.level.length > 0 && !options.level.includes(entry.level)) {
      return false;
    }
    if (options.source && options.source.length > 0 && !options.source.includes(entry.source)) {
      return false;
    }
    if (options.search && !entry.message.toLowerCase().includes(options.search.toLowerCase())) {
      return false;
    }
    if (options.startTime && entry.timestamp < options.startTime) {
      return false;
    }
    if (options.endTime && entry.timestamp > options.endTime) {
      return false;
    }
    return true;
  });
}

/**
 * Clear all logs
 */
export function clearLogs() {
  logEntries.length = 0;
}

/**
 * Export logs as JSON string
 */
export function exportLogsAsJson(): string {
  return JSON.stringify(logEntries, (_key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }, 2);
}

/**
 * Export logs as plain text
 */
export function exportLogsAsText(): string {
  return logEntries.map(entry => {
    const time = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const source = entry.source.padEnd(8);
    return `[${time}] [${level}] [${source}] ${entry.message}`;
  }).join('\n');
}

/**
 * Log from Tauri backend (called via event listener)
 */
export function logFromTauri(level: LogLevel, message: string) {
  addLogEntry(level, 'tauri', [message]);
}
