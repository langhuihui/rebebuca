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
  
  // Auto-approve permissions flag
  private autoApprovePermissions: boolean = true;
  
  constructor(config: {
    provider: AgentConfig['provider'];
    projectPath: string;
    tools?: string[];
    maxSteps?: number;
    sessionId?: string;
    autoApprovePermissions?: boolean;
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
    this.autoApprovePermissions = config.autoApprovePermissions ?? true;
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
      console.log('[Worker] No tools to execute');
      return 'No tools to execute';
    }
    
    console.log(`[Worker] Executing ${this.pendingToolCalls.length} tool(s):`, 
      this.pendingToolCalls.map(tc => `${tc.name}(${JSON.stringify(tc.args).slice(0, 100)})`));
    
    const results: string[] = [];
    let emptyArgsCount = 0;
    
    for (const toolCall of this.pendingToolCalls) {
      // Check for empty tool arguments - indicates model doesn't properly support function calling
      const hasEmptyArgs = !toolCall.args || Object.keys(toolCall.args).length === 0;
      if (hasEmptyArgs) {
        emptyArgsCount++;
        console.warn(`[Worker] Tool ${toolCall.name} received empty arguments - model may not properly support function calling`);
        
        // Provide clear feedback
        const errorMsg = `工具 ${toolCall.name} 参数为空。当前使用的模型可能不完全支持函数调用(Function Calling)。建议切换到支持函数调用的模型，如 Claude、GPT-4 或 DeepSeek。`;
        this.issues.push(errorMsg);
        results.push(`[${toolCall.name}] 错误: 参数为空 - 模型不支持函数调用`);
        this.addMessage('user', `工具执行错误 (${toolCall.name}):\n${errorMsg}`);
        continue;
      }
      
      toolCall.status = 'running';
      console.log(`[Worker] Starting tool: ${toolCall.name}`, toolCall.args);
      this.onToolStart?.(toolCall.name, toolCall.args);
      
      try {
        const result = await this.executeTool(toolCall.name, toolCall.args);
        toolCall.status = 'completed';
        toolCall.result = result;
        
        console.log(`[Worker] Tool completed: ${toolCall.name}`, result.title);
        this.completedActions.push(`${toolCall.name}: ${result.title}`);
        this.onToolComplete?.(toolCall.name, result);
        
        results.push(`[${toolCall.name}] ${result.title}\n${result.output}`);
        
        // Add tool result message
        this.addMessage('user', `工具执行结果 (${toolCall.name}):\n${result.output}`);
      } catch (error) {
        toolCall.status = 'error';
        toolCall.error = error as Error;
        
        console.error(`[Worker] Tool error: ${toolCall.name}`, error);
        this.issues.push(`${toolCall.name} 执行失败: ${(error as Error).message}`);
        this.onToolError?.(toolCall.name, error as Error);
        
        results.push(`[${toolCall.name}] 错误: ${(error as Error).message}`);
        
        // Add error message
        this.addMessage('user', `工具执行错误 (${toolCall.name}):\n${(error as Error).message}`);
      }
    }
    
    // If all tool calls had empty args, this is a critical issue with the model
    if (emptyArgsCount === this.pendingToolCalls.length && emptyArgsCount > 0) {
      console.error('[Worker] CRITICAL: All tool calls have empty arguments. The model does not support function calling properly.');
      this.issues.push('严重错误: 所有工具调用的参数都为空。当前模型不支持函数调用。请更换模型后重试。');
      this.setState('error');
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
        toolCalls: response.toolCalls?.map(tc => {
          let args: Record<string, unknown> = {};
          try {
            if (typeof tc.function.arguments === 'string') {
              args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
            } else if (tc.function.arguments && typeof tc.function.arguments === 'object') {
              args = tc.function.arguments as Record<string, unknown>;
            }
          } catch (e) {
            console.warn(`[Worker] Failed to parse tool arguments for ${tc.function.name}:`, tc.function.arguments, e);
          }
          
          console.log(`[Worker] Tool call parsed: ${tc.function.name}`, args);
          
          return {
            id: tc.id,
            name: tc.function.name,
            args,
          };
        }),
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
        // Auto-approve if enabled, otherwise call the handler
        if (this.autoApprovePermissions) {
          console.log(`[Worker] Auto-approving permission: ${request.type} - ${request.path || request.command || 'unknown'}`);
          return; // Auto-approve by returning immediately
        }
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
