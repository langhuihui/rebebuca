/**
 * Rebebuca AI Agent System - Base Agent Class
 * Copyright (C) 2025 rebebuca contributors
 * 
 * Abstract base class for all agents.
 * Implements the core agent loop with state management.
 */

import type { ProviderConfig, Message, TokenUsage, TypedStreamEvent } from '../types';
import type { AgentState, AgentRole, AgentConfig } from './types';
import { createProvider } from '../provider';

// Helper to generate UUIDs using crypto
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export abstract class BaseAgent {
  readonly id: string;
  readonly role: AgentRole;
  protected provider: ProviderConfig;
  protected systemPrompt: string;
  protected maxSteps: number;
  protected duplicateThreshold: number;
  
  // State
  protected _state: AgentState = 'idle';
  protected messages: Message[] = [];
  protected currentStep: number = 0;
  protected usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  
  // Abort control
  protected abortController: AbortController | null = null;
  
  // Event callbacks
  protected onStateChange?: (state: AgentState) => void;
  protected onMessage?: (message: Message) => void;
  protected onStreamEvent?: (event: TypedStreamEvent) => void;
  
  constructor(config: AgentConfig) {
    this.id = generateUUID();
    this.role = config.role;
    this.provider = config.provider;
    this.systemPrompt = config.systemPrompt;
    this.maxSteps = config.maxSteps;
    this.duplicateThreshold = config.duplicateThreshold;
  }
  
  // ============================================================================
  // State Management
  // ============================================================================
  
  get state(): AgentState {
    return this._state;
  }
  
  protected setState(newState: AgentState): void {
    if (this._state !== newState) {
      this._state = newState;
      this.onStateChange?.(newState);
    }
  }
  
  // ============================================================================
  // Abstract Methods
  // ============================================================================
  
  /**
   * Think: 处理当前状态，决定下一步行动
   * @returns 是否需要执行 act
   */
  protected abstract think(): Promise<boolean>;
  
  /**
   * Act: 执行决定的行动
   * @returns 执行结果
   */
  protected abstract act(): Promise<string>;
  
  // ============================================================================
  // Core Loop
  // ============================================================================
  
  /**
   * 执行单步
   */
  async step(): Promise<string> {
    const shouldAct = await this.think();
    if (!shouldAct) {
      return 'Thinking complete - no action needed';
    }
    return await this.act();
  }
  
  /**
   * 运行 Agent
   * @param input 初始输入
   * @returns 执行结果
   */
  async run(input?: string): Promise<string> {
    const currentState = this._state;
    if (currentState !== 'idle' && currentState !== 'waiting') {
      throw new Error(`Cannot run agent from state: ${currentState}`);
    }
    
    this.abortController = new AbortController();
    this.setState('running');
    this.currentStep = 0;
    
    try {
      // Add initial input as user message
      if (input) {
        this.addMessage('user', input);
      }
      
      const results: string[] = [];
      
      while (
        this.currentStep < this.maxSteps &&
        this.state === 'running'
      ) {
        // Check abort
        if (this.abortController.signal.aborted) {
          this.setState('idle');
          break;
        }
        
        this.currentStep++;
        console.log(`[${this.role}] Executing step ${this.currentStep}/${this.maxSteps}`);
        
        const stepResult = await this.step();
        results.push(stepResult);
        
        // Check for stuck state
        if (this.isStuck()) {
          this.handleStuckState();
        }
      }
      
      if (this.currentStep >= this.maxSteps && this.state === 'running') {
        console.warn(`[${this.role}] Reached max steps (${this.maxSteps})`);
        this.setState('completed');
      }
      
      return results.join('\n');
    } catch (error) {
      console.error(`[${this.role}] Error during execution:`, error);
      this.setState('error');
      throw error;
    }
  }
  
  /**
   * 停止执行
   */
  stop(): void {
    this.abortController?.abort();
    this.setState('idle');
  }
  
  /**
   * 暂停（设置为等待状态）
   */
  pause(): void {
    if (this._state === 'running') {
      this.setState('waiting');
    }
  }
  
  /**
   * 恢复执行
   */
  resume(): void {
    if (this._state === 'waiting') {
      this.setState('running');
    }
  }
  
  // ============================================================================
  // Message Management
  // ============================================================================
  
  protected addMessage(role: 'user' | 'assistant' | 'system', content: string): Message {
    const message: Message = {
      id: generateUUID(),
      role,
      content,
      createdAt: Date.now(),
    };
    this.messages.push(message);
    this.onMessage?.(message);
    return message;
  }
  
  protected getLastAssistantMessage(): Message | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'assistant') {
        return this.messages[i];
      }
    }
    return undefined;
  }
  
  // ============================================================================
  // Stuck Detection
  // ============================================================================
  
  protected isStuck(): boolean {
    if (this.messages.length < 2) {
      return false;
    }
    
    const lastMessage = this.getLastAssistantMessage();
    if (!lastMessage || typeof lastMessage.content !== 'string') {
      return false;
    }
    
    // Count duplicate content
    let duplicateCount = 0;
    for (let i = this.messages.length - 2; i >= 0; i--) {
      const msg = this.messages[i];
      if (msg.role === 'assistant' && msg.content === lastMessage.content) {
        duplicateCount++;
      }
    }
    
    return duplicateCount >= this.duplicateThreshold;
  }
  
  protected handleStuckState(): void {
    console.warn(`[${this.role}] Detected stuck state, adding recovery prompt`);
    this.addMessage('user', 
      '检测到重复响应。请尝试新的策略，避免重复已经尝试过的无效路径。'
    );
  }
  
  // ============================================================================
  // LLM Interaction
  // ============================================================================
  
  protected async callLLM(options?: {
    tools?: boolean;
    stream?: boolean;
  }): Promise<string> {
    const llmProvider = createProvider(this.provider);
    
    // Build messages for LLM
    const llmMessages = [
      { role: 'system' as const, content: this.systemPrompt },
      ...this.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
    ];
    
    try {
      const response = await llmProvider.chat(llmMessages, {
        stream: options?.stream ?? false,
      });
      
      // Update usage
      if (response.usage) {
        this.usage.promptTokens += response.usage.promptTokens;
        this.usage.completionTokens += response.usage.completionTokens;
        this.usage.totalTokens += response.usage.totalTokens;
      }
      
      return response.content;
    } catch (error) {
      console.error(`[${this.role}] LLM call failed:`, error);
      throw error;
    }
  }
  
  // ============================================================================
  // Getters
  // ============================================================================
  
  getMessages(): Message[] {
    return [...this.messages];
  }
  
  getUsage(): TokenUsage {
    return { ...this.usage };
  }
  
  getCurrentStep(): number {
    return this.currentStep;
  }
  
  // ============================================================================
  // Event Handlers
  // ============================================================================
  
  setOnStateChange(handler: (state: AgentState) => void): void {
    this.onStateChange = handler;
  }
  
  setOnMessage(handler: (message: Message) => void): void {
    this.onMessage = handler;
  }
  
  setOnStreamEvent(handler: (event: TypedStreamEvent) => void): void {
    this.onStreamEvent = handler;
  }
}
