/**
 * Rebebuca AI Service Layer - Tool Types
 */

import { z } from 'zod';
import type { Tool, ToolContext, ToolExecuteResult, PermissionRequest } from '../types';

export { z };
export type { Tool, ToolContext, ToolExecuteResult };

/**
 * Tool definition helper
 */
export function defineTool<TParams extends z.ZodType>(
  definition: Tool<TParams>
): Tool<TParams> {
  return definition;
}

/**
 * Create tool context for execution
 */
export interface CreateToolContextOptions {
  sessionId: string;
  projectPath: string;
  abortSignal: AbortSignal;
  onPermissionRequest: (request: PermissionRequest) => Promise<void>;
  onMetadataUpdate: (metadata: Record<string, unknown>) => void;
}

export function createToolContext(options: CreateToolContextOptions): ToolContext {
  return {
    sessionId: options.sessionId,
    projectPath: options.projectPath,
    abortSignal: options.abortSignal,
    requestPermission: options.onPermissionRequest,
    updateMetadata: options.onMetadataUpdate,
  };
}
