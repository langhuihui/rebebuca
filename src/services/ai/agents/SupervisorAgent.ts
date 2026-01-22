/**
 * Rebebuca AI Agent System - Supervisor Agent
 * Copyright (C) 2025 rebebuca contributors
 * 
 * The Supervisor agent is responsible for:
 * - Breaking down tasks into steps
 * - Giving instructions to the Worker
 * - Evaluating Worker's reports
 * - Deciding when the task is complete
 */

import { BaseAgent } from './BaseAgent';
import type { AgentConfig, SupervisorDecision, TaskGoal, TaskProgress } from './types';
import { buildSupervisorSystemPrompt, buildInitialPrompt, buildSupervisorReviewPrompt } from './prompts';
import { TaskProgressDocument, type ProgressDocument } from './TaskProgressDocument';

export class SupervisorAgent extends BaseAgent {
  private goal: TaskGoal;
  private progress: TaskProgress;
  private pendingDecision: SupervisorDecision | null = null;
  private progressDocument: TaskProgressDocument | null = null;

  // Callbacks
  private onDecision?: (decision: SupervisorDecision) => void;
  private onProgressUpdate?: (progress: TaskProgress) => void;

  constructor(config: {
    provider: AgentConfig['provider'];
    goal: TaskGoal;
    projectPath: string;
    maxSteps?: number;
    progressDocument?: TaskProgressDocument;
  }) {
    super({
      role: 'supervisor',
      provider: config.provider,
      systemPrompt: buildSupervisorSystemPrompt(config.goal, config.projectPath),
      maxSteps: config.maxSteps ?? 100,
      duplicateThreshold: 2,
    });

    this.goal = config.goal;
    this.progress = {
      currentStep: 0,
      totalSteps: config.goal.acceptanceCriteria.length * 3,
      completedMilestones: [],
      currentAction: '分析任务',
      isStuck: false,
      stuckCount: 0,
    };
    this.progressDocument = config.progressDocument ?? null;
  }
  
  // ============================================================================
  // Abstract Implementation
  // ============================================================================
  
  protected async think(): Promise<boolean> {
    // Call LLM to get decision
    const response = await this.callLLM();
    
    // Add assistant message
    this.addMessage('assistant', response);
    
    // Parse decision from response
    try {
      this.pendingDecision = this.parseDecision(response);
      return true;
    } catch (error) {
      console.error('[Supervisor] Failed to parse decision:', error);
      // Add error message and retry
      this.addMessage('user', '你的响应格式不正确，请使用正确的 JSON 格式输出决策。');
      return false;
    }
  }
  
  protected async act(): Promise<string> {
    if (!this.pendingDecision) {
      return 'No decision to act on';
    }
    
    const decision = this.pendingDecision;
    this.pendingDecision = null;
    
    // Emit decision event
    this.onDecision?.(decision);
    
    // Handle different decision types
    switch (decision.type) {
      case 'continue':
        this.updateProgress({
          currentStep: this.progress.currentStep + 1,
          currentAction: decision.instruction,
        });
        // Set state to waiting for worker
        this.setState('waiting');
        return `Instruction: ${decision.instruction}`;
        
      case 'retry':
        this.updateProgress({
          currentAction: `重试: ${decision.instruction}`,
        });
        this.setState('waiting');
        return `Retry: ${decision.reason}\nInstruction: ${decision.instruction}`;
        
      case 'complete':
        this.updateProgress({
          currentAction: '任务完成',
        });
        this.setState('completed');
        return `Complete: ${decision.summary}`;
        
      case 'abort':
        this.setState('error');
        return `Abort: ${decision.reason}`;
        
      default:
        return 'Unknown decision type';
    }
  }
  
  // ============================================================================
  // Public Methods
  // ============================================================================
  
  /**
   * 开始新任务
   */
  async startTask(): Promise<SupervisorDecision> {
    const initialPrompt = buildInitialPrompt(this.goal);
    this.addMessage('user', initialPrompt);
    
    await this.step();
    
    if (this.pendingDecision) {
      const decision = this.pendingDecision;
      this.pendingDecision = null;
      return decision;
    }
    
    // Get the last decision from messages
    const lastMessage = this.getLastAssistantMessage();
    if (lastMessage) {
      return this.parseDecision(typeof lastMessage.content === 'string' 
        ? lastMessage.content 
        : JSON.stringify(lastMessage.content));
    }
    
    throw new Error('Failed to get initial decision');
  }
  
  /**
   * 处理 Worker 的报告并返回下一步决策
   */
  async handleWorkerReport(report: string): Promise<SupervisorDecision> {
    // Resume from waiting state
    if (this._state === 'waiting') {
      this.setState('running');
    }
    
    const reviewPrompt = buildSupervisorReviewPrompt(report, {
      currentStep: this.progress.currentStep,
      completedMilestones: this.progress.completedMilestones,
    });
    
    this.addMessage('user', reviewPrompt);
    
    await this.step();
    
    // Get decision
    const lastMessage = this.getLastAssistantMessage();
    if (lastMessage) {
      const decision = this.parseDecision(typeof lastMessage.content === 'string' 
        ? lastMessage.content 
        : JSON.stringify(lastMessage.content));
      
      // Handle milestone completion
      if (decision.type === 'continue' && 'milestone' in decision && decision.milestone) {
        this.updateProgress({
          completedMilestones: [...this.progress.completedMilestones, decision.milestone as string],
        });
      }
      
      return decision;
    }
    
    throw new Error('Failed to get decision after worker report');
  }
  
