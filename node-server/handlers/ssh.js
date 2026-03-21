/**
 * SSH handler (server mode) — remote exec via ssh2, streams as terminal.data / terminal.exit
 */

import { readFileSync, existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { Client } from 'ssh2';
import { terminalEvents } from './terminal.js';
import { get as storageGet } from './storage.js';

/** @type {Map<string, import('ssh2').Client>} */
const connectionPools = new Map();

/** @type {Map<string, { stream: import('stream').Readable & { close?: () => void }; conn: import('ssh2').Client; closeConnWhenDone: boolean }>} */
const executions = new Map();

function expandHome(p) {
  if (p == null || typeof p !== 'string') return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

function getStoredConfigs() {
  const raw = storageGet('ssh_configs');
  return Array.isArray(raw) ? raw : [];
}

function resolveStoredConfig(configId) {
  const list = getStoredConfigs();
  const c = list.find((x) => x.id === configId);
  if (!c) {
    throw new Error(`SSH config not found: ${configId}`);
  }
  return c;
}

function authFromConfig(config) {
  const a = config.auth;
  if (!a || !a.type) {
    throw new Error('SSH config missing auth');
  }
  if (a.type === 'password') {
    return { password: a.password || '' };
  }
  if (a.type === 'privateKey') {
    const kp = expandHome(a.key_path);
    if (!kp || !existsSync(kp)) {
      throw new Error(`Private key not found: ${a.key_path || '(empty)'}`);
    }
    const out = { privateKey: readFileSync(kp) };
    if (a.passphrase) {
      out.passphrase = a.passphrase;
    }
    return out;
  }
  throw new Error(`Unsupported SSH auth type: ${a.type}`);
}

function connectOptionsFromConfig(config) {
  const intervalSec = config.keepAliveInterval ?? 60;
  return {
    host: config.host,
    port: Number(config.port) || 22,
    username: config.username,
    readyTimeout: 20000,
    keepaliveInterval: Math.max(10, intervalSec) * 1000,
    ...authFromConfig(config),
  };
}

/**
 * @param {object} config
 * @returns {Promise<import('ssh2').Client>}
 */
export function connectPromise(config) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const timer = setTimeout(() => {
      conn.removeAllListeners();
      try {
        conn.end();
      } catch {
        // ignore
      }
      reject(new Error('SSH connection timeout'));
    }, 25000);

    conn.once('ready', () => {
      clearTimeout(timer);
      resolve(conn);
    });
    conn.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    try {
      conn.connect(connectOptionsFromConfig(config));
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

function shellSingleQuote(s) {
  return `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
}

function buildRemoteCommand(command, args, cwd, env) {
  const pieces = [];
  if (cwd) {
    pieces.push(`cd ${shellSingleQuote(cwd)}`);
  }
  if (env && typeof env === 'object') {
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined || v === null) continue;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) continue;
      pieces.push(`export ${k}=${shellSingleQuote(String(v))}`);
    }
  }
  const cmdLine =
    args && args.length > 0
      ? [command, ...args].map(shellSingleQuote).join(' ')
      : String(command || '');
  pieces.push(cmdLine);
  return pieces.join(' && ');
}

/** POSIX sh -c with JSON-quoted script body */
function wrapRemoteScript(inner) {
  return `sh -c ${JSON.stringify(inner)}`;
}

/**
 * @param {object} params
 * @param {object} params.config - full saved or inline SSH config
 * @param {string} params.command
 * @param {string[]} [params.args]
 * @param {string} [params.cwd]
 * @param {Record<string,string>} [params.env]
 * @param {string} [params.configId] - if set, used for pool / keepConnection; omit for pure inline
 */
export function executeWithConfig(params) {
  const execId = `ssh-exec-${randomUUID()}`;
  const { config, command, args, cwd, env, configId } = params;

  (async () => {
    let conn;
    let closeConnWhenDone = false;

    try {
      const keep = !!config.keepConnection;
      if (configId && connectionPools.has(configId)) {
        conn = connectionPools.get(configId);
      } else {
        conn = await connectPromise(config);
        if (configId && keep) {
          connectionPools.set(configId, conn);
          conn.once('close', () => {
            if (connectionPools.get(configId) === conn) {
              connectionPools.delete(configId);
            }
          });
        } else {
          closeConnWhenDone = true;
        }
      }

      const inner = buildRemoteCommand(command, args, cwd, env);
      const remoteCmd = wrapRemoteScript(inner);

      conn.exec(remoteCmd, (err, stream) => {
        if (err) {
          terminalEvents.emit('data', {
            ptyId: execId,
            data: `\r\n[SSH] ${err.message}\r\n`,
          });
          terminalEvents.emit('exit', { ptyId: execId, exitCode: 1 });
          finishConn(conn, configId, config, closeConnWhenDone);
          return;
        }

        executions.set(execId, { stream, conn, closeConnWhenDone: false });

        stream.on('data', (buf) => {
          terminalEvents.emit('data', { ptyId: execId, data: buf.toString('utf8') });
        });
        stream.stderr.on('data', (buf) => {
          terminalEvents.emit('data', { ptyId: execId, data: buf.toString('utf8') });
        });
        stream.on('close', (code, signal) => {
          executions.delete(execId);
          const exitCode = code != null ? code : signal ? -1 : 0;
          terminalEvents.emit('exit', { ptyId: execId, exitCode });
          finishConn(conn, configId, config, closeConnWhenDone);
        });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      terminalEvents.emit('data', { ptyId: execId, data: `\r\n[SSH] ${msg}\r\n` });
      terminalEvents.emit('exit', { ptyId: execId, exitCode: 1 });
    }
  })();

  return execId;
}

/**
 * @param {import('ssh2').Client} conn
 * @param {string} [configId]
 * @param {object} config
 * @param {boolean} closeConnWhenDone
 */
function finishConn(conn, configId, config, closeConnWhenDone) {
  if (!conn) return;
  const keep = !!config.keepConnection;
  if (closeConnWhenDone) {
    if (configId && connectionPools.get(configId) === conn) {
      connectionPools.delete(configId);
    }
    try {
      conn.end();
    } catch {
      // ignore
    }
    return;
  }
  if (!keep && configId && connectionPools.get(configId) === conn) {
    connectionPools.delete(configId);
    try {
      conn.end();
    } catch {
      // ignore
    }
  }
}

export function executeByConfigId(params) {
  const config = resolveStoredConfig(params.configId);
  return executeWithConfig({
    config,
    configId: params.configId,
    command: params.command,
    args: params.args,
    cwd: params.cwd,
    env: params.env,
  });
}

/** Run config / one-off: full config object without storage id */
export function executeInline(params) {
  return executeWithConfig({
    config: params.config,
    command: params.command,
    args: params.args,
    cwd: params.cwd,
    env: params.env,
  });
}

export async function poolConnect(configId) {
  if (connectionPools.has(configId)) {
    return;
  }
  const config = resolveStoredConfig(configId);
  const conn = await connectPromise(config);
  connectionPools.set(configId, conn);
  conn.on('close', () => {
    if (connectionPools.get(configId) === conn) {
      connectionPools.delete(configId);
    }
  });
}

export function poolDisconnect(configId) {
  const conn = connectionPools.get(configId);
  if (conn) {
    connectionPools.delete(configId);
    try {
      conn.end();
    } catch {
      // ignore
    }
  }
}

export function killExecution(execId) {
  const ex = executions.get(execId);
  if (!ex) {
    return;
  }
  try {
    if (typeof ex.stream.close === 'function') {
      ex.stream.close();
    }
  } catch {
    // ignore
  }
  executions.delete(execId);
}

export async function testWithConfig(config) {
  const conn = await connectPromise(config);
  try {
    await new Promise((resolve, reject) => {
      conn.exec('echo ok', (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        stream.on('data', () => {});
        stream.stderr.on('data', () => {});
        stream.on('close', (code) => {
          if (code === 0) resolve(undefined);
          else reject(new Error(`Remote command exited with code ${code}`));
        });
      });
    });
  } finally {
    try {
      conn.end();
    } catch {
      // ignore
    }
  }
  return 'ok';
}

export async function probeConfigId(configId) {
  const config = resolveStoredConfig(configId);
  const fromPool = connectionPools.has(configId);
  let conn;
  if (fromPool) {
    conn = connectionPools.get(configId);
  } else {
    conn = await connectPromise(config);
  }

  return new Promise((resolve, reject) => {
    conn.exec('true', (err, stream) => {
      if (err) {
        if (!fromPool) {
          try {
            conn.end();
          } catch {
            // ignore
          }
        }
        reject(err);
        return;
      }
      stream.on('data', () => {});
      stream.stderr.on('data', () => {});
      stream.on('close', (code) => {
        if (!fromPool) {
          try {
            conn.end();
          } catch {
            // ignore
          }
        }
        resolve(code === 0);
      });
    });
  });
}

async function withConnectionForConfigId(configId, fn) {
  const fromPool = connectionPools.has(configId);
  let conn;
  if (fromPool) {
    conn = connectionPools.get(configId);
  } else {
    const config = resolveStoredConfig(configId);
    conn = await connectPromise(config);
  }
  try {
    return await fn(conn);
  } finally {
    if (!fromPool) {
      try {
        conn.end();
      } catch {
        // ignore
      }
    }
  }
}

export async function listDirectory(configId, remotePath) {
  const dir = remotePath || '.';
  return withConnectionForConfigId(configId, (conn) => {
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }
        sftp.readdir(dir, (e, list) => {
          if (e) {
            reject(e);
            return;
          }
          const base = dir.endsWith('/') ? dir.slice(0, -1) : dir;
          const out = (list || []).map((entry) => {
            const name = entry.filename;
            const full =
              base === '' || base === '.' ? name : `${base}/${name}`.replace(/\/+/g, '/');
            return {
              name,
              path: full,
              is_dir: entry.attrs.isDirectory(),
              size: entry.attrs.size,
            };
          });
          resolve(out);
        });
      });
    });
  });
}

export async function getHomeDirectory(configId) {
  return withConnectionForConfigId(configId, (conn) => {
    return new Promise((resolve, reject) => {
      const cmd = wrapRemoteScript('echo -n "$HOME"');
      conn.exec(cmd, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        let buf = '';
        stream.on('data', (d) => {
          buf += d.toString('utf8');
        });
        stream.stderr.on('data', () => {});
        stream.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`getHomeDirectory failed with code ${code}`));
            return;
          }
          resolve(buf.trim() || '/');
        });
      });
    });
  });
}

const DEFAULT_SHELLS = ['/bin/bash', '/bin/sh', '/usr/bin/bash', '/usr/bin/sh'];

export async function getRemoteShells(configId) {
  const text = await withConnectionForConfigId(configId, (conn) => {
    return new Promise((resolve, reject) => {
      conn.exec(
        wrapRemoteScript(
          'command -v getent >/dev/null 2>&1 && getent shells || cat /etc/shells 2>/dev/null || true',
        ),
        (err, stream) => {
          if (err) {
            reject(err);
            return;
          }
          let buf = '';
          stream.on('data', (d) => {
            buf += d.toString('utf8');
          });
          stream.stderr.on('data', () => {});
          stream.on('close', () => resolve(buf));
        },
      );
    });
  });

  const paths = new Set(DEFAULT_SHELLS);
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t.startsWith('#') || !t) continue;
    if (t.startsWith('/')) paths.add(t);
  }
  return [...paths].sort().map((p, i) => ({
    id: p,
    name: path.basename(p) || p,
    path: p,
    is_default: i === 0,
  }));
}
