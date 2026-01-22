/**
 * Rebebuca AI Agent System - Core Types
 * Copyright (C) 2025 rebebuca contributors
 * 
 * Supervisor-Worker Agent Architecture:
 * - Supervisor: 监控任务进度，判断是否完成，指导 Worker 工作
 * - Worker: 执行具体任务，使用工具完成操作
 */

import type { ProviderConfig, TokenUsage } from '../types';

// ============================================================================
// Agent States
// ============================================================================

export type AgentState =
  | 'idle'      // 空闲，等待任务
  | 'running'   // 正在执行
  | 'waiting'   // 等待另一个 agent 响应
  | 'completed' // 任务完成
  | 'error';    // 发生错误

export type AgentRole = 'supervisor' | 'worker' | 'system';

// ============================================================================
// Task Definition
// ============================================================================

export interface TaskGoal {
  /** 任务目标描述 */
  objective: string;

  /** 任务名称（可选） */
  taskName?: string;

  /** 完成标准（验收条件） */
  acceptanceCriteria: string[];

  /** 上下文信息（可选） */
  context?: string;

  /** 约束条件（可选） */
  constraints?: string[];
}

export interface TaskProgress {
  /** 当前步骤编号 */
  currentStep: number;

  /** 总步骤数（预估） */
  totalSteps: number;

  /** 已完成的里程碑 */
  completedMilestones: string[];

  /** 当前正在执行的操作 */
  currentAction: string;

  /** 是否卡住 */
  isStuck: boolean;

  /** 卡住计数（连续相同响应） */
  stuckCount: number;
}

// ============================================================================
// Agent Messages (简化版，只显示关键对话)
// ============================================================================

export type AgentMessageType =
  | 'instruction'    // 监工给工人的指令
  | 'report'         // 工人向监工的汇报
  | 'decision'       // 监工的决策
  | 'completion'     // 任务完成通知
  | 'error'          // 错误信息
  | 'streaming';     // 流式输出（仅用于 UI 显示）

export interface AgentMessage {
  id: string;
  timestamp: number;
  from: AgentRole;
  to: AgentRole;
  type: AgentMessageType;
  content: string;

  /** 关联的工具调用（如果有） */
  toolSummary?: string;

  /** 元数据 */
  metadata?: {
    /** Worker 执行的文件操作 */
    filesChanged?: string[];
    /** Worker 执行的命令 */
    commandsRun?: string[];
    /** 是否是关键节点 */
    isKeyPoint?: boolean;
    /** 是否正在流式输出 */
    isStreaming?: boolean;
    /** 流式输出是否完成 */
    isComplete?: boolean;
    /** 是否是内部消息（不发送给 supervisor） */
    isInternal?: boolean;
  };
}

// ============================================================================
// Session Types
// ============================================================================

export type DualAgentSessionStatus =
  | 'idle'           // 未开始
  | 'initializing'   // 正在初始化
  | 'running'        // 正在运行
  | 'paused'         // 已暂停
  | 'completed'      // 已完成
  | 'error';         // 出错

export interface DualAgentSession {
  id: string;
  projectPath: string;

  /** Provider 配置 */
  supervisorProvider: ProviderConfig;
  workerProvider: ProviderConfig;

  /** 任务目标 */
  goal: TaskGoal;

  /** 任务进度 */
  progress: TaskProgress;

  /** Agent 对话记录（只保留关键对话） */
  conversation: AgentMessage[];

  /** Agent 状态 */
  supervisorState: AgentState;
  workerState: AgentState;

  /** 会话状态 */
  status: DualAgentSessionStatus;

  /** Token 使用统计 */
  usage: {
    supervisor: TokenUsage;
    worker: TokenUsage;
    total: TokenUsage;
  };

  /** 循环控制 */
  loop: {
    /** 当前轮次 */
    currentRound: number;
    /** 最大轮次 */
    maxRounds: number;
    /** 每轮最大步骤 */
    maxStepsPerRound: number;
    /** 当前轮步骤 */
    currentStepInRound: number;
  };

  /** 时间戳 */
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  role: AgentRole;
  provider: ProviderConfig;

  /** 系统提示词 */
  systemPrompt: string;

  /** 可用工具（仅 Worker 需要） */
  tools?: string[];

  /** 最大步骤数 */
  maxSteps: number;

  /** 重复检测阈值 */
  duplicateThreshold: number;
}

// ============================================================================
// Skill Types
// ============================================================================

export interface SkillDefinition {
  /** Skill 名称 */
  name: string;
  /** Skill 描述 */
  description: string;
  /** Skill 内容（Markdown） */
  content: string;
  /** 来源文件路径 */
  filePath: string;
}

export interface DualAgentConfig {
  projectPath: string;
  goal: TaskGoal;

  /** Provider 配置（可以使用相同或不同的配置） */
  supervisorProvider: ProviderConfig;
  workerProvider: ProviderConfig;

  /** Worker 可用工具 */
  workerTools?: string[];

  /** Skills 目录路径 */
  skillsPath?: string;

  /** 循环配置 */
  maxRounds?: number;

  /** 自动批准所有权限请求（无需人工确认） */
  autoApprovePermissions?: boolean;
}

// ============================================================================
// Events
// ============================================================================

export interface DualAgentEvents {
  /** 会话状态变化 */
  'session:status': { sessionId: string; status: DualAgentSessionStatus; };

  /** Agent 状态变化 */
  'agent:state': { sessionId: string; role: AgentRole; state: AgentState; };

  /** 新的对话消息 */
  'conversation:message': { sessionId: string; message: AgentMessage; };

  /** 进度更新 */
  'progress:update': { sessionId: string; progress: TaskProgress; };

  /** Worker 工具执行 */
  'worker:tool': { sessionId: string; toolName: string; status: 'start' | 'complete' | 'error'; };

  /** 错误 */
  'error': { sessionId: string; error: Error; };

  /** 完成 */
  'complete': { sessionId: string; summary: string; };
}

// ============================================================================
// Supervisor Decision Types
// ============================================================================

export type SupervisorDecision =
  | { type: 'continue'; instruction: string; }           // 继续工作，给出下一步指令
  | { type: 'retry'; reason: string; instruction: string; }  // 重试，解释原因
  | { type: 'complete'; summary: string; }               // 任务完成
  | { type: 'abort'; reason: string; };                  // 放弃任务

// ============================================================================
// Worker Response Types  
// ============================================================================

export interface WorkerReport {
  /** 执行摘要 */
  summary: string;

  /** 是否成功 */
  success: boolean;

  /** 执行的操作列表 */
  actions: string[];

  /** 遇到的问题（如果有） */
  issues?: string[];

  /** 需要监工决策的事项（如果有） */
  needsDecision?: string;

  /** 是否已完成任务 */
  done?: boolean;

  /** 结束原因 */
  exitReason?: string;
}
