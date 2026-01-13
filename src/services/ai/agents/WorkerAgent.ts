/**
 * Rebebuca AI Agent System - Worker Agent
 * Copyright (C) 2025 rebebuca contributors
 * 
 * The Worker agent is responsible for:
 * - Receiving instructions from Supervisor
 * - Executing tasks using available tools
 * - Reporting results back to Supervisor
 */

import { BaseAgent } from './BaseAgent';
import type { AgentConfig, WorkerReport } from './types';
import type { Tool, ToolContext, ToolExecuteResult, PermissionRequest } from '../types';
import { buildWorkerSystemPrompt, buildWorkerInstructionPrompt } from './prompts';
import { getToolRegistry } from '../tools';

// Helper to generate UUIDs using crypto
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: ToolExecuteResult;
  error?: Error;
}

export class WorkerAgent extends BaseAgent {
  private projectPath: string;
  private enabledTools: string[];
  private pendingToolCalls: ToolCall[] = [];
  private completedActions: string[] = [];
  private issues: string[] = [];
  
  // Tool context
  private sessionId: string;
  private abortSignal: AbortSignal;
  
  // Callbacks
  private onToolStart?: (toolName: string, args: Record<string, unknown>) => void;
  private onToolComplete?: (toolName: string, result: ToolExecuteResult) => void;
  private onToolError?: (toolName: string, error: Error) => void;
  private onPermissionRequest?: (request: PermissionRequest) => Promise<void>;
  
  constructor(config: {
    provider: AgentConfig['provider'];
    projectPath: string;
    tools?: string[];
    maxSteps?: number;
    sessionId?: string;
  }) {
    super({
      role: 'worker',
      provider: config.provider,
      systemPrompt: buildWorkerSystemPrompt(config.projectPath),
      maxSteps: config.maxSteps ?? 30,
      duplicateThreshold: 2,
      tools: config.tools,
    });
    
    this.projectPath = config.projectPath;
    this.enabledTools = config.tools ?? ['read', 'write', 'edit', 'bash', 'glob', 'grep'];
    this.sessionId = config.sessionId ?? generateUUID();
    this.abortSignal = new AbortController().signal;
  }
  
  // ============================================================================
  // Abstract Implementation
  // ============================================================================
  
  protected async think(): Promise<boolean> {
    // Build tool definitions for LLM
    const toolRegistry = getToolRegistry();
    const tools = this.enabledTools
      .map(id => toolRegistry.get(id))
      .filter((t): t is Tool => t !== undefined);
    
    // Call LLM with tools
    const response = await this.callLLMWithTools(tools);
    
    // Parse response to check for tool calls
    if (response.toolCalls && response.toolCalls.length > 0) {
      this.pendingToolCalls = response.toolCalls.map(tc => ({
        id: tc.id,
        name: tc.name,
        args: tc.args,
        status: 'pending' as const,
      }));
      
      // Add assistant message with tool calls info
      this.addMessage('assistant', response.content || `正在执行工具: ${response.toolCalls.map(tc => tc.name).join(', ')}`);
      
      return true;
    }
    
    // No tool calls, add the response
    this.addMessage('assistant', response.content);
    
    // Check if this is a final report
    if (this.isWorkerReport(response.content)) {
      this.setState('completed');
      return false;
    }
    
    return false;
  }
  
  protected async act(): Promise<string> {
    if (this.pendingToolCalls.length === 0) {
      return 'No tools to execute';
    }
    
    const results: string[] = [];
    
    for (const toolCall of this.pendingToolCalls) {
      toolCall.status = 'running';
      this.onToolStart?.(toolCall.name, toolCall.args);
      
      try {
        const result = await this.executeTool(toolCall.name, toolCall.args);
        toolCall.status = 'completed';
        toolCall.result = result;
        
        this.completedActions.push(`${toolCall.name}: ${result.title}`);
        this.onToolComplete?.(toolCall.name, result);
        
        results.push(`[${toolCall.name}] ${result.title}\n${result.output}`);
        
        // Add tool result message
        this.addMessage('user', `工具执行结果 (${toolCall.name}):\n${result.output}`);
      } catch (error) {
        toolCall.status = 'error';
        toolCall.error = error as Error;
        
        this.issues.push(`${toolCall.name} 执行失败: ${(error as Error).message}`);
        this.onToolError?.(toolCall.name, error as Error);
        
        results.push(`[${toolCall.name}] 错误: ${(error as Error).message}`);
        
        // Add error message
        this.addMessage('user', `工具执行错误 (${toolCall.name}):\n${(error as Error).message}`);
      }
    }
    
    this.pendingToolCalls = [];
    return results.join('\n\n');
  }
  
  // ============================================================================
  // Public Methods
  // ============================================================================
  
  /**
   * 执行指令
   */
  async executeInstruction(instruction: string): Promise<WorkerReport> {
    // Reset state
    this.completedActions = [];
    this.issues = [];
    this.setState('running');
    
    // Add instruction
    const prompt = buildWorkerInstructionPrompt(instruction);
    this.addMessage('user', prompt);
    
    // Run until complete or max steps
    let stepCount = 0;
    const maxInstructionSteps = 10;
    
    while (this._state === 'running' && stepCount < maxInstructionSteps) {
      stepCount++;
      await this.step();
    }
    
    // Generate report
    return this.generateReport();
  }
  
