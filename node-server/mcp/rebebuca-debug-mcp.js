/**
 * Rebebuca debug MCP: backend log buffer.
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getServerLogsTail } from '../internal-log-buffer.js';

export function createDebugMcpServer(version) {
  const mcp = new McpServer(
    { name: 'rebebuca-debug', version },
    { capabilities: { tools: { listChanged: true } } },
  );

  mcp.registerTool(
    'get_backend_logs',
    {
      description: 'Return recent Rebebuca Node server log lines (console capture).',
      inputSchema: z.object({
        limit: z.number().int().positive().max(2000).optional(),
      }),
    },
    async ({ limit }) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(getServerLogsTail(limit ?? 200), null, 2),
        },
      ],
    }),
  );

  return mcp;
}
