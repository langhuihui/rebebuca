/**
 * Rebebuca AI Agent System - Dual Agent Orchestrator
 * Copyright (C) 2025 rebebuca contributors
 * 
 * The Orchestrator manages the interaction between Supervisor and Worker agents.
 * It monitors both agents and ensures the task progresses until completion.
 */

import { SupervisorAgent } from './SupervisorAgent';
import { WorkerAgent } from './WorkerAgent';
import type {
  DualAgentSession,
  DualAgentSessionStatus,
  DualAgentConfig,
  DualAgentEvents,
  SupervisorDecision,
  WorkerReport,
  AgentMessage,
  AgentRole,
} from './types';
import type { PermissionRequest, PermissionReply } from '../types';

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

type EventCallback<K extends keyof DualAgentEvents> = (data: DualAgentEvents[K]) => void;

export class DualAgentOrchestrator {
  private session: DualAgentSession;
  private supervisor: SupervisorAgent;
  private worker: WorkerAgent;
  
  // Control
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private abortController: AbortController | null = null;
  
  // Permission handling
  private pendingPermissions: Map<string, {
    request: PermissionRequest;
    resolve: (reply: PermissionReply) => void;
  }> = new Map();
  
  // Event emitters
  private eventListeners: Map<keyof DualAgentEvents, Set<EventCallback<any>>> = new Map();
  
