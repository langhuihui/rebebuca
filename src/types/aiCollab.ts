/**
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { AIToolType } from '../stores/aiTools';

/**
 * Agent 角色类型
 */
export type AgentRole = 'supervisor' | 'worker';

/**
 * Agent 状态
 */
export type AgentStatus = 
  | 'idle'           // 空闲
  | 'starting'       // 启动中
  | 'running'        // 运行中
  | 'waiting'        // 等待决策
  | 'stopped'        // 已停止
  | 'error';         // 错误

/**
 * 协作会话状态
 */
export type CollabSessionStatus = 
  | 'idle'           // 空闲
  | 'running'        // 运行中
  | 'paused'         // 暂停
  | 'completed'      // 已完成
  | 'failed';        // 失败

/**
 * 消息类型
 */
export type CollabMessageType = 
  | 'task'              // 任务分配
  | 'progress'          // 进度报告
  | 'decision_request'  // 决策请求
  | 'decision_response' // 决策响应
  | 'chat'              // 普通聊天
  | 'system'            // 系统消息
  | 'error';            // 错误消息

/**
 * 消息来源
 */
export type MessageFrom = 'supervisor' | 'worker' | 'user' | 'system' | `worker-${number}`;

/**
 * 消息目标
 */
export type MessageTo = 'supervisor' | 'worker' | 'user' | 'all' | `worker-${number}`;

/**
 * 协作消息
 */
export interface CollabMessage {
  id: string;
  sessionId: string;
  from: MessageFrom;
  to: MessageTo;
  type: CollabMessageType;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * 决策请求
 */
export interface DecisionRequest {
  id: string;
  sessionId: string;
  workerId: string;
  question: string;
  options?: string[];
  context?: string;
  timeout: number;           // 倒计时秒数
  createdAt: number;
  status: 'pending' | 'answered' | 'timeout' | 'cancelled';
  answer?: string;
  answeredBy?: 'supervisor' | 'user';
  answeredAt?: number;
}

/**
 * Agent 启动配置
 */
export interface AgentConfig {
  id: string;
  role: AgentRole;
  type: 'ai-tool' | 'custom-cli';
  aiTool?: AIToolType;       // AI 工具类型
  command?: string;          // 自定义 CLI 命令
  args?: string[];           // 命令参数
  env?: Record<string, string>; // 环境变量
  cwd?: string;              // 工作目录
  mcpServerUrl?: string;     // MCP 服务器地址
}

/**
 * Agent 实例
 */
export interface AgentInstance {
  id: string;
  config: AgentConfig;
  status: AgentStatus;
  pid?: number;
  ptyId?: string;
  startTime?: number;
  lastActivity?: number;
  error?: string;
  /** Worker 索引 (仅用于 worker) */
  workerIndex?: number;
  /** 是否正在处理任务 */
  busy?: boolean;
  /** 当前正在处理的任务描述 */
  currentTask?: string;
}

/**
 * 项目协作配置
 */
export interface ProjectCollabConfig {
  projectPath: string;
  taskDirectory: string;       // 任务说明目录
  progressFile: string;        // 进度文件路径
  chatHistoryFile: string;     // 聊天记录文件路径
  supervisor: AgentConfig;
  worker: AgentConfig;         // 保留单个 worker 配置以兼容
  workers?: AgentConfig[];     // 多个 worker 配置
  decisionTimeout: number;     // 决策超时秒数（默认30秒）
  autoDecision: boolean;       // 是否允许监工自动决策
  maxIterations?: number;      // 最大迭代次数
}

/**
 * 协作会话
 */
export interface CollabSession {
  id: string;
  projectPath: string;
  config: ProjectCollabConfig;
  status: CollabSessionStatus;
  supervisor?: AgentInstance;
  worker?: AgentInstance;       // 保留单个 worker 以兼容
  workers: AgentInstance[];     // 多个 worker 实例
  messages: CollabMessage[];
  pendingDecision?: DecisionRequest;
  startTime: number;
  lastActivity: number;
  iterationCount: number;
  error?: string;
}

/**
 * 任务进度
 */
export interface TaskProgress {
  sessionId: string;
  taskDescription: string;
  currentStep: number;
  totalSteps: number;
  stepDescriptions: string[];
  completedSteps: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: number;
  lastUpdate: number;
  error?: string;
}

/**
 * MCP 工具定义
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
    required?: string[];
  };
}

/**
 * MCP 工具调用请求
 */
export interface MCPToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

/**
 * MCP 工具调用结果
 */
export interface MCPToolResult {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * SSE 事件类型
 */
export type SSEEventType = 
  | 'connected'
  | 'message'
  | 'decision_request'
  | 'decision_response'
  | 'agent_status'
  | 'session_status'
  | 'error'
  | 'heartbeat';

/**
 * SSE 事件
 */
export interface SSEEvent {
  type: SSEEventType;
  data: any;
  timestamp: number;
}

/**
 * 协作 Tab 数据
 */
export interface CollabTabData {
  sessionId: string;
  projectPath: string;
  config: ProjectCollabConfig;
}
