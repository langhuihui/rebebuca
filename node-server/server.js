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
import { createReadStream, existsSync, statSync } from 'fs';
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
  killClientPtys,
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
  openExternal,
  openInSystemTerminal,
  openInSpecificTerminal,
  executeWithAdmin,
  checkFullDiskAccess,
  openFullDiskAccessSettings,
} from './handlers/system.js';

import { get as storageGet, set as storageSet, del as storageDel, save as storageSave } from './handlers/storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

      // ── Updater (no-op) ───────────────────────────────────────────────────
      case 'updater.checkForUpdates':
      case 'updater.update':
        result = null;
        break;

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
 * @returns {Promise<http.Server>}
 */
export async function createServer({ port = 3000, host = '127.0.0.1', staticDir } = {}) {
  // Determine where the pre-built frontend lives
  const resolvedStaticDir =
    staticDir || path.resolve(__dirname, '..', 'dist', 'server');

  if (!existsSync(resolvedStaticDir)) {
    console.warn(
      `[Server] Static directory not found: ${resolvedStaticDir}\n` +
        '         Run "npm run build:server-app" first to build the frontend.',
    );
  }

  const staticHandler = serveStatic(resolvedStaticDir);

  // Create HTTP server
  const httpServer = http.createServer((req, res) => {
    // Allow CORS for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    staticHandler(req, res);
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
      // Kill all PTYs owned by this client
      killClientPtys([...clientPtyIds]);
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
