/**
 * Rebebuca AI Service Layer
 * Direct AI model integration without CLI tools
 * 
 * This module provides:
 * - Multi-provider support (Anthropic, OpenAI, Google, DeepSeek, etc.)
 * - Streaming responses with real-time updates
 * - Tool execution (read, write, edit, bash, glob, grep)
 * - Permission management for file access and command execution
 * - Session management for conversations
 */

// Core types
export * from './types';

// Provider management
export {
  createLanguageModel,
  validateApiKey,
  testProviderConnection,
  MODELS,
  getModelsForProvider,
  getModelInfo,
  PROVIDER_CONFIG,
} from './provider';

// Stream handling
export { streamResponse, type StreamInput, type StreamResult } from './stream';

// Session management
export { aiSessionManager, type AISession, type CreateSessionConfig } from './session';

// Tool system
export {
  getAllTools,
  getTool,
  getTools,
  getDefaultToolIds,
  readTool,
  writeTool,
  editTool,
  bashTool,
  globTool,
  grepTool,
} from './tools';

// Permission system
export {
  permissionManager,
  PermissionRejectedError,
  PermissionDeniedError,
} from './permission';

// Event bus for reactive updates
export { aiEventBus } from './utils/eventBus';

// Utility functions
export { generateId, generateSessionId, generateMessageId } from './utils/id';
