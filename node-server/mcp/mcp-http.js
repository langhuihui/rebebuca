/**
 * MCP (AI + debug SSE) HTTP handlers for mounting on the main Rebebuca server.
 */

import { URL } from 'url';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createAiMcpServer, handleAiMcpJsonRpc } from './rebebuca-ai-mcp.js';
import { createDebugMcpServer } from './rebebuca-debug-mcp.js';

/**
 * @param {string} raw
 * @param {number} limit
 */
async function readJsonBody(req, limit = 6_000_000) {
  const chunks = [];
  let n = 0;
  for await (const chunk of req) {
    n += chunk.length;
    if (n > limit) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  if (!body) return undefined;
  return JSON.parse(body);
}

/**
 * @typedef {{ transport: import('@modelcontextprotocol/sdk/server/sse.js').SSEServerTransport, mcp: import('@modelcontextprotocol/sdk/server/mcp.js').McpServer }} SseEntry
 */

/**
 * @param {string} appVersion
 * @returns {(req: import('http').IncomingMessage, res: import('http').ServerResponse) => Promise<boolean>}
 */
export function createMcpRequestHandler(appVersion) {
  /** @type {Map<string, SseEntry>} */
  const aiSessions = new Map();
  /** @type {Map<string, SseEntry>} */
  const debugSessions = new Map();

  return async function tryHandleMcpRequest(req, res) {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, service: 'rebebuca-mcp', version: appVersion }));
        return true;
      }

      if (req.method === 'POST' && url.pathname === '/mcp/ai') {
        const body = await readJsonBody(req);
        const handled = await handleAiMcpJsonRpc(body, appVersion);
        if (handled.err) {
          res.writeHead(handled.httpStatus, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: handled.err.code, message: handled.err.message },
              id: handled.err.id ?? null,
            }),
          );
          return true;
        }
        if (handled.httpStatus === 204 || handled.ok === null) {
          res.writeHead(204);
          res.end();
          return true;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(handled.ok));
        return true;
      }

      if (req.method === 'GET' && url.pathname === '/mcp/ai/sse') {
        const transport = new SSEServerTransport('/mcp/ai/message', res);
        const mcp = createAiMcpServer(appVersion);
        aiSessions.set(transport.sessionId, { transport, mcp });
        res.on('close', () => {
          aiSessions.delete(transport.sessionId);
        });
        await mcp.connect(transport);
        await transport.start();
        return true;
      }

      if (req.method === 'POST' && url.pathname === '/mcp/ai/message') {
        const sid = url.searchParams.get('sessionId');
        if (!sid) {
          res.writeHead(400).end('Missing sessionId');
          return true;
        }
        const entry = aiSessions.get(sid);
        if (!entry) {
          res.writeHead(404).end('Unknown SSE session');
          return true;
        }
        let parsed;
        try {
          parsed = await readJsonBody(req);
        } catch (e) {
          res.writeHead(400).end(e instanceof Error ? e.message : 'Bad body');
          return true;
        }
        await entry.transport.handlePostMessage(req, res, parsed);
        return true;
      }

      if (req.method === 'GET' && url.pathname === '/mcp/debug/sse') {
        const transport = new SSEServerTransport('/mcp/debug/message', res);
        const mcp = createDebugMcpServer(appVersion);
        debugSessions.set(transport.sessionId, { transport, mcp });
        res.on('close', () => {
          debugSessions.delete(transport.sessionId);
        });
        await mcp.connect(transport);
        await transport.start();
        return true;
      }

      if (req.method === 'POST' && url.pathname === '/mcp/debug/message') {
        const sid = url.searchParams.get('sessionId');
        if (!sid) {
          res.writeHead(400).end('Missing sessionId');
          return true;
        }
        const entry = debugSessions.get(sid);
        if (!entry) {
          res.writeHead(404).end('Unknown SSE session');
          return true;
        }
        let parsed;
        try {
          parsed = await readJsonBody(req);
        } catch (e) {
          res.writeHead(400).end(e instanceof Error ? e.message : 'Bad body');
          return true;
        }
        await entry.transport.handlePostMessage(req, res, parsed);
        return true;
      }

      return false;
    } catch (err) {
      console.error('[MCP]', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
      return true;
    }
  };
}
