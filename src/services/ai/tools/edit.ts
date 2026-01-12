/**
 * Rebebuca AI Service Layer - Edit Tool
 * Edit files with fuzzy matching support
 */

import { z, defineTool, type ToolExecuteResult } from './types';
import { getAdapter } from '../../../adapters';
import * as path from '../utils/path';

const DESCRIPTION = `Edit a file by replacing old content with new content.

Usage:
- Finds and replaces specified text in the file
- Uses fuzzy matching to handle minor whitespace differences
- Use replaceAll: true to replace all occurrences

Important:
- The old_string must be unique in the file for single replacement
- If multiple matches exist, provide more context to make it unique
- old_string and new_string must be different`;

export const editTool = defineTool({
  id: 'edit',
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe('The path to the file to edit'),
    oldString: z.string().describe('The text to find and replace'),
    newString: z.string().describe('The replacement text'),
    replaceAll: z.boolean().optional().describe('Replace all occurrences (default: false)'),
  }),

  async execute(params, ctx): Promise<ToolExecuteResult> {
    const adapter = await getAdapter();
    const { oldString, newString, replaceAll = false } = params;

    // Validate inputs
    if (oldString === newString) {
      return {
        title: 'Edit failed',
        output: 'Error: oldString and newString must be different',
        metadata: { error: 'same_content' },
      };
    }

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
    } catch (error) {
      return {
        title: displayPath,
        output: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { error: 'read_error' },
      };
    }

    // Try to replace using various strategies
    let newContent: string;
    let matchCount = 0;
    let strategy = 'exact';

    try {
      const result = replace(content, oldString, newString, replaceAll);
      newContent = result.content;
      matchCount = result.matchCount;
      strategy = result.strategy;
    } catch (error) {
      return {
        title: displayPath,
        output: error instanceof Error ? error.message : String(error),
        metadata: { error: 'replace_error' },
      };
    }

    // Request edit permission with diff preview
    await ctx.requestPermission({
      type: 'edit',
      path: filePath,
      patterns: [relativePath],
      metadata: {
        matchCount,
        strategy,
        oldLength: oldString.length,
        newLength: newString.length,
      },
    });

    // Write the updated content
    try {
      await adapter.fs.writeTextFile(filePath, newContent);

      ctx.updateMetadata({
        matchCount,
        strategy,
      });

      return {
        title: displayPath,
        output: replaceAll
          ? `Replaced ${matchCount} occurrence(s) in ${displayPath}`
          : `Edited ${displayPath}`,
        metadata: {
          matchCount,
          strategy,
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

/**
 * Replace content using multiple strategies
 */
function replace(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean
): { content: string; matchCount: number; strategy: string } {
  // Strategy 1: Exact match
  if (content.includes(oldString)) {
    if (replaceAll) {
      const matchCount = content.split(oldString).length - 1;
      return {
        content: content.split(oldString).join(newString),
        matchCount,
        strategy: 'exact',
      };
    }

    // Check uniqueness
    const firstIndex = content.indexOf(oldString);
    const lastIndex = content.lastIndexOf(oldString);
    if (firstIndex !== lastIndex) {
      throw new Error(
        `Found multiple occurrences of oldString. ` +
        `Provide more context to make it unique, or use replaceAll: true.`
      );
    }

    return {
      content: content.replace(oldString, newString),
      matchCount: 1,
      strategy: 'exact',
    };
  }

  // Strategy 2: Line-trimmed match
  const trimmedResult = tryLineTrimmedMatch(content, oldString, newString, replaceAll);
  if (trimmedResult) return trimmedResult;

  // Strategy 3: Whitespace-normalized match
  const normalizedResult = tryWhitespaceNormalizedMatch(content, oldString, newString, replaceAll);
  if (normalizedResult) return normalizedResult;

  // Strategy 4: Block anchor match (first and last lines)
  const anchorResult = tryBlockAnchorMatch(content, oldString, newString, replaceAll);
  if (anchorResult) return anchorResult;

  // Strategy 5: Indentation-flexible match
  const indentResult = tryIndentationFlexibleMatch(content, oldString, newString, replaceAll);
  if (indentResult) return indentResult;

  throw new Error(
    `oldString not found in file.\n` +
    `Make sure the text matches exactly, including whitespace and indentation.`
  );
}

/**
 * Try matching with trimmed lines
 */
function tryLineTrimmedMatch(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean
): { content: string; matchCount: number; strategy: string } | null {
  const oldLines = oldString.split('\n').map(l => l.trim());
  const contentLines = content.split('\n');

  const matches: number[] = [];

  for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
    let matched = true;
    for (let j = 0; j < oldLines.length; j++) {
      if (contentLines[i + j].trim() !== oldLines[j]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      matches.push(i);
    }
  }

  if (matches.length === 0) return null;

  if (!replaceAll && matches.length > 1) {
    throw new Error(
      `Found ${matches.length} matches with trimmed lines. ` +
      `Provide more context to make it unique.`
    );
  }

  // Replace from end to preserve indices
  const newLines = newString.split('\n');
  for (let i = matches.length - 1; i >= 0; i--) {
    if (!replaceAll && i > 0) continue;
    contentLines.splice(matches[i], oldLines.length, ...newLines);
  }

  return {
    content: contentLines.join('\n'),
    matchCount: replaceAll ? matches.length : 1,
    strategy: 'line_trimmed',
  };
}

/**
 * Try matching with normalized whitespace
 */
function tryWhitespaceNormalizedMatch(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean
): { content: string; matchCount: number; strategy: string } | null {
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
  const normalizedOld = normalize(oldString);
  const normalizedContent = normalize(content);

  if (!normalizedContent.includes(normalizedOld)) {
    return null;
  }

  // Find actual positions in original content
  const matches: Array<{ start: number; end: number }> = [];
  let searchStart = 0;

  while (searchStart < content.length) {
    // Find potential match start
    const remaining = content.slice(searchStart);
    const normalizedRemaining = normalize(remaining);
    const matchIndex = normalizedRemaining.indexOf(normalizedOld);
    
    if (matchIndex === -1) break;

    // Map back to original position
    let origPos = searchStart;
    let normPos = 0;
    
    while (normPos < matchIndex) {
      if (/\s/.test(content[origPos])) {
        while (origPos < content.length && /\s/.test(content[origPos])) origPos++;
        normPos++;
      } else {
        origPos++;
        normPos++;
      }
    }

    const start = origPos;
    normPos = 0;
    
    while (normPos < normalizedOld.length) {
      if (/\s/.test(content[origPos])) {
        while (origPos < content.length && /\s/.test(content[origPos])) origPos++;
        normPos++;
      } else {
        origPos++;
        normPos++;
      }
    }

    matches.push({ start, end: origPos });
    searchStart = origPos;
  }

  if (matches.length === 0) return null;

  if (!replaceAll && matches.length > 1) {
    throw new Error(
      `Found ${matches.length} matches with normalized whitespace. ` +
      `Provide more context to make it unique.`
    );
  }

  // Replace from end to preserve indices
  let result = content;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (!replaceAll && i > 0) continue;
    const { start, end } = matches[i];
    result = result.slice(0, start) + newString + result.slice(end);
  }

  return {
    content: result,
    matchCount: replaceAll ? matches.length : 1,
    strategy: 'whitespace_normalized',
  };
}

/**
 * Try matching using first and last lines as anchors
 */
function tryBlockAnchorMatch(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean
): { content: string; matchCount: number; strategy: string } | null {
  const oldLines = oldString.split('\n');
  if (oldLines.length < 2) return null;

  const firstLine = oldLines[0].trim();
  const lastLine = oldLines[oldLines.length - 1].trim();
  const contentLines = content.split('\n');

  const matches: Array<{ start: number; end: number }> = [];

  for (let i = 0; i < contentLines.length; i++) {
    if (contentLines[i].trim() === firstLine) {
      // Look for matching last line
      for (let j = i + oldLines.length - 1; j < contentLines.length; j++) {
        if (contentLines[j].trim() === lastLine) {
          // Verify middle lines match approximately
          const expectedLines = j - i + 1;
          if (Math.abs(expectedLines - oldLines.length) <= 2) {
            matches.push({ start: i, end: j + 1 });
            break;
          }
        }
      }
    }
  }

  if (matches.length === 0) return null;

  if (!replaceAll && matches.length > 1) {
    throw new Error(
      `Found ${matches.length} potential block matches. ` +
      `Provide more context to make it unique.`
    );
  }

  // Replace from end to preserve indices
  const newLines = newString.split('\n');
  for (let i = matches.length - 1; i >= 0; i--) {
    if (!replaceAll && i > 0) continue;
    const { start, end } = matches[i];
    contentLines.splice(start, end - start, ...newLines);
  }

  return {
    content: contentLines.join('\n'),
    matchCount: replaceAll ? matches.length : 1,
    strategy: 'block_anchor',
  };
}

/**
 * Try matching with flexible indentation
 */
function tryIndentationFlexibleMatch(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean
): { content: string; matchCount: number; strategy: string } | null {
  const oldLines = oldString.split('\n');
  const contentLines = content.split('\n');

  // Remove common leading indentation from oldString
  const oldIndents = oldLines.filter(l => l.trim()).map(l => l.match(/^\s*/)?.[0].length ?? 0);
  const minOldIndent = Math.min(...oldIndents);
  const dedentedOld = oldLines.map(l => l.slice(minOldIndent));

  const matches: Array<{ start: number; indent: number }> = [];

  for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
    // Get indent of first non-empty line
    let indent = 0;
    for (let j = 0; j < oldLines.length; j++) {
      if (contentLines[i + j].trim()) {
        indent = contentLines[i + j].match(/^\s*/)?.[0].length ?? 0;
        break;
      }
    }

    // Check if lines match with adjusted indentation
    let matched = true;
    for (let j = 0; j < oldLines.length; j++) {
      const contentLine = contentLines[i + j];
      const expectedLine = dedentedOld[j];
      
      if (!expectedLine.trim()) {
        if (contentLine.trim()) {
          matched = false;
          break;
        }
      } else {
        const reindented = ' '.repeat(indent) + expectedLine;
        if (contentLine !== reindented && contentLine.trim() !== expectedLine.trim()) {
          matched = false;
          break;
        }
      }
    }

    if (matched) {
      matches.push({ start: i, indent });
    }
  }

  if (matches.length === 0) return null;

  if (!replaceAll && matches.length > 1) {
    throw new Error(
      `Found ${matches.length} matches with flexible indentation. ` +
      `Provide more context to make it unique.`
    );
  }

  // Replace from end to preserve indices
  for (let i = matches.length - 1; i >= 0; i--) {
    if (!replaceAll && i > 0) continue;
    const { start, indent } = matches[i];
    
    // Reindent newString
    const newLines = newString.split('\n');
    const newIndents = newLines.filter(l => l.trim()).map(l => l.match(/^\s*/)?.[0].length ?? 0);
    const minNewIndent = Math.min(...newIndents);
    const reindentedNew = newLines.map(l => {
      if (!l.trim()) return l;
      return ' '.repeat(indent) + l.slice(minNewIndent);
    });

    contentLines.splice(start, oldLines.length, ...reindentedNew);
  }

  return {
    content: contentLines.join('\n'),
    matchCount: replaceAll ? matches.length : 1,
    strategy: 'indentation_flexible',
  };
}
