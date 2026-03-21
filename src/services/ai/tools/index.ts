/**
 * Rebebuca AI Service Layer - Tool Registry
 * Central registry for all available tools
 */

import type { Tool, ToolContext } from '../types';
import { readTool } from './read';
import { writeTool } from './write';
import { editTool } from './edit';
import { bashTool } from './bash';
import { globTool } from './glob';
import { grepTool } from './grep';

// Re-export types
export * from './types';

// All available tools
const ALL_TOOLS: Tool[] = [
  readTool,
  writeTool,
  editTool,
  bashTool,
  globTool,
  grepTool,
];

// Tool ID to Tool mapping
const toolMap = new Map<string, Tool>();
for (const tool of ALL_TOOLS) {
  toolMap.set(tool.id, tool);
}

/**
 * Get the tool registry map
 */
export function getToolRegistry(): Map<string, Tool> {
  return toolMap;
}

/**
 * Get all available tools
 */
export function getAllTools(): Tool[] {
  return ALL_TOOLS;
}

/**
 * Get tool by ID
 */
export function getTool(id: string): Tool | undefined {
  return toolMap.get(id);
}

/**
 * Get tools by IDs
 */
export function getTools(ids: string[]): Tool[] {
  return ids.map(id => toolMap.get(id)).filter((t): t is Tool => t !== undefined);
}

/**
 * Get default tool IDs for a new session
 */
export function getDefaultToolIds(): string[] {
  return ['read', 'write', 'edit', 'bash', 'glob', 'grep'];
}

/**
 * Convert tools to AI SDK format
 */
export function toolsToAIFormat(
  tools: Tool[],
  createContext: (toolCallId: string) => ToolContext
): Record<string, {
  description: string;
  parameters: unknown;
  execute: (args: unknown, options: { toolCallId: string }) => Promise<unknown>;
}> {
  const result: Record<string, {
    description: string;
    parameters: unknown;
    execute: (args: unknown, options: { toolCallId: string }) => Promise<unknown>;
  }> = {};

  for (const tool of tools) {
    result[tool.id] = {
      description: tool.description,
      parameters: tool.parameters,
      execute: async (args, options) => {
        const ctx = createContext(options.toolCallId);
        return tool.execute(args as Parameters<typeof tool.execute>[0], ctx);
      },
    };
  }

  return result;
}

// Export individual tools
export { readTool } from './read';
export { writeTool } from './write';
export { editTool } from './edit';
export { bashTool } from './bash';
export { globTool } from './glob';
export { grepTool } from './grep';
