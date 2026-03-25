/**
 * Rebebuca Node.js Server
 *
 * Serves the pre-built Vue 3 frontend as static files and implements
 * the WebSocket API that the frontend's ServerAdapter expects.
 *
 * WebSocket protocol:
 *   Client → Server: { id, method, params }
 *   Server → Client: { id, success, result? } | { id, success, error? }
 *   Server → Client (events): { event, data }
 */

import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, existsSync, statSync, readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { WebSocketServer } from 'ws';
import { lookup as mimeLookup } from 'mime-types';
import { randomUUID } from 'crypto';

// Handlers
import {
  createTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal,
  forceKillTerminal,
  isTerminalRunning,
  getTerminalProcessStats,
  listRunningPtySessions,
  getTerminalScrollback,
  terminalEvents,
} from './handlers/terminal.js';

import {
  readTextFile,
  readDir,
  exists,
  stat,
  writeTextFile,
  mkdir,
  remove,
} from './handlers/fs.js';

import {
  getPlatform,
  getArch,
  getHomeDirectory,
  getAvailableShells,
  getAvailableTerminals,
  getProcessInfo,
  killProcess,
  listPorts,
  generateLogPath,
  renameLogFile,
  readLogFile as systemReadLogFile,
  openExternal,
  openInSystemTerminal,
  openInSpecificTerminal,
  executeWithAdmin,
  checkFullDiskAccess,
  openFullDiskAccessSettings,
} from './handlers/system.js';

import { get as storageGet, set as storageSet, del as storageDel, save as storageSave } from './handlers/storage.js';

import {
  poolConnect as sshPoolConnect,
  poolDisconnect as sshPoolDisconnect,
  executeByConfigId as sshExecuteByConfigId,
  executeInline as sshExecuteInline,
  killExecution as sshKillExecution,
  testWithConfig as sshTestWithConfig,
  probeConfigId as sshProbeConfigId,
  listDirectory as sshListDirectory,
  getHomeDirectory as sshGetHomeDirectory,
  getRemoteShells as sshGetRemoteShells,
} from './handlers/ssh.js';

import {
  installBackendLogCapture,
  getServerLogsTailAsTextLines,
  clearServerLogs,
  SERVER_LOG_BUFFER_LIMIT,
} from './internal-log-buffer.js';
import { createMcpRequestHandler } from './mcp/mcp-http.js';
import * as mcpTaskStore from './mcp/task-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

installBackendLogCapture();

// ============================================================================
// Static file serving
// ============================================================================

const MIME_OVERRIDES = {
  '.mjs': 'application/javascript',
  '.cjs': 'application/javascript',
};

function serveStatic(staticDir) {
  return function handleStatic(req, res) {
    // Sanitize URL path to prevent directory traversal
    let urlPath = req.url.split('?')[0];

    // Normalize and resolve to an absolute path, then verify it stays within staticDir
    const resolvedStatic = path.resolve(staticDir);
    let filePath = path.resolve(staticDir, '.' + urlPath);

    // Reject if the resolved path escapes the static directory
    if (!filePath.startsWith(resolvedStatic + path.sep) && filePath !== resolvedStatic) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // Serve index.html for directory requests (SPA fallback)
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    // SPA fallback: if file not found, serve index.html
    if (!existsSync(filePath)) {
      filePath = path.join(staticDir, 'index.html');
    }

    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const mimeType =
      MIME_OVERRIDES[ext] || mimeLookup(filePath) || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': mimeType });
    createReadStream(filePath).pipe(res);
  };
}

// ============================================================================
// WebSocket message handling
// ============================================================================

/**
 * Handle a single request message from a WebSocket client.
 *
 * @param {string} clientId
 * @param {{ id: string, method: string, params: any }} request
 * @param {Set<string>} clientPtyIds - PTY IDs owned by this client
 * @returns {Promise<{ id: string, success: boolean, result?: any, error?: string }>}
 */
