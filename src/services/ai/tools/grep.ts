/**
 * Rebebuca AI Service Layer - Grep Tool
 * Search file contents with regex
 */

import { z, defineTool, type ToolExecuteResult } from './types';
import { getAdapter } from '../../../adapters';
import * as pathUtils from '../utils/path';

const DEFAULT_LIMIT = 50;
const CONTEXT_LINES = 2;

const DESCRIPTION = `Search for text patterns in files.

Usage:
- Supports regular expressions
- Shows matching lines with context
- Filters by file extension with 'include' parameter

Examples:
- pattern: "function.*export" - Find exported functions
- pattern: "TODO|FIXME" - Find todos
- include: "*.ts" - Only search TypeScript files`;

export const grepTool = defineTool({
  id: 'grep',
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    path: z.string().optional().describe('Directory to search in (default: project root)'),
    include: z.string().optional().describe('File pattern to include (e.g., "*.ts")'),
    limit: z.number().optional().describe('Maximum number of matches to return (default: 50)'),
  }),

  async execute(params, ctx): Promise<ToolExecuteResult> {
    const adapter = await getAdapter();
    const { pattern, include, limit = DEFAULT_LIMIT } = params;

    // Resolve search path
    const searchPath = params.path
      ? pathUtils.isAbsolute(params.path)
        ? params.path
        : pathUtils.join(ctx.projectPath, params.path)
      : ctx.projectPath;

    // Check if path is outside project
    const relativePath = pathUtils.relative(ctx.projectPath, searchPath);
    if (relativePath.startsWith('..')) {
      await ctx.requestPermission({
        type: 'external_directory',
        path: searchPath,
        patterns: [searchPath],
      });
    }

    // Compile regex
    let regex: RegExp;
    try {
      regex = new RegExp(pattern, 'gi');
    } catch (error) {
      return {
        title: pattern,
        output: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { error: 'invalid_pattern' },
      };
    }

    try {
      // Compile include pattern
      const includeRegex = include ? globToRegex(include) : null;

      // Search files
      const matches = await searchFiles(
        adapter,
        searchPath,
        regex,
        includeRegex,
        limit,
        ctx.projectPath
      );

      // Sort by modification time (newest first)
      matches.sort((a, b) => b.mtime - a.mtime);

      // Format output
      const truncated = matches.length >= limit;
      const output = formatMatches(matches, ctx.projectPath);

      ctx.updateMetadata({
        matchCount: matches.length,
        truncated,
      });

      return {
        title: pattern,
        output: output || 'No matches found',
        metadata: {
          matchCount: matches.length,
          truncated,
          searchPath: relativePath || '.',
        },
      };
    } catch (error) {
      return {
        title: pattern,
        output: `Error searching: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { error: 'search_error' },
      };
    }
  },
});

interface Match {
  filePath: string;
  lineNumber: number;
  line: string;
  context: string[];
  mtime: number;
}

/**
 * Search files for pattern
 */
async function searchFiles(
  adapter: Awaited<ReturnType<typeof getAdapter>>,
  basePath: string,
  pattern: RegExp,
  includeRegex: RegExp | null,
  limit: number,
  projectPath: string
): Promise<Match[]> {
  const matches: Match[] = [];

  await walkAndSearch(adapter, basePath, basePath, pattern, includeRegex, matches, limit, projectPath);

  return matches;
}

/**
 * Recursively walk and search files
 */
async function walkAndSearch(
  adapter: Awaited<ReturnType<typeof getAdapter>>,
  basePath: string,
  currentPath: string,
  pattern: RegExp,
  includeRegex: RegExp | null,
  matches: Match[],
  limit: number,
  projectPath: string
): Promise<void> {
  if (matches.length >= limit) return;

  try {
    const entries = await adapter.fs.readDir(currentPath);

    for (const entry of entries) {
      if (matches.length >= limit) break;

      const fullPath = pathUtils.join(currentPath, entry.name);

      // Skip hidden and ignored directories
      if (entry.name.startsWith('.')) continue;
      if (IGNORED_DIRS.has(entry.name) && entry.isDirectory) continue;

      if (entry.isDirectory) {
        await walkAndSearch(adapter, basePath, fullPath, pattern, includeRegex, matches, limit, projectPath);
      } else {
        // Check include pattern
        if (includeRegex && !includeRegex.test(entry.name)) continue;

        // Skip binary and large files
        if (BINARY_EXTENSIONS.has(pathUtils.extname(entry.name).toLowerCase())) continue;

        // Search file
        await searchFile(adapter, fullPath, pattern, matches, limit);
      }
    }
  } catch {
    // Skip directories we can't read
  }
}

/**
 * Search a single file
 */
async function searchFile(
  adapter: Awaited<ReturnType<typeof getAdapter>>,
  filePath: string,
  pattern: RegExp,
  matches: Match[],
  limit: number
): Promise<void> {
  if (matches.length >= limit) return;

  try {
    const content = await adapter.fs.readTextFile(filePath);

    // Skip binary content
    if (isBinaryContent(content)) return;

    const lines = content.split('\n');
    const stats = await adapter.fs.stat(filePath);
    const mtime = stats.modifiedAt ?? Date.now();

    for (let i = 0; i < lines.length; i++) {
      if (matches.length >= limit) break;

      // Reset regex lastIndex for each line
      pattern.lastIndex = 0;

      if (pattern.test(lines[i])) {
        // Get context lines
        const contextStart = Math.max(0, i - CONTEXT_LINES);
        const contextEnd = Math.min(lines.length, i + CONTEXT_LINES + 1);
        const context = lines.slice(contextStart, contextEnd).map((line, idx) => {
          const lineNum = contextStart + idx + 1;
          const prefix = lineNum === i + 1 ? '>' : ' ';
          return `${prefix}${String(lineNum).padStart(4, ' ')}| ${line}`;
        });

        matches.push({
          filePath,
          lineNumber: i + 1,
          line: lines[i],
          context,
          mtime,
        });
      }
    }
  } catch {
    // Skip files we can't read
  }
}

/**
 * Format matches for output
 */
function formatMatches(matches: Match[], projectPath: string): string {
  if (matches.length === 0) return '';

  const output: string[] = [];
  let currentFile = '';

  for (const match of matches) {
    const relativePath = pathUtils.relative(projectPath, match.filePath);

    if (match.filePath !== currentFile) {
      if (currentFile) output.push('');
      output.push(`=== ${relativePath} ===`);
      currentFile = match.filePath;
    }

    output.push(match.context.join('\n'));
    output.push('');
  }

  return output.join('\n').trim();
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

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.sqlite', '.db',
]);

/**
 * Check if content appears to be binary
 */
function isBinaryContent(content: string): boolean {
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

/**
 * Convert glob pattern to regex
 */
function globToRegex(pattern: string): RegExp {
  let regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/{{GLOBSTAR}}/g, '.*');

  return new RegExp(regexStr + '$', 'i');
}