  constructor(config: DualAgentConfig) {
    const sessionId = generateUUID();
    
    // Initialize session
    this.session = {
      id: sessionId,
      projectPath: config.projectPath,
      supervisorProvider: config.supervisorProvider,
      workerProvider: config.workerProvider,
      goal: config.goal,
      progress: {
        currentStep: 0,
        totalSteps: config.goal.acceptanceCriteria.length * 3,
        completedMilestones: [],
        currentAction: '准备开始',
        isStuck: false,
        stuckCount: 0,
      },
      conversation: [],
      supervisorState: 'idle',
      workerState: 'idle',
      status: 'idle',
      usage: {
        supervisor: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        worker: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        total: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      },
      loop: {
        currentRound: 0,
        maxRounds: config.maxRounds ?? 10,
        maxStepsPerRound: config.maxStepsPerRound ?? 20,
        currentStepInRound: 0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    // Initialize agents
    this.supervisor = new SupervisorAgent({
      provider: config.supervisorProvider,
      goal: config.goal,
      projectPath: config.projectPath,
      maxSteps: config.maxRounds ?? 10,
    });
    
    this.worker = new WorkerAgent({
      provider: config.workerProvider,
      projectPath: config.projectPath,
      tools: config.workerTools ?? ['read', 'write', 'edit', 'bash', 'glob', 'grep'],
      maxSteps: config.maxStepsPerRound ?? 20,
      sessionId,
    });
    
    // Setup event handlers
    this.setupAgentEventHandlers();
  }
  
  // ============================================================================
  // Public API
  // ============================================================================
  
  /**
   * 获取会话信息
   */
  getSession(): DualAgentSession {
    return { ...this.session };
  }
  
  /**
   * 获取会话 ID
   */
  getSessionId(): string {
    return this.session.id;
  }
  
  /**
   * 开始执行任务
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Session is already running');
    }
    
    this.isRunning = true;
    this.isPaused = false;
    this.abortController = new AbortController();
    
    this.updateStatus('running');
    
    try {
      await this.runLoop();
    } catch (error) {
      console.error('[Orchestrator] Error during execution:', error);
      this.updateStatus('error');
      this.emit('error', { sessionId: this.session.id, error: error as Error });
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * 暂停执行
   */
  pause(): void {
    this.isPaused = true;
    this.updateStatus('paused');
  }
  
  /**
   * 恢复执行
   */
  async resume(): Promise<void> {
    if (!this.isPaused) {
      return;
    }
    
    this.isPaused = false;
    this.updateStatus('running');
    
    if (!this.isRunning) {
      await this.start();
    }
  }
  
  /**
   * 停止执行
   */
  stop(): void {
    this.abortController?.abort();
    this.isRunning = false;
    this.isPaused = false;
    this.supervisor.stop();
    this.worker.stop();
    this.updateStatus('idle');
  }
  
  /**
   * 响应权限请求
   */
  replyPermission(requestId: string, reply: PermissionReply): void {
    const pending = this.pendingPermissions.get(requestId);
    if (pending) {
      pending.resolve(reply);
      this.pendingPermissions.delete(requestId);
    }
  }
  
  /**
   * 获取待处理的权限请求
   */
  getPendingPermissions(): PermissionRequest[] {
    return Array.from(this.pendingPermissions.values()).map(p => p.request);
  }
  
  // ============================================================================
  // Event System
  // ============================================================================
  
  on<K extends keyof DualAgentEvents>(event: K, callback: EventCallback<K>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }
  
  private emit<K extends keyof DualAgentEvents>(event: K, data: DualAgentEvents[K]): void {
    this.eventListeners.get(event)?.forEach(callback => callback(data));
  }
  
  // ============================================================================
  // Core Loop
  // ============================================================================
  
  private async runLoop(): Promise<void> {
    console.log('[Orchestrator] Starting main loop');
    
    // Step 1: Get initial instruction from Supervisor
    this.addConversationMessage('supervisor', 'worker', 'instruction', '分析任务并制定计划...');
    
    let decision: SupervisorDecision;
    try {
      decision = await this.supervisor.startTask();
    } catch (error) {
      console.error('[Orchestrator] Supervisor failed to start:', error);
      throw error;
    }
    
    // Main loop
    while (
      this.isRunning &&
      !this.isPaused &&
      this.session.loop.currentRound < this.session.loop.maxRounds &&
      !this.abortController?.signal.aborted
    ) {
      this.session.loop.currentRound++;
      this.session.loop.currentStepInRound = 0;
      
      console.log(`[Orchestrator] Round ${this.session.loop.currentRound}/${this.session.loop.maxRounds}`);
      
      // Handle decision
      if (decision.type === 'complete') {
        this.handleComplete(decision.summary);
        return;
      }
      
      if (decision.type === 'abort') {
        this.handleAbort(decision.reason);
        return;
      }
      
      // Get instruction
      const instruction = decision.type === 'continue' || decision.type === 'retry'
        ? decision.instruction
        : '';
      
      if (!instruction) {
        console.error('[Orchestrator] No instruction from supervisor');
        break;
      }
      
      // Add supervisor instruction to conversation
      this.addConversationMessage('supervisor', 'worker', 'instruction', instruction);
      
      // Execute with Worker
      let report: WorkerReport;
      try {
        report = await this.worker.executeInstruction(instruction);
      } catch (error) {
        console.error('[Orchestrator] Worker failed:', error);
        report = {
          summary: `执行失败: ${(error as Error).message}`,
          success: false,
          actions: [],
          issues: [(error as Error).message],
        };
      }
      
      // Add worker report to conversation
      this.addConversationMessage('worker', 'supervisor', 'report', this.formatWorkerReport(report), {
        filesChanged: report.actions.filter(a => a.includes('write') || a.includes('edit')),
        commandsRun: report.actions.filter(a => a.includes('bash')),
      });
      
      // Update usage
      this.updateUsage();
      
      // Get next decision from Supervisor
      try {
        decision = await this.supervisor.handleWorkerReport(JSON.stringify(report));
      } catch (error) {
        console.error('[Orchestrator] Supervisor failed to respond:', error);
        // Try to recover by asking supervisor to continue
        decision = {
          type: 'continue',
          instruction: '请继续之前的任务，上一步执行遇到了问题。',
        };
      }
      
      // Check for stuck state
      if (this.isStuck()) {
        console.warn('[Orchestrator] Detected stuck state');
        this.session.progress.stuckCount++;
        
        if (this.session.progress.stuckCount >= 3) {
          this.handleAbort('任务陷入循环，无法继续');
          return;
        }
      }
      
      // Small delay to prevent rate limiting
      await this.delay(500);
    }
    
    // If we exit the loop without completion
    if (this.session.loop.currentRound >= this.session.loop.maxRounds) {
      this.handleAbort(`达到最大轮次限制 (${this.session.loop.maxRounds})`);
    }
  }
  
  // ============================================================================
  // Helpers
  // ============================================================================
  
  private setupAgentEventHandlers(): void {
    // Supervisor events
    this.supervisor.setOnStateChange((state) => {
      this.session.supervisorState = state;
      this.emit('agent:state', { sessionId: this.session.id, role: 'supervisor', state });
    });
    
    this.supervisor.setOnProgressUpdate((progress) => {
      this.session.progress = progress;
      this.emit('progress:update', { sessionId: this.session.id, progress });
    });
    
    // Worker events
    this.worker.setOnStateChange((state) => {
      this.session.workerState = state;
      this.emit('agent:state', { sessionId: this.session.id, role: 'worker', state });
    });
    
    this.worker.setOnToolStart((toolName) => {
      this.emit('worker:tool', { sessionId: this.session.id, toolName, status: 'start' });
    });
    
    this.worker.setOnToolComplete((toolName) => {
      this.emit('worker:tool', { sessionId: this.session.id, toolName, status: 'complete' });
    });
    
    this.worker.setOnToolError((toolName) => {
      this.emit('worker:tool', { sessionId: this.session.id, toolName, status: 'error' });
    });
    
    this.worker.setOnPermissionRequest(async (request) => {
      return new Promise((resolve) => {
        const requestId = request.id || generateUUID();
        request.id = requestId;
        
        this.pendingPermissions.set(requestId, {
          request,
          resolve: (reply) => {
            if (reply === 'allow' || reply === 'always') {
              resolve();
            } else {
              throw new Error('Permission denied');
            }
          },
        });
        
        this.emit('worker:tool', { 
          sessionId: this.session.id, 
          toolName: 'permission_request', 
          status: 'start',
        });
      });
    });
  }
  
  private addConversationMessage(
    from: AgentRole,
    to: AgentRole,
    type: AgentMessage['type'],
    content: string,
    metadata?: AgentMessage['metadata']
  ): void {
    const message: AgentMessage = {
      id: generateUUID(),
      timestamp: Date.now(),
      from,
      to,
      type,
      content,
      metadata,
    };
    
    this.session.conversation.push(message);
    this.session.updatedAt = Date.now();
    
    this.emit('conversation:message', { sessionId: this.session.id, message });
  }
  
  private formatWorkerReport(report: WorkerReport): string {
    let formatted = `**执行结果**: ${report.success ? '成功' : '失败'}\n\n`;
    formatted += `**摘要**: ${report.summary}\n\n`;
    
    if (report.actions.length > 0) {
      formatted += '**执行操作**:\n';
      report.actions.forEach(action => {
        formatted += `- ${action}\n`;
      });
      formatted += '\n';
    }
    
    if (report.issues && report.issues.length > 0) {
      formatted += '**遇到问题**:\n';
      report.issues.forEach(issue => {
        formatted += `- ${issue}\n`;
      });
      formatted += '\n';
    }
    
    if (report.needsDecision) {
      formatted += `**需要决策**: ${report.needsDecision}\n`;
    }
    
    return formatted;
  }
  
  private updateStatus(status: DualAgentSessionStatus): void {
    this.session.status = status;
    this.session.updatedAt = Date.now();
    this.emit('session:status', { sessionId: this.session.id, status });
  }
  
  private updateUsage(): void {
    const supervisorUsage = this.supervisor.getUsage();
    const workerUsage = this.worker.getUsage();
    
    this.session.usage = {
      supervisor: supervisorUsage,
      worker: workerUsage,
      total: {
        promptTokens: supervisorUsage.promptTokens + workerUsage.promptTokens,
        completionTokens: supervisorUsage.completionTokens + workerUsage.completionTokens,
        totalTokens: supervisorUsage.totalTokens + workerUsage.totalTokens,
      },
    };
  }
  
  private handleComplete(summary: string): void {
    this.addConversationMessage('supervisor', 'worker', 'completion', summary, {
      isKeyPoint: true,
    });
    this.updateStatus('completed');
    this.isRunning = false;
    this.emit('complete', { sessionId: this.session.id, summary });
  }
  
  private handleAbort(reason: string): void {
    this.addConversationMessage('supervisor', 'worker', 'error', reason, {
      isKeyPoint: true,
    });
    this.updateStatus('error');
    this.isRunning = false;
    this.emit('error', { sessionId: this.session.id, error: new Error(reason) });
  }
  
  private isStuck(): boolean {
    // Check if last few messages are similar
    const recentMessages = this.session.conversation.slice(-4);
    if (recentMessages.length < 4) return false;
    
    const instructionContents = recentMessages
      .filter(m => m.type === 'instruction')
      .map(m => m.content);
    
    if (instructionContents.length < 2) return false;
    
    // Check for duplicate instructions
    return instructionContents[0] === instructionContents[1];
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