async function handleRequest(clientId, request, clientPtyIds) {
  const { id, method, params = {} } = request;

  try {
    let result;

    switch (method) {
      // ── Terminal ──────────────────────────────────────────────────────────
      case 'terminal.create': {
        const info = await createTerminal(params);
        clientPtyIds.add(info.ptyId);
        result = info;
        break;
      }
      case 'terminal.write':
        writeTerminal(params.ptyId, params.data);
        result = null;
        break;
      case 'terminal.resize':
        resizeTerminal(params.ptyId, params.cols, params.rows);
        result = null;
        break;
      case 'terminal.kill':
        killTerminal(params.ptyId);
        clientPtyIds.delete(params.ptyId);
        result = null;
        break;
      case 'terminal.forceKill':
        forceKillTerminal(params.ptyId);
        clientPtyIds.delete(params.ptyId);
        result = null;
        break;
      case 'terminal.isRunning':
        result = isTerminalRunning(params.ptyId);
        break;
      case 'terminal.getProcessStats':
        result = await getTerminalProcessStats(params.ptyId);
        break;
      case 'terminal.list':
        result = listRunningPtySessions();
        break;
      case 'terminal.getScrollback':
        result = getTerminalScrollback(params.ptyId);
        break;

      // ── File System ───────────────────────────────────────────────────────
      case 'fs.readTextFile':
        result = await readTextFile(params.path);
        break;
      case 'fs.readDir':
        result = await readDir(params.path);
        break;
      case 'fs.exists':
        result = await exists(params.path);
        break;
      case 'fs.stat':
        result = await stat(params.path);
        break;
      case 'fs.writeTextFile':
        await writeTextFile(params.path, params.content);
        result = null;
        break;
      case 'fs.mkdir':
        await mkdir(params.path, { recursive: params.recursive });
        result = null;
        break;
      case 'fs.remove':
        await remove(params.path, { recursive: params.recursive });
        result = null;
        break;

      // ── System ────────────────────────────────────────────────────────────
      case 'system.getPlatform':
        result = getPlatform();
        break;
      case 'system.getArch':
        result = getArch();
        break;
      case 'system.getHomeDirectory':
        result = getHomeDirectory();
        break;
      case 'system.getAvailableShells':
        result = await getAvailableShells();
        break;
      case 'system.getAvailableTerminals':
        result = await getAvailableTerminals();
        break;
      case 'system.getProcessInfo':
        result = await getProcessInfo(params.pid);
        break;
      case 'system.killProcess':
        await killProcess(params.pid);
        result = null;
        break;
      case 'system.listPorts':
        result = await listPorts();
        break;
      case 'system.generateLogPath':
        result = await generateLogPath(params.taskId, params.pid);
        break;
      case 'system.renameLogFile':
        result = await renameLogFile(params.oldFilename, params.taskId, params.pid);
        break;
      case 'system.readLogFile':
        result = await systemReadLogFile(params.logFilename);
        break;
      case 'system.openExternal':
        await openExternal(params.url);
        result = null;
        break;
      case 'system.openInSystemTerminal':
        await openInSystemTerminal(params.command, params.cwd);
        result = null;
        break;
      case 'system.openInSpecificTerminal':
        await openInSpecificTerminal(params.terminalId, params.command, params.cwd);
        result = null;
        break;
      case 'system.executeWithAdmin':
        result = await executeWithAdmin(params.command, params.args || []);
        break;
      case 'system.checkFullDiskAccess':
        result = await checkFullDiskAccess();
        break;
      case 'system.openFullDiskAccessSettings':
        await openFullDiskAccessSettings();
        result = null;
        break;

      // ── Storage ───────────────────────────────────────────────────────────
      case 'storage.get':
        result = storageGet(params.key);
        break;
      case 'storage.set':
        storageSet(params.key, params.value);
        result = null;
        break;
      case 'storage.delete':
        storageDel(params.key);
        result = null;
        break;
      case 'storage.save':
        storageSave();
        result = null;
        break;

      // ── SSH (remote exec on the machine running this server) ─────────────
      case 'ssh.poolConnect':
        await sshPoolConnect(params.configId);
        result = null;
        break;
      case 'ssh.poolDisconnect':
        sshPoolDisconnect(params.configId);
        result = null;
        break;
      case 'ssh.executeByConfigId':
        result = sshExecuteByConfigId(params);
        break;
      case 'ssh.executeInline':
        result = sshExecuteInline(params);
        break;
      case 'ssh.killExecution':
        sshKillExecution(params.execId);
        result = null;
        break;
      case 'ssh.testWithConfig':
        result = await sshTestWithConfig(params.config);
        break;
      case 'ssh.probeConfigId':
        result = await sshProbeConfigId(params.configId);
        break;
      case 'ssh.listDirectory':
        result = await sshListDirectory(params.configId, params.path);
        break;
      case 'ssh.getHomeDirectory':
        result = await sshGetHomeDirectory(params.configId);
        break;
      case 'ssh.getRemoteShells':
        result = await sshGetRemoteShells(params.configId);
        break;

      // ── Window (no-ops in web mode) ───────────────────────────────────────
      case 'window.minimize':
      case 'window.maximize':
      case 'window.close':
      case 'window.isMaximized':
      case 'window.setTitle':
      case 'window.show':
      case 'window.hide':
        result = method === 'window.isMaximized' ? false : null;
        break;

      // ── Notifications (handled by browser) ───────────────────────────────
      case 'notification.requestPermission':
        result = true;
        break;
      case 'notification.show':
        result = null;
        break;

      // ── Updater (npm-based) ───────────────────────────────────────────────
      case 'updater.checkForUpdates': {
        const pkgPath = path.resolve(__dirname, '..', 'package.json');
        let currentVersion = '0.0.0';
        try {
          const pkgRaw = await readFile(pkgPath, 'utf-8');
          const pkg = JSON.parse(pkgRaw);
          if (pkg && typeof pkg.version === 'string') currentVersion = pkg.version;
        } catch {
          // ignore
        }

        // Query npm registry for latest version
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        let latestVersion = currentVersion;
        try {
          const resp = await fetch('https://registry.npmjs.org/rebebuca/latest', {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data && typeof data.version === 'string') latestVersion = data.version;
          }
        } finally {
          clearTimeout(timeout);
        }

        const available = latestVersion && latestVersion !== currentVersion;
        result = {
          available,
          currentVersion,
          latestVersion,
          notes: available
            ? `Update via npm: npm i -g rebebuca@${latestVersion} (or run npx rebebuca@${latestVersion})`
            : '',
        };
        break;
      }
      case 'updater.downloadAndInstall': {
        // We can't self-update like desktop apps; guide users to update via npm in a system terminal.
        const targetVersion = params?.version;
        const versionPart = typeof targetVersion === 'string' && targetVersion.trim()
          ? `@${targetVersion.trim()}`
          : '@latest';
        const command = `npm i -g rebebuca${versionPart}`;
        try {
          await openInSystemTerminal(command, params?.cwd || process.cwd());
          result = {
            success: true,
            message: 'Opened system terminal to run npm update.',
          };
        } catch (e) {
          result = {
            success: false,
            message: e?.message || 'Failed to open system terminal for npm update.',
          };
        }
        break;
      }

      // ── Tray (no-op) ──────────────────────────────────────────────────────
      case 'tray.setIcon':
      case 'tray.setMenu':
        result = null;
        break;

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    return { id, success: true, result: result !== undefined ? result : null };
  } catch (err) {
    console.error(`[WS] Error handling ${method}:`, err.message);
    return { id, success: false, error: err.message };
  }
}

// ============================================================================
// Server creation
// ============================================================================

/**
 * Create and start the Rebebuca HTTP + WebSocket server.
 *
 * @param {object} options
 * @param {number}  [options.port=3000]        - Port to listen on
 * @param {string}  [options.host='127.0.0.1'] - Host to bind to
 * @param {string}  [options.staticDir]        - Path to built frontend files
 * @param {boolean} [options.enableMcp=true]   - Expose MCP routes on this server (/health, /mcp/*)
 * @returns {Promise<http.Server>}
 */
export async function createServer({
  port = 3000,
  host = '127.0.0.1',
  staticDir,
  enableMcp = true,
} = {}) {
  // Pre-built Nuxt UI for npx lives in web-public/ (npm "files"). Legacy: dist/server (Vite server build).
  const resolvedStaticDir =
    staticDir ||
    (() => {
      const webPublic = path.resolve(__dirname, '..', 'web-public');
      const legacy = path.resolve(__dirname, '..', 'dist', 'server');
      if (existsSync(path.join(webPublic, 'index.html'))) return webPublic;
      if (existsSync(path.join(legacy, 'index.html'))) return legacy;
      return webPublic;
    })();

  if (!existsSync(resolvedStaticDir)) {
    console.warn(
      `[Server] Static directory not found: ${resolvedStaticDir}\n` +
        '         Run "pnpm run build:server-app" first to build the frontend (outputs web-public/).',
    );
  }

  const staticHandler = serveStatic(resolvedStaticDir);

  function readPackageVersion() {
    try {
      const pkgPath = path.resolve(__dirname, '..', 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  const appVersion = readPackageVersion();
  const tryMcp = enableMcp ? createMcpRequestHandler(appVersion) : null;

  // Proxy GET /api/proxy?url=... to avoid CORS when fetching external JSON (e.g. notification.json)
  const NOTIFICATION_JSON_HOST = 'download.m7s.live';
  async function handleBackendLogsApi(req, res) {
    const parsed = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    if (parsed.pathname !== '/api/logs/backend') return false;

    if (req.method === 'GET') {
      const limitParam = Number(parsed.searchParams.get('limit') || '500');
      const limit = Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, SERVER_LOG_BUFFER_LIMIT)
        : 500;
      const logs = getServerLogsTailAsTextLines(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ logs }));
      return true;
    }

    if (req.method === 'DELETE') {
      clearServerLogs();
      res.writeHead(204);
      res.end();
      return true;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return true;
  }

  /** @type {{ port: number | null }} */
  const mcpRuntime = { port: null };

  async function handleMcpInfo(req, res) {
    const parsed = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    if (parsed.pathname !== '/api/mcp/info') return false;
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return true;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        mcpPort: mcpRuntime.port,
        mcpRunning: mcpRuntime.port != null,
      }),
    );
    return true;
  }

  async function handleMcpSyncTasks(req, res) {
    const parsed = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    if (parsed.pathname !== '/api/mcp/sync-tasks') return false;

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return true;
    }
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf8');
      const data = JSON.parse(raw || '{}');
      mcpTaskStore.setSyncedTasks(data.tasks);
      res.writeHead(204);
      res.end();
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
    return true;
  }

  async function handleProxy(req, res) {
    if (req.method !== 'GET') return false;
    const parsed = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    if (parsed.pathname !== '/api/proxy') return false;
    const targetUrl = parsed.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400);
      res.end('Missing url parameter');
      return true;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const proxyRes = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      // If notification.json is missing on CDN, return empty list so client does not warn
      const isNotificationUrl =
        proxyRes.status === 404 &&
        targetUrl.includes(NOTIFICATION_JSON_HOST) &&
        targetUrl.includes('notification.json');
      if (isNotificationUrl) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ notifications: [] }));
        return true;
      }
      res.writeHead(proxyRes.status, {
        'Content-Type': proxyRes.headers.get('Content-Type') || 'application/json',
      });
      const body = await proxyRes.arrayBuffer();
      res.end(Buffer.from(body));
    } catch (err) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: err.message || 'Proxy failed' }));
    }
    return true;
  }

  // Create HTTP server
  const httpServer = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Accept, mcp-session-id, mcp-protocol-version',
    );

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let handled =
      (await handleMcpInfo(req, res)) ||
      (await handleMcpSyncTasks(req, res)) ||
      (await handleBackendLogsApi(req, res)) ||
      (await handleProxy(req, res));
    if (!handled && tryMcp) {
      handled = await tryMcp(req, res);
    }
    if (!handled) staticHandler(req, res);
  });

  // Create WebSocket server (path: /ws)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    const clientId = `client-${randomUUID()}`;
    const clientPtyIds = new Set();

    console.log(`[WS] Client connected: ${clientId}`);

    // Forward terminal data events to this client
    const onData = (event) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ event: 'terminal.data', data: event }));
      }
    };
    const onExit = (event) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ event: 'terminal.exit', data: event }));
      }
    };

    terminalEvents.on('data', onData);
    terminalEvents.on('exit', onExit);

    ws.on('message', async (rawData) => {
      let request;
      try {
        request = JSON.parse(rawData.toString());
      } catch (err) {
        console.error('[WS] Failed to parse message:', err.message);
        return;
      }

      const response = await handleRequest(clientId, request, clientPtyIds);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(response));
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Client disconnected: ${clientId}`);
      terminalEvents.off('data', onData);
      terminalEvents.off('exit', onExit);
      // Keep PTYs running so a browser refresh can reattach via terminal.list + scrollback replay
    });

    ws.on('error', (err) => {
      console.error(`[WS] Client error (${clientId}):`, err.message);
    });
  });

  // Start listening
  await new Promise((resolve, reject) => {
    httpServer.listen(port, host, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const addr = httpServer.address();
  const listenPort =
    typeof addr === 'object' && addr && 'port' in addr ? addr.port : port;
  if (enableMcp && tryMcp) {
    mcpRuntime.port = listenPort;
    console.log(`[MCP] same port as web → /health, /mcp/ai, /mcp/debug/sse`);
  } else {
    mcpRuntime.port = null;
  }

  console.log(`\n🚀 Rebebuca is running!`);
  console.log(`   → Local:   http://${host === '127.0.0.1' ? 'localhost' : host}:${port}`);
  if (host === '0.0.0.0') {
    const { networkInterfaces } = await import('os');
    const nets = networkInterfaces();
    for (const ifaces of Object.values(nets)) {
      for (const iface of ifaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(`   → Network: http://${iface.address}:${port}`);
        }
      }
    }
  }
  console.log('');

  return httpServer;
}
