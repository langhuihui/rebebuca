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

import type {
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  SSEEvent,
  SSEEventType,
  CollabMessage,
  DecisionRequest,
  AgentRole,
} from '../types/aiCollab';
import { useAICollabStore } from '../stores/aiCollab';
import { getAdapter } from '../adapters';

/**
 * MCP 服务器类
 * 基于 HTTP/SSE 提供 MCP 协议支持
 */
class MCPServer {
  private port: number = 3847;
  private isRunning: boolean = false;
  private clients: Map<string, {
    role: AgentRole;
    sessionId: string;
    lastHeartbeat: number;
  }> = new Map();
  private eventListeners: Map<string, ((event: SSEEvent) => void)[]> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  
  // MCP 工具定义
  private tools: MCPTool[] = [
    {
      name: 'get_task',
      description: '获取当前任务说明',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: '会话 ID',
          },
        },
        required: ['sessionId'],
      },
    },
    {
      name: 'get_progress',
      description: '获取任务进度',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: '会话 ID',
          },
        },
        required: ['sessionId'],
      },
    },
    {
      name: 'get_chat_history',
      description: '获取聊天记录',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: '会话 ID',
          },
          limit: {
            type: 'number',
            description: '返回的消息数量限制',
          },
        },
        required: ['sessionId'],
      },
    },
    {
      name: 'send_message',
      description: '发送消息',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: '会话 ID',
          },
          to: {
            type: 'string',
            description: '消息接收者 (supervisor/worker/user/all)',
          },
          content: {
            type: 'string',
            description: '消息内容',
          },
          type: {
            type: 'string',
            description: '消息类型 (chat/progress/task)',
          },
        },
        required: ['sessionId', 'to', 'content'],
      },
    },
    {
      name: 'request_decision',
      description: '请求决策 (Worker 使用)',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: '会话 ID',
          },
          question: {
            type: 'string',
            description: '决策问题',
          },
          options: {
            type: 'array',
            description: '可选项列表',
          },
          context: {
            type: 'string',
            description: '上下文信息',
          },
          timeout: {
            type: 'number',
            description: '超时秒数',
          },
        },
        required: ['sessionId', 'question'],
      },
    },
    {
      name: 'make_decision',
      description: '做出决策 (Supervisor 使用)',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: '会话 ID',
          },
          decisionId: {
            type: 'string',
            description: '决策请求 ID',
          },
          answer: {
            type: 'string',
            description: '决策答案',
          },
        },
        required: ['sessionId', 'decisionId', 'answer'],
      },
    },
    {
      name: 'report_progress',
      description: '报告任务进度 (Worker 使用)',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: '会话 ID',
          },
          currentStep: {
            type: 'number',
            description: '当前步骤',
          },
          totalSteps: {
            type: 'number',
            description: '总步骤数',
          },
          description: {
            type: 'string',
            description: '进度描述',
          },
          status: {
            type: 'string',
            description: '状态 (pending/in_progress/completed/failed)',
          },
        },
        required: ['sessionId'],
      },
    },
    {
      name: 'update_progress',
      description: '更新任务进度 (Supervisor 使用)',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: '会话 ID',
          },
          taskDescription: {
            type: 'string',
            description: '任务描述',
          },
          stepDescriptions: {
            type: 'array',
            description: '步骤描述列表',
          },
          completedSteps: {
            type: 'array',
            description: '已完成步骤列表',
          },
        },
        required: ['sessionId'],
      },
    },
    {
      name: 'get_workers_status',
      description: '获取所有 Worker 的状态',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: '会话 ID',
          },
        },
        required: ['sessionId'],
      },
    },
    {
      name: 'restart_worker',
      description: '重启指定的 Worker (Supervisor 使用)',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: '会话 ID',
          },
          workerIndex: {
            type: 'number',
            description: 'Worker 索引 (从 0 开始)',
          },
          reason: {
            type: 'string',
            description: '重启原因',
          },
        },
        required: ['sessionId', 'workerIndex'],
      },
    },
    {
      name: 'set_worker_busy',
      description: '设置 Worker 忙碌状态 (Worker 使用)',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: '会话 ID',
          },
          workerIndex: {
            type: 'number',
            description: 'Worker 索引',
          },
          busy: {
            type: 'boolean',
            description: '是否忙碌',
          },
          currentTask: {
            type: 'string',
            description: '当前任务描述',
          },
        },
        required: ['sessionId', 'workerIndex', 'busy'],
      },
    },
  ];
  
  /**
   * 启动 MCP 服务器
   */
  async start(port?: number): Promise<void> {
    if (this.isRunning) {
      console.log('[MCP Server] Already running');
      return;
    }
    
    if (port) {
      this.port = port;
    }
    
    this.isRunning = true;
    
    // 启动心跳检测
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, 30000);
    
    console.log(`[MCP Server] Started on port ${this.port}`);
  }
  
  /**
   * 获取服务器 URL
   */
  getUrl(): string {
    return `http://localhost:${this.port}`;
  }
  
  /**
   * 停止 MCP 服务器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.clients.clear();
    this.eventListeners.clear();
    
    console.log('[MCP Server] Stopped');
  }
  
  /**
   * 注册客户端
   */
  registerClient(clientId: string, role: AgentRole, sessionId: string): void {
    this.clients.set(clientId, {
      role,
      sessionId,
      lastHeartbeat: Date.now(),
    });
    
    console.log(`[MCP Server] Client registered: ${clientId} (${role})`);
    
    // 发送连接成功事件
    this.emitEvent(sessionId, {
      type: 'connected',
      data: { clientId, role },
      timestamp: Date.now(),
    });
  }
  
  /**
   * 注销客户端
   */
  unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      console.log(`[MCP Server] Client unregistered: ${clientId}`);
    }
  }
  
  /**
   * 更新心跳
   */
  updateHeartbeat(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastHeartbeat = Date.now();
    }
  }
  
  /**
   * 检查心跳
   */
  private checkHeartbeats(): void {
    const now = Date.now();
    const timeout = 60000; // 60 秒超时
    
    for (const [clientId, client] of this.clients) {
      if (now - client.lastHeartbeat > timeout) {
        console.log(`[MCP Server] Client timeout: ${clientId}`);
        this.unregisterClient(clientId);
        
        // 发送断开连接事件
        this.emitEvent(client.sessionId, {
          type: 'agent_status',
          data: { clientId, role: client.role, status: 'disconnected' },
          timestamp: now,
        });
      }
    }
  }
  
  /**
   * 获取工具列表
   */
  getTools(): MCPTool[] {
    return this.tools;
  }
  
  /**
   * 调用工具
   */
  async callTool(call: MCPToolCall, callerRole: AgentRole): Promise<MCPToolResult> {
    try {
      const result = await this.executeTool(call.name, call.arguments, callerRole);
      return {
        id: call.id,
        success: true,
        result,
      };
    } catch (error) {
      return {
        id: call.id,
        success: false,
        error: String(error),
      };
    }
  }
  
  /**
   * 执行工具
   */
  private async executeTool(
    name: string,
    args: Record<string, any>,
    callerRole: AgentRole
  ): Promise<any> {
    const collabStore = useAICollabStore();
    const adapter = await getAdapter();
    
    switch (name) {
      case 'get_task': {
        const { sessionId } = args;
        const session = collabStore.sessions.get(sessionId);
        if (!session) {
          throw new Error('Session not found');
        }
        
        // 读取任务说明文件
        const taskPath = session.config.taskDirectory;
        try {
          const exists = await adapter.fs.exists(taskPath);
          if (!exists) {
            return { task: null, message: 'Task file not found' };
          }
          
          const content = await adapter.fs.readTextFile(taskPath);
          return { task: content };
        } catch (error) {
          return { task: null, error: String(error) };
        }
      }
      
      case 'get_progress': {
        const { sessionId } = args;
        const progress = await collabStore.getProgress(sessionId);
        return { progress };
      }
      
      case 'get_chat_history': {
        const { sessionId, limit = 50 } = args;
        const session = collabStore.sessions.get(sessionId);
        if (!session) {
          throw new Error('Session not found');
        }
        
        const messages = session.messages.slice(-limit);
        return { messages };
      }
      
      case 'send_message': {
        const { sessionId, to, content, type = 'chat' } = args;
        
        const message = await collabStore.addMessage(sessionId, {
          from: callerRole,
          to,
          type,
          content,
        });
        
        // 发送 SSE 事件
        this.emitEvent(sessionId, {
          type: 'message',
          data: message,
          timestamp: Date.now(),
        });
        
        return { success: true, messageId: message.id };
      }
      
      case 'request_decision': {
        if (callerRole !== 'worker') {
          throw new Error('Only worker can request decision');
        }
        
        const { sessionId, question, options, context, timeout = 30 } = args;
        const session = collabStore.sessions.get(sessionId);
        if (!session) {
          throw new Error('Session not found');
        }
        
        const request = await collabStore.createDecisionRequest(sessionId, {
          workerId: 'worker',
          question,
          options,
          context,
          timeout,
        });
        
        // 发送 SSE 事件
        this.emitEvent(sessionId, {
          type: 'decision_request',
          data: request,
          timestamp: Date.now(),
        });
        
        return { success: true, decisionId: request.id };
      }
      
      case 'make_decision': {
        if (callerRole !== 'supervisor') {
          throw new Error('Only supervisor can make decision');
        }
        
        const { sessionId, decisionId, answer } = args;
        await collabStore.supervisorDecide(sessionId, decisionId, answer);
        
        // 发送 SSE 事件
        this.emitEvent(sessionId, {
          type: 'decision_response',
          data: { decisionId, answer, answeredBy: 'supervisor' },
          timestamp: Date.now(),
        });
        
        return { success: true };
      }
      
      case 'report_progress': {
        if (callerRole !== 'worker') {
          throw new Error('Only worker can report progress');
        }
        
        const { sessionId, currentStep, totalSteps, description, status } = args;
        await collabStore.updateProgress(sessionId, {
          currentStep,
          totalSteps,
          status,
        });
        
        // 添加进度消息
        if (description) {
          await collabStore.addMessage(sessionId, {
            from: 'worker',
            to: 'all',
            type: 'progress',
            content: description,
            metadata: { currentStep, totalSteps, status },
          });
        }
        
        return { success: true };
      }
      
      case 'update_progress': {
        if (callerRole !== 'supervisor') {
          throw new Error('Only supervisor can update progress');
        }
        
        const { sessionId, taskDescription, stepDescriptions, completedSteps } = args;
        await collabStore.updateProgress(sessionId, {
          taskDescription,
          stepDescriptions,
          completedSteps,
        });
        
        return { success: true };
      }
      
      case 'get_workers_status': {
        const { sessionId } = args;
        const workersStatus = collabStore.getWorkersStatus(sessionId);
        return { workers: workersStatus };
      }
      
      case 'restart_worker': {
        if (callerRole !== 'supervisor') {
          throw new Error('Only supervisor can restart worker');
        }
        
        const { sessionId, workerIndex, reason } = args;
        
        // 添加系统消息
        await collabStore.addMessage(sessionId, {
          from: 'supervisor',
          to: 'all',
          type: 'system',
          content: `监工请求重启 Worker #${workerIndex + 1}${reason ? `: ${reason}` : ''}`,
        });
        
        // 执行重启
        await collabStore.restartAgent(sessionId, 'worker', workerIndex);
        
        // 发送 SSE 事件
        this.emitEvent(sessionId, {
          type: 'agent_status',
          data: { role: 'worker', workerIndex, status: 'restarting' },
          timestamp: Date.now(),
        });
        
        return { success: true, message: `Worker #${workerIndex + 1} is restarting` };
      }
      
      case 'set_worker_busy': {
        const { sessionId, workerIndex, busy, currentTask } = args;
        collabStore.setWorkerBusy(sessionId, workerIndex, busy, currentTask);
        
        // 发送 SSE 事件
        this.emitEvent(sessionId, {
          type: 'agent_status',
          data: { role: 'worker', workerIndex, busy, currentTask },
          timestamp: Date.now(),
        });
        
        return { success: true };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
  
  /**
   * 添加事件监听器
   */
  addEventListener(sessionId: string, listener: (event: SSEEvent) => void): () => void {
    if (!this.eventListeners.has(sessionId)) {
      this.eventListeners.set(sessionId, []);
    }
    
    this.eventListeners.get(sessionId)!.push(listener);
    
    // 返回取消监听函数
    return () => {
      const listeners = this.eventListeners.get(sessionId);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }
  
  /**
   * 发送事件
   */
  emitEvent(sessionId: string, event: SSEEvent): void {
    const listeners = this.eventListeners.get(sessionId);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('[MCP Server] Event listener error:', error);
        }
      }
    }
  }
  
  /**
   * 发送消息给指定角色
   */
  async sendToRole(sessionId: string, role: AgentRole, content: string): Promise<void> {
    const collabStore = useAICollabStore();
    await collabStore.sendToAgent(sessionId, role, content);
  }
  
  /**
   * 获取服务器状态
   */
  getStatus(): {
    isRunning: boolean;
    port: number;
    clientCount: number;
    clients: Array<{ id: string; role: AgentRole; sessionId: string }>;
  } {
    return {
      isRunning: this.isRunning,
      port: this.port,
      clientCount: this.clients.size,
      clients: Array.from(this.clients.entries()).map(([id, client]) => ({
        id,
        role: client.role,
        sessionId: client.sessionId,
      })),
    };
  }
}

// 单例实例
let mcpServerInstance: MCPServer | null = null;

/**
 * 获取 MCP 服务器实例
 */
export function getMCPServer(): MCPServer {
  if (!mcpServerInstance) {
    mcpServerInstance = new MCPServer();
  }
  return mcpServerInstance;
}

/**
 * 启动 MCP 服务
 */
export async function startMCPServer(port?: number): Promise<string> {
  const server = getMCPServer();
  await server.start(port);
  return server.getUrl();
}

/**
 * 获取 MCP 服务器 URL
 */
export function getMCPServerUrl(): string {
  const server = getMCPServer();
  return server.getUrl();
}

/**
 * 停止 MCP 服务
 */
export async function stopMCPServer(): Promise<void> {
  const server = getMCPServer();
  await server.stop();
}