  /**
   * 获取最后的报告
   */
  getLastReport(): WorkerReport {
    return this.generateReport();
  }
  
  // ============================================================================
  // Event Handlers
  // ============================================================================
  
  setOnToolStart(handler: (toolName: string, args: Record<string, unknown>) => void): void {
    this.onToolStart = handler;
  }
  
  setOnToolComplete(handler: (toolName: string, result: ToolExecuteResult) => void): void {
    this.onToolComplete = handler;
  }
  
  setOnToolError(handler: (toolName: string, error: Error) => void): void {
    this.onToolError = handler;
  }
  
  setOnPermissionRequest(handler: (request: PermissionRequest) => Promise<void>): void {
    this.onPermissionRequest = handler;
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private async callLLMWithTools(tools: Tool[]): Promise<{
    content: string;
    toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  }> {
    const { createProvider } = await import('../provider');
    const llmProvider = createProvider(this.provider);
    
    // Build messages
    const llmMessages = [
      { role: 'system' as const, content: this.systemPrompt },
      ...this.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
    ];
    
    // Build tool definitions
    const toolDefs = tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.id,
        description: tool.description,
        parameters: tool.parameters ? this.zodToJsonSchema(tool.parameters) : { type: 'object', properties: {} },
      },
    }));
    
    try {
      const response = await llmProvider.chatWithTools(llmMessages, toolDefs, {
        stream: false,
      });
      
      // Update usage
      if (response.usage) {
        this.usage.promptTokens += response.usage.promptTokens;
        this.usage.completionTokens += response.usage.completionTokens;
        this.usage.totalTokens += response.usage.totalTokens;
      }
      
      return {
        content: response.content || '',
        toolCalls: response.toolCalls?.map(tc => ({
          id: tc.id,
          name: tc.function.name,
          args: typeof tc.function.arguments === 'string' 
            ? JSON.parse(tc.function.arguments) 
            : tc.function.arguments,
        })),
      };
    } catch (error) {
      console.error('[Worker] LLM call failed:', error);
      throw error;
    }
  }
  
  private async executeTool(name: string, args: Record<string, unknown>): Promise<ToolExecuteResult> {
    const toolRegistry = getToolRegistry();
    const tool = toolRegistry.get(name);
    
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    // Create tool context
    const ctx: ToolContext = {
      sessionId: this.sessionId,
      projectPath: this.projectPath,
      abortSignal: this.abortSignal,
      requestPermission: async (request) => {
        if (this.onPermissionRequest) {
          await this.onPermissionRequest(request);
        }
      },
      updateMetadata: () => {},
    };
    
    // Execute tool
    return await tool.execute(args, ctx);
  }
  
  private isWorkerReport(content: string): boolean {
    try {
      const parsed = JSON.parse(content);
      return 'report' in parsed && 'summary' in parsed.report;
    } catch {
      // Check for report pattern
      return content.includes('"report"') && content.includes('"summary"');
    }
  }
  
  private generateReport(): WorkerReport {
    // Try to extract from last message
    const lastMessage = this.getLastAssistantMessage();
    if (lastMessage && typeof lastMessage.content === 'string') {
      try {
        const parsed = JSON.parse(lastMessage.content);
        if (parsed.report) {
          return parsed.report;
        }
      } catch {
        // Fall through to generate from actions
      }
    }
    
    // Generate from completed actions
    return {
      summary: this.completedActions.length > 0 
        ? `执行了 ${this.completedActions.length} 个操作` 
        : '未执行任何操作',
      success: this.issues.length === 0,
      actions: this.completedActions,
      issues: this.issues.length > 0 ? this.issues : undefined,
    };
  }
  
  private zodToJsonSchema(zodSchema: any): any {
    // Simplified Zod to JSON Schema conversion
    // In production, you'd want to use a proper library like zod-to-json-schema
    if (zodSchema._def) {
      const def = zodSchema._def;
      
      if (def.typeName === 'ZodObject') {
        const properties: any = {};
        const required: string[] = [];
        
        for (const [key, value] of Object.entries(def.shape())) {
          properties[key] = this.zodToJsonSchema(value);
          if (!((value as any)._def?.typeName === 'ZodOptional')) {
            required.push(key);
          }
        }
        
        return {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined,
        };
      }
      
      if (def.typeName === 'ZodString') {
        return { type: 'string', description: def.description };
      }
      
      if (def.typeName === 'ZodNumber') {
        return { type: 'number', description: def.description };
      }
      
      if (def.typeName === 'ZodBoolean') {
        return { type: 'boolean', description: def.description };
      }
      
      if (def.typeName === 'ZodArray') {
        return { 
          type: 'array', 
          items: this.zodToJsonSchema(def.type),
          description: def.description,
        };
      }
      
      if (def.typeName === 'ZodOptional') {
        return this.zodToJsonSchema(def.innerType);
      }
    }
    
    return { type: 'string' };
  }
}
