/**
 * Rebebuca AI Service Layer - Core Types
 * Copyright (C) 2025 rebebuca contributors
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { z } from 'zod';

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderType =
  | 'anthropic'   // Claude
  | 'openai'      // GPT-4
  | 'google'      // Gemini
  | 'deepseek'    // DeepSeek
  | 'glm'         // 智谱 GLM
  | 'kimi'        // Moonshot Kimi
  | 'custom';     // 自定义 OpenAI 兼容

export interface ProviderConfig {
  type: ProviderType;
  apiKey: string;
  baseUrl?: string;
  model: string;
  options?: ModelOptions;
}

export interface ModelOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderType;
  contextWindow: number;
  maxOutput: number;
  supportsTools: boolean;
  supportsVision: boolean;
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ImagePart {
  type: 'image';
  url: string;       // data URL or http URL
  mimeType?: string;
}

export interface FilePart {
  type: 'file';
  path: string;
  mimeType?: string;
  content?: string;  // base64 for binary
}

export interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  result: ToolExecuteResult;
}

export type MessagePart = TextPart | ImagePart | FilePart | ToolCallPart | ToolResultPart;

export interface Message {
  id: string;
  role: MessageRole;
  content: string | MessagePart[];
  createdAt: number;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface ToolDefinition<TParams extends z.ZodType = z.ZodType> {
  id: string;
  description: string;
  parameters: TParams;
}

export interface ToolContext {
  sessionId: string;
  projectPath: string;
  abortSignal: AbortSignal;
  
  /** 请求权限 */
  requestPermission(request: PermissionRequest): Promise<void>;
  
  /** 更新工具执行状态（用于 UI 实时反馈） */
  updateMetadata(metadata: Record<string, unknown>): void;
}

export interface ToolExecuteResult {
  title: string;
  output: string;
  metadata?: Record<string, unknown>;
  attachments?: FilePart[];
}

export interface Tool<TParams extends z.ZodType = z.ZodType> extends ToolDefinition<TParams> {
  execute(params: z.infer<TParams>, ctx: ToolContext): Promise<ToolExecuteResult>;
}

// ============================================================================
// Session Types
// ============================================================================

export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AISession {
  id: string;
  projectPath: string;
  provider: ProviderConfig;
  messages: Message[];
  tools: string[];           // 启用的工具 ID 列表
  systemPrompts: string[];
  status: SessionStatus;
  usage: TokenUsage;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSessionConfig {
  projectPath: string;
  provider: ProviderConfig;
  tools?: string[];
  systemPrompts?: string[];
}

// ============================================================================
// Stream Types
// ============================================================================

export type StreamEventType =
  | 'text-start'
  | 'text-delta'
  | 'reasoning-start'
  | 'reasoning-delta'
  | 'tool-call-start'
  | 'tool-call-delta'
  | 'tool-call'
  | 'tool-result'
  | 'finish'
  | 'error'
  | 'usage';

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
}

export interface TextStartEvent {
  type: 'text-start';
}

export interface TextDeltaEvent {
  type: 'text-delta';
  text: string;
}

export interface ReasoningStartEvent {
  type: 'reasoning-start';
}

export interface ReasoningDeltaEvent {
  type: 'reasoning-delta';
  text: string;
}

export interface ToolCallStartEvent {
  type: 'tool-call-start';
  toolCallId: string;
  toolName: string;
}

export interface ToolCallDeltaEvent {
  type: 'tool-call-delta';
  toolCallId: string;
  argsText: string;
}

export interface ToolCallEvent {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent {
  type: 'tool-result';
  toolCallId: string;
  result: ToolExecuteResult;
}

export interface FinishEvent {
  type: 'finish';
  reason: 'stop' | 'tool-calls' | 'length' | 'content-filter' | 'error';
}

export interface ErrorEvent {
  type: 'error';
  error: Error;
}

export interface UsageEvent {
  type: 'usage';
  usage: TokenUsage;
}

export type TypedStreamEvent =
  | TextStartEvent
  | TextDeltaEvent
  | ReasoningStartEvent
  | ReasoningDeltaEvent
  | ToolCallStartEvent
  | ToolCallDeltaEvent
  | ToolCallEvent
  | ToolResultEvent
  | FinishEvent
  | ErrorEvent
  | UsageEvent;

// ============================================================================
// Permission Types
// ============================================================================

export type PermissionType = 
  | 'read'              // 读取文件
  | 'write'             // 写入/创建文件
  | 'edit'              // 编辑文件
  | 'bash'              // 执行命令
  | 'external_directory' // 访问项目外目录
  | 'dangerous_command'; // 危险命令

export interface PermissionRequest {
  id?: string;
  type: PermissionType;
  path?: string;
  command?: string;
  patterns: string[];
  metadata?: Record<string, unknown>;
}

export interface PermissionRule {
  type: PermissionType;
  pattern: string;
  action: 'allow' | 'deny' | 'ask';
}

export type PermissionReply = 'allow' | 'deny' | 'always';

// ============================================================================
// Event Bus Types
// ============================================================================

export interface AIServiceEvents {
  // Session events
  'session:created': { session: AISession };
  'session:updated': { session: AISession };
  'session:message': { sessionId: string; message: Message };
  'session:status': { sessionId: string; status: SessionStatus };
  
  // Stream events
  'stream:event': { sessionId: string; event: TypedStreamEvent };
  
  // Tool events
  'tool:start': { sessionId: string; toolCallId: string; toolName: string };
  'tool:progress': { sessionId: string; toolCallId: string; metadata: Record<string, unknown> };
  'tool:complete': { sessionId: string; toolCallId: string; result: ToolExecuteResult };
  'tool:error': { sessionId: string; toolCallId: string; error: Error };
  
  // Permission events
  'permission:request': { request: PermissionRequest };
  'permission:reply': { requestId: string; reply: PermissionReply };
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface Disposable {
  dispose(): void;
}
