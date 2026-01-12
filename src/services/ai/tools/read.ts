/**
 * Rebebuca AI Service Layer - Read Tool
 * Read file contents with pagination support
 */

import { z, defineTool, type ToolExecuteResult } from './types';
import { getAdapter } from '../../../adapters';
import * as path from '../utils/path';

const DEFAULT_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;
const MAX_BYTES = 50 * 1024; // 50KB

const DESCRIPTION = `Read file contents from the local filesystem.

Usage:
- Reads files with line numbers for easy reference
- Supports pagination with offset and limit for large files
- Automatically truncates very long lines
- Can read images and PDFs (returned as attachments)

Parameters:
- filePath: Absolute or relative path to the file
- offset: Starting line number (0-based, optional)
- limit: Number of lines to read (default 2000)`;

export const readTool = defineTool({
  id: 'read',
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe('The path to the file to read'),
    offset: z.number().optional().describe('Line number to start reading from (0-based)'),
    limit: z.number().optional().describe('Number of lines to read (default 2000)'),
  }),

  async execute(params, ctx): Promise<ToolExecuteResult> {
    const adapter = await getAdapter();
    const { offset = 0, limit = DEFAULT_LIMIT } = params;

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
    if (!exists) {
      // Try to suggest similar files
      const dir = path.dirname(filePath);
      const basename = path.basename(filePath);
      
      try {
        const files = await adapter.fs.readDir(dir);
        const suggestions = files
          .filter(f => !f.isDirectory && f.name.toLowerCase().includes(basename.toLowerCase().slice(0, 3)))
          .slice(0, 5)
          .map(f => path.join(dir, f.name));

        if (suggestions.length > 0) {
          return {
            title: displayPath,
            output: `File not found: ${filePath}\n\nDid you mean one of these?\n${suggestions.join('\n')}`,
            metadata: { error: 'not_found', suggestions },
          };
        }
      } catch {
        // Ignore directory read errors
      }

      return {
        title: displayPath,
        output: `File not found: ${filePath}`,
        metadata: { error: 'not_found' },
      };
    }

    // Read file content
    let content: string;
    try {
      content = await adapter.fs.readTextFile(filePath);
      
      // Check if it's a binary file by extension first
      const ext = path.extname(filePath).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp'].includes(ext)) {
        return {
          title: displayPath,
          output: `Cannot read binary image file directly. File: ${filePath}`,
          metadata: { type: 'image', error: 'binary_file' },
        };
      }
      
      if (ext === '.pdf') {
        return {
          title: displayPath,
          output: `Cannot read PDF file directly. File: ${filePath}`,
          metadata: { type: 'pdf', error: 'binary_file' },
        };
      }
    } catch (error) {
      return {
        title: displayPath,
        output: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { error: 'read_error' },
      };
    }

    // Check for binary content
    if (isBinaryContent(content)) {
      return {
        title: displayPath,
        output: `Cannot read binary file: ${filePath}`,
        metadata: { error: 'binary_file' },
      };
    }

    // Split into lines and paginate
    const lines = content.split('\n');
    const totalLines = lines.length;
    const startLine = Math.min(offset, totalLines);
    const endLine = Math.min(startLine + limit, totalLines);

    // Build output with line numbers
    const outputLines: string[] = [];
    let totalBytes = 0;
    let truncatedByBytes = false;

    for (let i = startLine; i < endLine; i++) {
      let line = lines[i];
      
      // Truncate very long lines
      if (line.length > MAX_LINE_LENGTH) {
        line = line.substring(0, MAX_LINE_LENGTH) + '...';
      }

      const lineWithNumber = `${String(i + 1).padStart(5, ' ')}| ${line}`;
      const lineBytes = new TextEncoder().encode(lineWithNumber).length + 1; // +1 for newline

      if (totalBytes + lineBytes > MAX_BYTES) {
        truncatedByBytes = true;
        break;
      }

      outputLines.push(lineWithNumber);
      totalBytes += lineBytes;
    }

    const linesRead = outputLines.length;
    const hasMore = endLine < totalLines || truncatedByBytes;

    let output = outputLines.join('\n');
    
    if (hasMore) {
      const remaining = totalLines - startLine - linesRead;
      output += `\n\n... ${remaining} more lines. Use offset=${startLine + linesRead} to continue reading.`;
    }

    // Update metadata for UI
    ctx.updateMetadata({
      preview: outputLines.slice(0, 10).join('\n'),
      totalLines,
      linesRead,
      hasMore,
    });

    return {
      title: displayPath,
      output,
      metadata: {
        totalLines,
        linesRead,
        offset: startLine,
        hasMore,
        truncatedByBytes,
      },
    };
  },
});

/**
 * Check if content appears to be binary
 */
function isBinaryContent(content: string): boolean {
  // Check for null bytes or high concentration of non-printable characters
  const sample = content.slice(0, 8000);
  let nonPrintable = 0;
  
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 0) return true;
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      nonPrintable++;
    }
  }
  
  return nonPrintable / sample.length > 0.1;
}
