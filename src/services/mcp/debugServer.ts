/**
 * MCP Server for Debug API
 * 
 * Implements Model Context Protocol server for debugging capabilities.
 * This server can be used by external MCP clients to access debug information.
 */

import type { MCPTool, MCPToolCall, MCPToolResult } from '../../types/aiCollab';
import * as debugService from '../debugService';

/**
 * MCP Tool definitions for debug API
 */
export const DEBUG_MCP_TOOLS: MCPTool[] = [
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
          required: false,
        },
        maxChildren: {
          type: 'number',
          description: 'Maximum children per node to include (default: 50)',
          required: false,
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
          required: false,
        },
        maxChildren: {
          type: 'number',
          description: 'Maximum children per node in DOM tree (default: 50)',
          required: false,
        },
      },
      required: [],
    },
  },
];

/**
 * Execute MCP tool call
 */
export async function executeMCPTool(call: MCPToolCall): Promise<MCPToolResult> {
  const { name, arguments: args } = call;

  try {
    switch (name) {
      case 'get_frontend_logs': {
        const logs = await debugService.getFrontendLogs();
        const logsData = logs.map(log => ({
          timestamp: log.timestamp.toISOString(),
          level: log.level,
          source: log.source,
          message: log.message,
          data: log.data,
        }));

        return {
          id: call.id,
          success: true,
          result: {
            logs: logsData,
            count: logsData.length,
          },
        };
      }

      case 'get_tauri_logs': {
        const response = await debugService.getTauriLogs();
        return {
          id: call.id,
          success: response.success,
          result: response.data,
          error: response.error,
        };
      }

      case 'get_dom_tree': {
        const maxDepth = (args?.maxDepth as number) || 10;
        const maxChildren = (args?.maxChildren as number) || 50;
        const domTree = debugService.getDomTree(maxDepth, maxChildren);
        
        return {
          id: call.id,
          success: true,
          result: {
            domTree,
            maxDepth,
            maxChildren,
          },
        };
      }

      case 'get_all_debug_info': {
        const maxDepth = (args?.maxDepth as number) || 10;
        const maxChildren = (args?.maxChildren as number) || 50;
        const response = await debugService.getAllDebugInfo(maxDepth, maxChildren);
        
        return {
          id: call.id,
          success: response.success,
          result: response.data,
          error: response.error,
        };
      }

      default:
        return {
          id: call.id,
          success: false,
          error: `Unknown tool: ${name}`,
        };
    }
  } catch (error) {
    return {
      id: call.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get all available MCP tools
 */
export function getMCPTools(): MCPTool[] {
  return DEBUG_MCP_TOOLS;
}

/**
 * Get MCP tool by name
 */
export function getMCPTool(name: string): MCPTool | undefined {
  return DEBUG_MCP_TOOLS.find(tool => tool.name === name);
}
