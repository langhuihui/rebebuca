/**
 * Rebebuca AI Service Layer - Debug Tool
 * Provides debugging capabilities: frontend logs, Tauri logs, and DOM tree
 */

import { z, defineTool, type ToolExecuteResult } from './types';
import * as debugService from '../../../services/debugService';

const DESCRIPTION = `Access debugging information from the application.

This tool provides access to:
- Frontend logs: All console logs since app startup
- Tauri logs: Backend logs from current session
- DOM tree: Current DOM structure of the application

Use this tool to diagnose issues, inspect application state, or understand what's happening in the app.`;

export const debugTool = defineTool({
  id: 'debug',
  description: DESCRIPTION,
  parameters: z.object({
    type: z.enum(['frontend_logs', 'tauri_logs', 'dom_tree', 'all']).describe(
      'Type of debug information to retrieve. "all" returns everything.'
    ),
    maxDepth: z.number().optional().describe('Maximum depth for DOM tree traversal (default: 10)'),
    maxChildren: z.number().optional().describe('Maximum children per node in DOM tree (default: 50)'),
  }),

  async execute(params, _ctx): Promise<ToolExecuteResult> {
    const { type, maxDepth = 10, maxChildren = 50 } = params;

    try {
      switch (type) {
        case 'frontend_logs': {
          const logs = debugService.getFrontendLogs();
          const logsText = logs
            .map(log => {
              const time = log.timestamp.toISOString();
              const level = log.level.toUpperCase().padEnd(5);
              const source = log.source.padEnd(8);
              return `[${time}] [${level}] [${source}] ${log.message}`;
            })
            .join('\n');

          return {
            title: 'Frontend Logs',
            output: logsText || 'No frontend logs available.',
            metadata: {
              logCount: logs.length,
              type: 'frontend_logs',
            },
          };
        }

        case 'tauri_logs': {
          const response = await debugService.getTauriLogs();
          if (!response.success) {
            return {
              title: 'Tauri Logs',
              output: `Error retrieving Tauri logs: ${response.error || 'Unknown error'}`,
              metadata: { error: response.error, type: 'tauri_logs' },
            };
          }

          const data = response.data as {
            filename?: string;
            lines?: string[];
            line_count?: number;
            total_lines?: number;
          };

          const logsText = data.lines?.join('\n') || 'No Tauri logs available.';
          const summary = data.filename
            ? `Log file: ${data.filename}\nLine count: ${data.line_count || 0} (total: ${data.total_lines || 0})\n\n`
            : '';

          return {
            title: 'Tauri Logs',
            output: summary + logsText,
            metadata: {
              filename: data.filename,
              lineCount: data.line_count,
              totalLines: data.total_lines,
              type: 'tauri_logs',
            },
          };
        }

        case 'dom_tree': {
          const domTree = debugService.getDomTree(maxDepth, maxChildren);
          
          // Format DOM tree as a readable structure
          function formatDomNode(node: any, indent: string = ''): string {
            let result = `${indent}<${node.tagName}`;
            
            if (node.id) {
              result += ` id="${node.id}"`;
            }
            
            if (node.className) {
              result += ` class="${node.className}"`;
            }
            
            if (node.attributes) {
              for (const [key, value] of Object.entries(node.attributes)) {
                if (key !== '_truncated_children' && key !== 'id' && key !== 'class') {
                  result += ` ${key}="${value}"`;
                }
              }
            }
            
            result += '>';
            
            if (node.textContent && !node.children) {
              const text = node.textContent.length > 100 
                ? node.textContent.substring(0, 100) + '...'
                : node.textContent;
              result += ` ${text}`;
            }
            
            if (node.attributes?._truncated_children) {
              result += `\n${indent}  ... (${node.attributes._truncated_children} more children truncated)`;
            }
            
            if (node.children && node.children.length > 0) {
              result += '\n';
              for (const child of node.children) {
                result += formatDomNode(child, indent + '  ') + '\n';
              }
              result += indent;
            }
            
            result += `</${node.tagName}>`;
            return result;
          }

          const domText = formatDomNode(domTree);

          return {
            title: 'DOM Tree',
            output: domText,
            metadata: {
              maxDepth,
              maxChildren,
              type: 'dom_tree',
            },
          };
        }

        case 'all': {
          const response = await debugService.getAllDebugInfo(maxDepth, maxChildren);
          
          if (!response.success) {
            return {
              title: 'Debug Information',
              output: `Error retrieving debug information: ${response.error || 'Unknown error'}`,
              metadata: { error: response.error, type: 'all' },
            };
          }

          const data = response.data as {
            frontend_logs?: any[];
            tauri_logs?: any;
            dom_tree?: any;
            timestamp?: string;
          };

          let output = '=== Debug Information ===\n\n';
          output += `Timestamp: ${data.timestamp || 'Unknown'}\n\n`;

          // Frontend logs
          if (data.frontend_logs && data.frontend_logs.length > 0) {
            output += '--- Frontend Logs ---\n';
            output += data.frontend_logs
              .map((log: any) => {
                const time = log.timestamp || 'Unknown';
                const level = (log.level || 'INFO').toUpperCase().padEnd(5);
                const source = (log.source || 'frontend').padEnd(8);
                return `[${time}] [${level}] [${source}] ${log.message || ''}`;
              })
              .join('\n');
            output += `\n\nTotal: ${data.frontend_logs.length} log entries\n\n`;
          } else {
            output += '--- Frontend Logs ---\nNo frontend logs available.\n\n';
          }

          // Tauri logs
          if (data.tauri_logs) {
            const tauriData = data.tauri_logs as {
              filename?: string;
              lines?: string[];
              line_count?: number;
            };
            output += '--- Tauri Logs ---\n';
            if (tauriData.filename) {
              output += `Log file: ${tauriData.filename}\n`;
            }
            if (tauriData.lines && tauriData.lines.length > 0) {
              output += tauriData.lines.join('\n');
              output += `\n\nTotal: ${tauriData.line_count || 0} log lines\n\n`;
            } else {
              output += 'No Tauri logs available.\n\n';
            }
          }

          // DOM tree (simplified)
          if (data.dom_tree) {
            output += '--- DOM Tree (simplified) ---\n';
            output += `Root element: <${data.dom_tree.tagName || 'html'}>\n`;
            if (data.dom_tree.id) {
              output += `ID: ${data.dom_tree.id}\n`;
            }
            if (data.dom_tree.className) {
              output += `Class: ${data.dom_tree.className}\n`;
            }
            output += `\n(Full DOM tree structure available via type="dom_tree")\n`;
          }

          return {
            title: 'All Debug Information',
            output,
            metadata: {
              frontendLogCount: data.frontend_logs?.length || 0,
              tauriLogCount: (data.tauri_logs as any)?.line_count || 0,
              timestamp: data.timestamp,
              type: 'all',
            },
          };
        }

        default:
          return {
            title: 'Debug Tool',
            output: `Unknown debug type: ${type}`,
            metadata: { error: 'unknown_type', type },
          };
      }
    } catch (error) {
      return {
        title: 'Debug Tool Error',
        output: `Error executing debug tool: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { error: error instanceof Error ? error.message : String(error), type },
      };
    }
  },
});
