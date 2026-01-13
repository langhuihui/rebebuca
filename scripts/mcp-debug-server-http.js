#!/usr/bin/env node
/**
 * MCP Debug Server (HTTP/SSE) - DEPRECATED
 * 
 * @deprecated This standalone server has been replaced by an integrated MCP server
 * running inside the Tauri backend (src-tauri/src/mcp_http_server.rs).
 * The integrated server can access real frontend logs and DOM tree through
 * Tauri's IPC mechanism.
 * 
 * This file is kept for reference only.
 * 
 * Original description:
 * HTTP server with SSE for Rebebuca debug API.
 * Provides MCP protocol endpoints for external AI tools.
 * 
 * Usage:
 *   node scripts/mcp-debug-server-http.js [port]
 * 
 * Default port: 3001
 * 
 * Endpoints:
 *   POST /mcp/message - Send MCP messages
 *   GET  /mcp/sse     - SSE stream for server messages
 */

import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import { readdir } from 'fs/promises';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.argv[2] ? parseInt(process.argv[2]) : 3001;

// MCP Protocol message types
const MCP_METHODS = {
  INITIALIZE: 'initialize',
  TOOLS_LIST: 'tools/list',
  TOOLS_CALL: 'tools/call',
  PING: 'ping',
};

// Tool definitions
const TOOLS = [
  {
    name: 'get_frontend_logs',
    description: 'Get frontend console logs since app startup. Returns all log entries with timestamps, levels, and messages.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_tauri_logs',
    description: 'Get Tauri backend logs from the current session. Returns log lines from the most recent log file since app startup.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_dom_tree',
    description: 'Get the current DOM tree structure of the application. Returns a hierarchical representation of the DOM.',
    inputSchema: {
      type: 'object',
      properties: {
        maxDepth: {
          type: 'number',
          description: 'Maximum depth to traverse the DOM tree (default: 10)',
        },
        maxChildren: {
          type: 'number',
          description: 'Maximum children per node to include (default: 50)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_all_debug_info',
    description: 'Get all debug information including frontend logs, Tauri logs, and DOM tree in a single call.',
    inputSchema: {
      type: 'object',
      properties: {
        maxDepth: {
          type: 'number',
          description: 'Maximum depth for DOM tree traversal (default: 10)',
        },
        maxChildren: {
          type: 'number',
          description: 'Maximum children per node in DOM tree (default: 50)',
        },
      },
      required: [],
    },
  },
];

// Store SSE connections
const sseConnections = new Map();

// Handle tool execution
async function executeTool(name, args) {
  switch (name) {
    case 'get_frontend_logs':
      return {
        logs: [],
        count: 0,
        message: 'Frontend logs are only available when connected to a running Rebebuca application instance.',
      };
      
    case 'get_tauri_logs':
      // Try to read log files from the app log directory
      try {
        const path = await import('path');
        const fs = await import('fs/promises');
        
        // Default log locations
        const platform = os.platform();
        let logDirs = [];
        
        if (platform === 'darwin') {
          logDirs = [
            path.join(os.homedir(), 'Library', 'Logs', 'com.rebebuca.app'),
            path.join(os.homedir(), 'Library', 'Application Support', 'rebebuca', 'logs'),
          ];
        } else if (platform === 'win32') {
          logDirs = [
            path.join(os.homedir(), 'AppData', 'Local', 'rebebuca', 'logs'),
            path.join(os.homedir(), 'AppData', 'Roaming', 'rebebuca', 'logs'),
          ];
        } else {
          logDirs = [
            path.join(os.homedir(), '.local', 'share', 'rebebuca', 'logs'),
            path.join(os.homedir(), '.config', 'rebebuca', 'logs'),
          ];
        }
        
        for (const logDir of logDirs) {
          try {
            const files = await readdir(logDir);
            const logFiles = files.filter(f => f.endsWith('.log')).sort().reverse();
            
            if (logFiles.length > 0) {
              const latestLog = logFiles[0];
              const content = await readFile(path.join(logDir, latestLog), 'utf-8');
              const lines = content.split('\n').filter(l => l.trim());
              
              // Filter lines from current session (last hour)
              const oneHourAgo = Date.now() - 3600000;
              const sessionLines = lines.filter(line => {
                // Try to extract timestamp from log line
                const timestampMatch = line.match(/\[(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/);
                if (timestampMatch) {
                  const logTime = new Date(timestampMatch[1].replace(' ', 'T')).getTime();
                  return logTime >= oneHourAgo;
                }
                // If no timestamp, include if file was modified recently
                return true;
              });
              
              return {
                filename: latestLog,
                lines: sessionLines.length > 0 ? sessionLines.slice(-100) : lines.slice(-100),
                line_count: sessionLines.length || lines.length,
                total_lines: lines.length,
              };
            }
          } catch (e) {
            // Directory doesn't exist, try next
          }
        }
        
        return {
          filename: null,
          lines: [],
          line_count: 0,
          message: 'No log files found. Make sure Rebebuca has been run at least once.',
        };
      } catch (error) {
        return {
          filename: null,
          lines: [],
          line_count: 0,
          error: error.message,
        };
      }
      
    case 'get_dom_tree':
      return {
        domTree: {
          tagName: 'html',
          nodeType: 1,
          message: 'DOM tree is only available when connected to a running Rebebuca application instance.',
        },
        maxDepth: args?.maxDepth || 10,
        maxChildren: args?.maxChildren || 50,
      };
      
    case 'get_all_debug_info':
      const frontendLogs = await executeTool('get_frontend_logs', {});
      const tauriLogs = await executeTool('get_tauri_logs', {});
      const domTree = await executeTool('get_dom_tree', args);
      
      return {
        frontend_logs: frontendLogs.logs || [],
        tauri_logs: tauriLogs,
        dom_tree: domTree.domTree,
        timestamp: new Date().toISOString(),
      };
      
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Send SSE message to all connected clients
function sendSSEMessage(connectionId, data) {
  const connection = sseConnections.get(connectionId);
  if (connection) {
    connection.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

// Handle MCP message
async function handleMCPMessage(message, connectionId) {
  if (message.method === MCP_METHODS.INITIALIZE) {
    sendSSEMessage(connectionId, {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'rebebuca-debug',
          version: '1.0.0',
        },
      },
    });
    
    // Send initialized notification
    sendSSEMessage(connectionId, {
      jsonrpc: '2.0',
      method: 'initialized',
      params: {},
    });
  } else if (message.method === MCP_METHODS.TOOLS_LIST) {
    sendSSEMessage(connectionId, {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: TOOLS,
      },
    });
  } else if (message.method === MCP_METHODS.TOOLS_CALL) {
    try {
      const result = await executeTool(message.params.name, message.params.arguments || {});
      sendSSEMessage(connectionId, {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      });
    } catch (error) {
      sendSSEMessage(connectionId, {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: error.message,
        },
      });
    }
  } else if (message.method === MCP_METHODS.PING) {
    sendSSEMessage(connectionId, {
      jsonrpc: '2.0',
      id: message.id,
      result: {},
    });
  } else {
    sendSSEMessage(connectionId, {
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: -32601,
        message: `Method not found: ${message.method}`,
      },
    });
  }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // SSE endpoint
  if (url.pathname === '/mcp/sse' && req.method === 'GET') {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    
    // Store connection
    sseConnections.set(connectionId, res);
    
    // Send endpoint event as required by MCP SSE transport protocol
    // This tells the client where to send messages
    res.write(`event: endpoint\ndata: /mcp/message?sessionId=${connectionId}\n\n`);
    
    // Clean up on close
    req.on('close', () => {
      sseConnections.delete(connectionId);
      res.end();
    });
    
    return;
  }
  
  // Message endpoint (for SSE transport)
  if (url.pathname === '/mcp/message' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const message = JSON.parse(body);
        const connectionId = url.searchParams.get('sessionId') || url.searchParams.get('connectionId') || 'default';
        
        await handleMCPMessage(message, connectionId);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    
    return;
  }
  
  // Streamable HTTP endpoint (for MCP streamableHttp transport)
  // This endpoint accepts POST requests with JSON-RPC messages and returns responses directly
  if (url.pathname === '/mcp' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const message = JSON.parse(body);
        
        // Handle message and send response directly (not via SSE)
        if (message.method === MCP_METHODS.INITIALIZE) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: 'rebebuca-debug',
                version: '1.0.0',
              },
            },
          }));
        } else if (message.method === MCP_METHODS.TOOLS_LIST) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              tools: TOOLS,
            },
          }));
        } else if (message.method === MCP_METHODS.TOOLS_CALL) {
          try {
            const result = await executeTool(message.params.name, message.params.arguments || {});
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id: message.id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                  },
                ],
              },
            }));
          } catch (error) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id: message.id,
              error: {
                code: -32603,
                message: error.message,
              },
            }));
          }
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32601,
              message: `Method not found: ${message.method}`,
            },
          }));
        }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: error.message,
          },
        }));
      }
    });
    
    return;
  }
  
  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', tools: TOOLS.length }));
    return;
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`MCP Debug Server running on http://127.0.0.1:${PORT}`);
  console.log(`SSE endpoint: http://127.0.0.1:${PORT}/mcp/sse`);
  console.log(`Streamable HTTP endpoint: http://127.0.0.1:${PORT}/mcp`);
  console.log(`Message endpoint: http://127.0.0.1:${PORT}/mcp/message`);
  console.log(`Health check: http://127.0.0.1:${PORT}/health`);
});
