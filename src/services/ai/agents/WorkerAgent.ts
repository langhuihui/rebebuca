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
import { TaskProgressDocument } from './TaskProgressDocument';

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
  private lastExitReason: string | null = null;
  private lastDone: boolean = false;

  // Tool context
  private sessionId: string;
  private abortSignal: AbortSignal;
  protected abortController: AbortController | null = null;

  // Callbacks
  private onToolStart?: (toolName: string, args: Record<string, unknown>) => void;
  private onToolComplete?: (toolName: string, result: ToolExecuteResult) => void;
  private onToolError?: (toolName: string, error: Error) => void;
  private onPermissionRequest?: (request: PermissionRequest) => Promise<void>;

  // Auto-approve permissions flag
  private autoApprovePermissions: boolean = true;

  // Progress document for supervisor coordination
  protected progressDocument: TaskProgressDocument | null = null;

  constructor(config: {
    provider: AgentConfig['provider'];
    projectPath: string;
    tools?: string[];
    maxSteps?: number;
    sessionId?: string;
    taskName?: string;
    autoApprovePermissions?: boolean;
    skillsPrompt?: string;
    abortController?: AbortController;
    progressDocument?: TaskProgressDocument;
  }) {
    super({
      role: 'worker',
      provider: config.provider,
      systemPrompt: buildWorkerSystemPrompt(
        config.projectPath,
        config.skillsPrompt,
        config.taskName,
      ),
      maxSteps: config.maxSteps ?? 100,
      duplicateThreshold: 2,
      tools: config.tools,
    });
    
    this.projectPath = config.projectPath;
    this.enabledTools = config.tools ?? ['read', 'write', 'edit', 'bash', 'glob', 'grep'];
    this.sessionId = config.sessionId ?? generateUUID();
    this.abortSignal = config.abortController?.signal ?? new AbortController().signal;
    this.autoApprovePermissions = config.autoApprovePermissions ?? true;
    this.progressDocument = config.progressDocument ?? null;

    // Store abort controller reference
    if (config.abortController) {
      this.abortController = config.abortController;
    }
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
      
      // Validate tool call arguments before execution
      if (!toolCall.args || Object.keys(toolCall.args).length === 0) {
        const errorMsg = `Tool '${toolCall.name}' called with empty arguments. Please provide required parameters.`;
        console.warn(`[Worker] ${errorMsg}`);
        toolCall.status = 'error';
        toolCall.error = new Error(errorMsg);
        this.issues.push(`${toolCall.name} 执行失败: ${errorMsg}`);
        this.onToolError?.(toolCall.name, new Error(errorMsg));
        results.push(`[${toolCall.name}] 错误: ${errorMsg}`);
        this.addMessage('user', `工具执行错误 (${toolCall.name}):\n${errorMsg}`);
        continue;
      }
      
      try {
        const result = await this.executeTool(toolCall.name, toolCall.args);
        toolCall.status = 'completed';
        toolCall.result = result;

        console.log(`[Worker] Tool completed: ${toolCall.name}`, result.title);
        this.completedActions.push(`${toolCall.name}: ${result.title}`);
        this.onToolComplete?.(toolCall.name, result);

        results.push(`[${toolCall.name}] ${result.title}\n${result.output}`);

        // Update progress document
        this.progressDocument?.addAction({
          action: result.title,
          tool: toolCall.name,
          result: result.output.slice(0, 200),
        });
        this.progressDocument?.heartbeat();
        await this.progressDocument?.save();

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
    this.completedActions = [];
    this.issues = [];
    this.lastExitReason = null;
    this.lastDone = false;
    this.setState('running');

    // Read progress document to understand current state
    const progressContext = await this.buildProgressContext();

    // Update progress document with current action
    this.progressDocument?.updateProgress({
      currentAction: instruction.slice(0, 100),
    });
    await this.progressDocument?.save();

    // Build instruction with progress context
    const fullInstruction = this.buildInstructionWithContext(instruction, progressContext);
    const prompt = buildWorkerInstructionPrompt(fullInstruction);
    this.addMessage('user', prompt);
    
    // Run until complete or max steps
    let stepCount = 0;
    const maxInstructionSteps = this.maxSteps;
    
    while (this._state === 'running' && stepCount < maxInstructionSteps) {
      // Check abort signal
      if (this.abortController?.signal.aborted) {
        console.log('[Worker] Aborted during instruction execution');
        this.setState('idle');
        break;
      }
      
      stepCount++;
      await this.step();
      
      // Check abort after each step
      if (this.abortController?.signal.aborted) {
        console.log('[Worker] Aborted after step');
        this.setState('idle');
        break;
      }
    }

    const wasAborted = this.abortController?.signal.aborted ?? false;
    const reachedMaxSteps = stepCount >= maxInstructionSteps && this._state === 'running';
    const isCompleted = this._state === 'completed';
    const isError = this._state === 'error';

    const exitReason = isError
      ? 'error'
      : wasAborted
        ? 'aborted'
        : isCompleted
          ? 'completed'
          : reachedMaxSteps
            ? 'max_steps_reached'
            : 'stopped';

    this.lastExitReason = exitReason;
    this.lastDone = isCompleted;

    // Update progress document status based on execution result
    const report = this.generateReport();
    if (isError || !report.success) {
      this.progressDocument?.setStatus('error', report.issues?.join('; ') ?? this.issues.join('; '));
    } else if (isCompleted) {
      this.progressDocument?.setStatus('completed');
    } else if (wasAborted || reachedMaxSteps) {
      this.progressDocument?.setStatus('stopped');
    } else {
      this.progressDocument?.setStatus('running');
    }
    await this.progressDocument?.save();

    // Generate report
    return report;
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

  setProgressDocument(document: TaskProgressDocument): void {
    this.progressDocument = document;
  }

  getProgressDocument(): TaskProgressDocument | null {
    return this.progressDocument;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async buildProgressContext(): Promise<string> {
    if (!this.progressDocument) {
      return '';
    }

    const doc = await this.progressDocument.readFromDisk();
    if (!doc) {
      return '';
    }

    let context = '\n\n=== 任务进度上下文 ===\n';

    context += `当前状态: ${doc.status}\n`;
    context += `当前步骤: ${doc.progress.currentStep}/${doc.progress.totalSteps}\n`;

    if (doc.completedItems.length > 0) {
      context += `\n已完成事项 (${doc.completedItems.length}):\n`;
      doc.completedItems.forEach((item, i) => {
        context += `${i + 1}. ${item.description}\n`;
      });
    }

    if (doc.progress.completedMilestones.length > 0) {
      context += `\n已达成里程碑:\n`;
      doc.progress.completedMilestones.forEach((m, i) => {
        context += `${i + 1}. ${m}\n`;
      });
    }

    if (doc.recentActions.length > 0) {
      context += `\n最近操作:\n`;
      doc.recentActions.slice(-5).forEach((action) => {
        context += `- ${action.action} (${action.tool || 'unknown'})\n`;
      });
    }

    context += '\n=== 请根据以上进度继续工作 ===\n';

    return context;
  }

  private buildInstructionWithContext(instruction: string, progressContext: string): string {
    if (!progressContext) {
      return instruction;
    }
    return instruction + progressContext;
  }

  private async callLLMWithTools(tools: Tool[]): Promise<{
    content: string;
    toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  }> {
    // Check abort before calling LLM
    if (this.abortController?.signal.aborted) {
      console.log('[Worker] Aborted before LLM call');
      throw new Error('Execution aborted by user');
    }
    
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
    
    // Build tool definitions - pass Zod schemas directly to AI SDK
    // AI SDK expects Zod schemas, not JSON schemas
    const toolDefs = tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.id,
        description: tool.description,
        parameters: tool.parameters,  // Pass Zod schema directly
      },
    }));
    
    try {
      // Check abort again before making the actual API call
      if (this.abortController?.signal.aborted) {
        console.log('[Worker] Aborted right before LLM API call');
        throw new Error('Execution aborted by user');
      }
      
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
      const report = parsed.report ?? parsed;
      if (!report || typeof report.summary !== 'string') {
        return false;
      }
      const done =
        report.done === true ||
        parsed.done === true ||
        report.exitReason === 'completed' ||
        parsed.exitReason === 'completed' ||
        report.exit_reason === 'completed' ||
        parsed.exit_reason === 'completed';
      return done === true;
    } catch {
      // Check for report pattern with explicit completion
      return (
        content.includes('"report"') &&
        content.includes('"summary"') &&
        (content.includes('"done": true') ||
          content.includes('"exitReason":"completed"') ||
          content.includes('"exitReason": "completed"') ||
          content.includes('"exit_reason":"completed"') ||
          content.includes('"exit_reason": "completed"'))
      );
    }
  }
  
  private generateReport(): WorkerReport {
    const lastMessage = this.getLastAssistantMessage();
    if (lastMessage && typeof lastMessage.content === 'string') {
      try {
        const parsed = JSON.parse(lastMessage.content);
        if (parsed.report) {
          const report = parsed.report as WorkerReport;
          return {
            ...report,
            done: typeof report.done === 'boolean' ? report.done : this.lastDone,
            exitReason: report.exitReason ?? this.lastExitReason ?? undefined,
          };
        }
      } catch {
      }
    }

    const report: WorkerReport = {
      summary: this.completedActions.length > 0
        ? `执行了 ${this.completedActions.length} 个操作`
        : '未执行任何操作',
      success: this.issues.length === 0,
      actions: this.completedActions,
      issues: this.issues.length > 0 ? this.issues : undefined,
      done: this.lastDone,
      exitReason: this.lastExitReason ?? undefined,
    };

    if (report.success && report.actions.length > 0 && this.progressDocument) {
      for (const action of report.actions) {
        this.progressDocument.addCompletedItem({
          description: action,
        });
      }
    }

    return report;
  }
  
}
