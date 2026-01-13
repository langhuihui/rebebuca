#!/usr/bin/env node
/**
 * MCP Debug Server
 * 
 * Standalone MCP server for Rebebuca debug API.
 * This server can be used by external AI tools (Claude Desktop, Cursor, etc.)
 * to access debugging information from the Rebebuca application.
 * 
 * Usage:
 *   node scripts/mcp-debug-server.js
 * 
 * The server communicates via stdio using JSON-RPC protocol.
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

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

// Read and parse stdin
async function readStdin() {
  return new Promise((resolve) => {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            resolve(message);
            return;
          } catch (e) {
            // Invalid JSON, continue
          }
        }
      }
    });
    
    process.stdin.on('end', () => {
      if (buffer.trim()) {
        try {
          resolve(JSON.parse(buffer));
        } catch (e) {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
}

// Send JSON-RPC response
function sendResponse(id, result, error = null) {
  const response = {
    jsonrpc: '2.0',
    id,
  };
  
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  
  console.log(JSON.stringify(response));
}

// Send notification
function sendNotification(method, params) {
  const notification = {
    jsonrpc: '2.0',
    method,
    params,
  };
  
  console.log(JSON.stringify(notification));
}

// Handle tool execution
async function executeTool(name, args) {
  // Note: This is a simplified implementation
  // In a real scenario, you would need to connect to the running Rebebuca app
  // For now, we'll return a message indicating the tool is available
  
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
        const os = await import('os');
        const path = await import('path');
        const fs = await import('fs/promises');
        
        // Default log locations
        const logDirs = [
          path.join(os.homedir(), 'Library', 'Logs', 'com.rebebuca.app'), // macOS
          path.join(os.homedir(), 'AppData', 'Local', 'rebebuca', 'logs'), // Windows
          path.join(os.homedir(), '.local', 'share', 'rebebuca', 'logs'), // Linux
        ];
        
        for (const logDir of logDirs) {
          try {
            const files = await fs.readdir(logDir);
            const logFiles = files.filter(f => f.endsWith('.log')).sort().reverse();
            
            if (logFiles.length > 0) {
              const latestLog = logFiles[0];
              const content = await fs.readFile(path.join(logDir, latestLog), 'utf-8');
              const lines = content.split('\n').filter(l => l.trim());
              
              return {
                filename: latestLog,
                lines: lines.slice(-100), // Last 100 lines
                line_count: lines.length,
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

// Main message loop
async function main() {
  try {
    // Read initialization message
    const initMessage = await readStdin();
    
    if (!initMessage) {
      process.exit(1);
    }
    
    // Handle initialize
    if (initMessage.method === MCP_METHODS.INITIALIZE) {
      sendResponse(initMessage.id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'rebebuca-debug',
          version: '1.0.0',
        },
      });
      
      // Send initialized notification
      sendNotification('initialized', {});
    }
    
    // Main message loop
    while (true) {
      const message = await readStdin();
      
      if (!message) {
        break;
      }
      
      if (message.method === MCP_METHODS.TOOLS_LIST) {
        sendResponse(message.id, {
          tools: TOOLS,
        });
      } else if (message.method === MCP_METHODS.TOOLS_CALL) {
        try {
          const result = await executeTool(message.params.name, message.params.arguments || {});
          sendResponse(message.id, {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          });
        } catch (error) {
          sendResponse(message.id, null, {
            code: -32603,
            message: error.message,
          });
        }
      } else if (message.method === MCP_METHODS.PING) {
        sendResponse(message.id, {});
      } else {
        sendResponse(message.id, null, {
          code: -32601,
          message: `Method not found: ${message.method}`,
        });
      }
    }
  } catch (error) {
    console.error(JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message,
      },
    }));
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