  /**
   * 获取当前进度
   */
  getProgress(): TaskProgress {
    return { ...this.progress };
  }
  
  /**
   * 获取目标
   */
  getGoal(): TaskGoal {
    return { ...this.goal };
  }

  /**
   * 设置进度文档
   */
  setProgressDocument(document: TaskProgressDocument): void {
    this.progressDocument = document;
  }

  /**
   * 从进度文档评估任务是否完成
   * 当 Worker 停止时，Supervisor 可以调用此方法检查进度文档来判断任务状态
   */
  async evaluateFromProgressDocument(): Promise<SupervisorDecision> {
    if (!this.progressDocument) {
      return {
        type: 'continue',
        instruction: '无法访问进度文档，继续执行任务',
      };
    }

    const doc = await this.progressDocument.readFromDisk();
    if (!doc) {
      return {
        type: 'continue',
        instruction: '进度文档不存在，继续执行任务',
      };
    }

    console.log('[Supervisor] Evaluating progress document:', {
      status: doc.status,
      completedItems: doc.completedItems.length,
      progress: doc.progress.currentStep,
    });

    switch (doc.status) {
      case 'completed':
        return {
          type: 'complete',
          summary: `任务已完成。共完成 ${doc.completedItems.length} 个事项。`,
        };

      case 'error':
        return {
          type: 'abort',
          reason: `Worker 遇到错误: ${doc.error?.message || '未知错误'}`,
        };

      case 'stopped':
        const completedCriteria = this.evaluateAcceptanceCriteria(doc);
        const completionPercentage = completedCriteria / this.goal.acceptanceCriteria.length;

        if (completionPercentage >= 0.8) {
          return {
            type: 'complete',
            summary: `任务基本完成 (${Math.round(completionPercentage * 100)}%)。已完成 ${doc.completedItems.length} 个事项。`,
          };
        } else if (completionPercentage >= 0.5) {
          return {
            type: 'continue',
            instruction: `任务部分完成 (${Math.round(completionPercentage * 100)}%)，请继续完成剩余的验收标准。`,
          };
        } else {
          return {
            type: 'retry',
            reason: `任务未完成 (${Math.round(completionPercentage * 100)}%)，需要继续工作`,
            instruction: '请根据进度文档中的已完成事项，继续执行任务以满足所有验收标准。',
          };
        }

      case 'running':
      case 'paused':
      default:
        if (doc.workerHeartbeat && Date.now() - doc.workerHeartbeat > 120000) {
          return {
            type: 'abort',
            reason: 'Worker 心跳停止，任务可能已卡住',
          };
        }
        return {
          type: 'continue',
          instruction: 'Worker 仍在运行，请等待其完成当前步骤',
        };
    }
  }

  private evaluateAcceptanceCriteria(doc: ProgressDocument): number {
    const completedDescriptions = new Set(
      doc.completedItems.map((item) => item.description.toLowerCase())
    );

    let metCriteria = 0;
    for (const criterion of this.goal.acceptanceCriteria) {
      const criterionLower = criterion.toLowerCase();
      for (const completed of completedDescriptions) {
        if (completed.includes(criterionLower) || criterionLower.includes(completed)) {
          metCriteria++;
          break;
        }
      }
    }

    return metCriteria;
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================
  
  setOnDecision(handler: (decision: SupervisorDecision) => void): void {
    this.onDecision = handler;
  }
  
  setOnProgressUpdate(handler: (progress: TaskProgress) => void): void {
    this.onProgressUpdate = handler;
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private parseDecision(response: string): SupervisorDecision {
    // Try to extract JSON from response
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response;
    
    // Try to parse as JSON
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      // Try to find JSON object in the response
      const objectMatch = response.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        parsed = JSON.parse(objectMatch[0]);
      } else {
        throw new Error('No valid JSON found in response');
      }
    }
    
    // Convert to SupervisorDecision
    const decision = parsed.decision || parsed.type;
    
    switch (decision) {
      case 'continue':
        return {
          type: 'continue',
          instruction: parsed.instruction || parsed.content || '',
        };
        
      case 'retry':
        return {
          type: 'retry',
          reason: parsed.reason || '',
          instruction: parsed.instruction || '',
        };
        
      case 'complete':
        return {
          type: 'complete',
          summary: parsed.summary || '',
        };
        
      case 'abort':
        return {
          type: 'abort',
          reason: parsed.reason || '',
        };
        
      default:
        // If no explicit decision, try to infer from content
        if (parsed.instruction) {
          return {
            type: 'continue',
            instruction: parsed.instruction,
          };
        }
        throw new Error(`Unknown decision type: ${decision}`);
    }
  }
  
  private updateProgress(updates: Partial<TaskProgress>): void {
    this.progress = { ...this.progress, ...updates };
    this.onProgressUpdate?.(this.progress);
  }
}
