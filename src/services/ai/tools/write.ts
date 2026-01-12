/**
 * Rebebuca AI Service Layer - Write Tool
 * Write content to files
 */

import { z, defineTool, type ToolExecuteResult } from './types';
import { getAdapter } from '../../../adapters';
import * as path from '../utils/path';

const DESCRIPTION = `Write content to a file.

Usage:
- Creates the file if it doesn't exist
- Overwrites existing content if file exists
- Creates parent directories if needed

Important:
- Use the read tool first to understand existing file content before overwriting
- For small changes, prefer the edit tool instead`;

export const writeTool = defineTool({
  id: 'write',
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe('The path to the file to write'),
    content: z.string().describe('The content to write to the file'),
  }),

  async execute(params, ctx): Promise<ToolExecuteResult> {
    const adapter = await getAdapter();

    // Resolve file path
    const filePath = path.isAbsolute(params.filePath)
      ? params.filePath
      : path.join(ctx.projectPath, params.filePath);

    const relativePath = path.relative(ctx.projectPath, filePath);
    const displayPath = relativePath.startsWith('..')
      ? filePath
      : relativePath;

    // Check if file is outside project
    if (relativePath.startsWith('..')) {
      await ctx.requestPermission({
        type: 'external_directory',
        path: filePath,
        patterns: [path.dirname(filePath)],
      });
    }

    // Check if file exists
    const exists = await adapter.fs.exists(filePath);

    // Request write permission
    await ctx.requestPermission({
      type: 'write',
      path: filePath,
      patterns: [relativePath],
      metadata: {
        exists,
        contentLength: params.content.length,
        lineCount: params.content.split('\n').length,
      },
    });

    try {
      // Ensure parent directory exists
      const dir = path.dirname(filePath);
      const dirExists = await adapter.fs.exists(dir);
      if (!dirExists) {
        await adapter.fs.mkdir(dir, { recursive: true });
      }

      // Write file
      await adapter.fs.writeTextFile(filePath, params.content);

      const lineCount = params.content.split('\n').length;
      const byteCount = new TextEncoder().encode(params.content).length;

      // Update metadata for UI
      ctx.updateMetadata({
        created: !exists,
        lineCount,
        byteCount,
      });

      return {
        title: displayPath,
        output: exists
          ? `Updated ${displayPath} (${lineCount} lines, ${byteCount} bytes)`
          : `Created ${displayPath} (${lineCount} lines, ${byteCount} bytes)`,
        metadata: {
          created: !exists,
          lineCount,
          byteCount,
        },
      };
    } catch (error) {
      return {
        title: displayPath,
        output: `Error writing file: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { error: 'write_error' },
      };
    }
  },
});
