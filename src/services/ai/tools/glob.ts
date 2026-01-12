/**
 * Rebebuca AI Service Layer - Glob Tool
 * Fast file pattern matching
 */

import { z, defineTool, type ToolExecuteResult } from './types';
import { getAdapter } from '../../../adapters';
import * as path from '../utils/path';

const DEFAULT_LIMIT = 100;

const DESCRIPTION = `Find files matching a glob pattern.

Usage:
- Use glob patterns like "**/*.ts" or "src/**/*.vue"
- Results are sorted by modification time (newest first)
- Returns up to 100 files by default

Examples:
- "*.ts" - TypeScript files in current directory
- "**/*.test.ts" - All test files
- "src/components/**/*.vue" - Vue components in src/components`;

export const globTool = defineTool({
  id: 'glob',
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe('Glob pattern to match files'),
    path: z.string().optional().describe('Directory to search in (default: project root)'),
    limit: z.number().optional().describe('Maximum number of files to return (default: 100)'),
  }),

  async execute(params, ctx): Promise<ToolExecuteResult> {
    const adapter = await getAdapter();
    const { pattern, limit = DEFAULT_LIMIT } = params;

    // Resolve search path
    const searchPath = params.path
      ? path.isAbsolute(params.path)
        ? params.path
        : path.join(ctx.projectPath, params.path)
      : ctx.projectPath;

    // Check if path is outside project
    const relativePath = path.relative(ctx.projectPath, searchPath);
    if (relativePath.startsWith('..')) {
      await ctx.requestPermission({
        type: 'external_directory',
        path: searchPath,
        patterns: [searchPath],
      });
    }

    try {
      // Use the adapter to find files
      // Since we don't have a native glob API, we'll recursively read directories
      const files = await findFiles(adapter, searchPath, pattern, limit);

      // Sort by modification time (newest first)
      files.sort((a, b) => b.mtime - a.mtime);

      // Limit results
      const truncated = files.length > limit;
      const resultFiles = files.slice(0, limit);

      // Format output as relative paths
      const output = resultFiles
        .map(f => path.relative(ctx.projectPath, f.path))
        .join('\n');

      ctx.updateMetadata({
        count: resultFiles.length,
        truncated,
      });

      return {
        title: pattern,
        output: output || 'No files found',
        metadata: {
          count: resultFiles.length,
          truncated,
          searchPath: relativePath || '.',
        },
      };
    } catch (error) {
      return {
        title: pattern,
        output: `Error searching files: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { error: 'search_error' },
      };
    }
  },
});

interface FileInfo {
  path: string;
  mtime: number;
}

/**
 * Find files matching a glob pattern
 */
async function findFiles(
  adapter: Awaited<ReturnType<typeof getAdapter>>,
  basePath: string,
  pattern: string,
  limit: number
): Promise<FileInfo[]> {
  const results: FileInfo[] = [];
  const regex = globToRegex(pattern);

  await walkDirectory(adapter, basePath, basePath, regex, results, limit * 2);

  return results;
}

/**
 * Recursively walk directory
 */
async function walkDirectory(
  adapter: Awaited<ReturnType<typeof getAdapter>>,
  basePath: string,
  currentPath: string,
  regex: RegExp,
  results: FileInfo[],
  limit: number
): Promise<void> {
  if (results.length >= limit) return;

  try {
    const entries = await adapter.fs.readDir(currentPath);

    for (const entry of entries) {
      if (results.length >= limit) break;

      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      // Skip hidden files and common ignored directories
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      if (IGNORED_DIRS.has(entry.name) && entry.isDirectory) continue;

      if (entry.isDirectory) {
        await walkDirectory(adapter, basePath, fullPath, regex, results, limit);
      } else {
        // Test against pattern
        if (regex.test(relativePath) || regex.test(entry.name)) {
          try {
            const stats = await adapter.fs.stat(fullPath);
            results.push({
              path: fullPath,
              mtime: stats.modifiedAt ?? Date.now(),
            });
          } catch {
            // Skip files we can't stat
          }
        }
      }
    }
  } catch {
    // Skip directories we can't read
  }
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'target',
  '__pycache__',
  '.next',
  '.nuxt',
  'coverage',
  '.cache',
  'vendor',
]);

/**
 * Convert glob pattern to regex
 */
function globToRegex(pattern: string): RegExp {
  let regexStr = pattern
    // Escape regex special characters except * and ?
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // Handle **
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    // Handle *
    .replace(/\*/g, '[^/]*')
    // Handle ?
    .replace(/\?/g, '[^/]')
    // Restore **
    .replace(/{{GLOBSTAR}}/g, '.*');

  // If pattern doesn't start with **, match from start
  if (!pattern.startsWith('**')) {
    regexStr = '^' + regexStr;
  }

  // If pattern doesn't end with **, match to end
  if (!pattern.endsWith('**')) {
    regexStr = regexStr + '$';
  }

  return new RegExp(regexStr, 'i');
}
