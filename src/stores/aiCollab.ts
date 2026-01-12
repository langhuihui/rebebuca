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

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getAdapter, type BackendAdapter } from '../adapters';
import type {
  CollabSession,
  CollabMessage,
  DecisionRequest,
  ProjectCollabConfig,
  AgentInstance,
  AgentConfig,
  AgentStatus,
  TaskProgress,
} from '../types/aiCollab';

// 生成唯一 ID
const generateId = () => `collab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useAICollabStore = defineStore('aiCollab', () => {
  // 所有协作会话
  const sessions = ref<Map<string, CollabSession>>(new Map());
  
  // 当前活动会话 ID
  const activeSessionId = ref<string | null>(null);
  
  // 决策倒计时定时器
  const decisionTimers = ref<Map<string, ReturnType<typeof setInterval>>>(new Map());
  
  // 决策剩余时间 (秒)
  const decisionRemainingTime = ref<Map<string, number>>(new Map());
  
  // Adapter 实例
  let adapter: BackendAdapter | null = null;
  
  // 获取 adapter 实例
  const getAdapterInstance = async (): Promise<BackendAdapter> => {
    if (!adapter) {
      adapter = await getAdapter();
    }
    return adapter;
  };
  
  // 计算属性
  const activeSession = computed(() => {
    return activeSessionId.value ? sessions.value.get(activeSessionId.value) : null;
  });
  
  const activeSessions = computed(() => {
    return Array.from(sessions.value.values()).filter(
      s => s.status === 'running' || s.status === 'idle'
    );
  });
  
  const allSessions = computed(() => Array.from(sessions.value.values()));
  
  // 创建新会话
  const createSession = async (config: ProjectCollabConfig): Promise<CollabSession> => {
    const id = generateId();
    const now = Date.now();
    
    // 初始化 workers 数组 - 根据配置创建初始 worker 实例（idle 状态）
    const initialWorkers: AgentInstance[] = [];
    
    // 如果配置中有 workers 数组，使用它
    if (config.workers && config.workers.length > 0) {
      for (let i = 0; i < config.workers.length; i++) {
        const workerConfig = config.workers[i];
        initialWorkers.push({
          id: workerConfig.id || `worker-${i}`,
          config: workerConfig,
          status: 'idle',
          workerIndex: i,
          busy: false,
        });
      }
    } else if (config.worker) {
      // 兼容单个 worker 配置
      initialWorkers.push({
        id: config.worker.id || 'worker-0',
        config: config.worker,
        status: 'idle',
        workerIndex: 0,
        busy: false,
      });
    }
    
    const session: CollabSession = {
      id,
      projectPath: config.projectPath,
      config,
      status: 'idle',
      messages: [],
      workers: initialWorkers,
      startTime: now,
      lastActivity: now,
      iterationCount: 0,
    };
    
    sessions.value.set(id, session);
    activeSessionId.value = id;
    
    // 添加系统消息
    await addMessage(id, {
      from: 'system',
      to: 'all',
      type: 'system',
      content: '协作会话已创建，等待启动 Agent...',
    });
    
    // 保存会话到本地存储
    await saveSessionToStorage(session);
    
    return session;
  };
  
  // 更新会话配置
  const updateSession = async (sessionId: string, config: Partial<ProjectCollabConfig>): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    // 更新配置
    session.config = {
      ...session.config,
      ...config,
    };
    session.projectPath = config.projectPath || session.projectPath;
    session.lastActivity = Date.now();
    
    // 保存到本地存储
    await saveSessionToStorage(session);
    
    await addMessage(sessionId, {
      from: 'system',
      to: 'all',
      type: 'system',
      content: '会话配置已更新',
    });
  };
  
  // 启动会话
  const startSession = async (sessionId: string): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    session.status = 'running';
    session.lastActivity = Date.now();
    
    // 启动 MCP 服务器
    const { startMCPServer } = await import('../services/mcpServer');
    const mcpUrl = await startMCPServer();
    
    await addMessage(sessionId, {
      from: 'system',
      to: 'all',
      type: 'system',
      content: `MCP 服务器已启动: ${mcpUrl}`,
    });
    
    await addMessage(sessionId, {
      from: 'system',
      to: 'all',
      type: 'system',
      content: '正在启动 Agent...',
    });
    
    // 启动 Supervisor
    try {
      session.supervisor = await startAgent(session.config.supervisor, sessionId, undefined, mcpUrl);
      await addMessage(sessionId, {
        from: 'system',
        to: 'all',
        type: 'system',
        content: `监工 AI 已启动 (PID: ${session.supervisor.pid || 'N/A'})`,
      });
    } catch (error) {
      session.status = 'failed';
      session.error = `启动监工失败: ${error}`;
      await addMessage(sessionId, {
        from: 'system',
        to: 'all',
        type: 'error',
        content: session.error,
      });
      throw error;
    }
    
    // 获取所有 worker 配置
    const workerConfigs = session.config.workers?.length 
      ? session.config.workers 
      : [session.config.worker];
    
    // 启动所有 Workers
    session.workers = [];
    for (let i = 0; i < workerConfigs.length; i++) {
      const workerConfig = workerConfigs[i];
      try {
        const workerInstance = await startAgent(workerConfig, sessionId, i, mcpUrl);
        workerInstance.workerIndex = i;
        session.workers.push(workerInstance);
        
        // 兼容：第一个 worker 也赋值给 session.worker
        if (i === 0) {
          session.worker = workerInstance;
        }
        
        await addMessage(sessionId, {
          from: 'system',
          to: 'all',
          type: 'system',
          content: `Worker AI #${i + 1} 已启动 (PID: ${workerInstance.pid || 'N/A'})`,
        });
      } catch (error) {
        // 如果 Worker 启动失败，停止已启动的 Agent
        if (session.supervisor) {
          await stopAgent(session.supervisor);
        }
        for (const worker of session.workers) {
          await stopAgent(worker);
        }
        session.status = 'failed';
        session.error = `启动 Worker #${i + 1} 失败: ${error}`;
        await addMessage(sessionId, {
          from: 'system',
          to: 'all',
          type: 'error',
          content: session.error,
        });
        throw error;
      }
    }
    
    await saveSessionToStorage(session);
  };
  
  // 启动单个 Agent
  const startAgent = async (config: AgentConfig, sessionId: string, workerIndex?: number, mcpUrl?: string): Promise<AgentInstance> => {
    const adapterInstance = await getAdapterInstance();
    const session = sessions.value.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    // 构建启动命令
    let command: string;
    let args: string[] = [];
    
    if (config.type === 'ai-tool' && config.aiTool) {
      // 使用 AI 工具启动
      const { getAIToolLaunchConfig } = await import('../utils/aiToolLauncher');
      const { useAIToolsStore } = await import('./aiTools');
      const aiToolsStore = useAIToolsStore();
      const toolConfig = aiToolsStore.toolConfigs[config.aiTool];
      
      const launchConfig = getAIToolLaunchConfig(config.aiTool, toolConfig, config.cwd || session.projectPath);
      command = launchConfig.command;
      args = launchConfig.args || [];
    } else if (config.type === 'custom-cli' && config.command) {
      // 使用自定义 CLI 命令
      command = config.command;
      args = config.args || [];
    } else {
      throw new Error('Invalid agent configuration');
    }
    
    // 使用传入的 mcpUrl 或从服务获取
    const effectiveMcpUrl = mcpUrl || config.mcpServerUrl || 'http://localhost:3847';
    
    // 添加 MCP 相关参数（提示 Agent 使用 MCP 通信）
    const mcpPrompt = getMCPPrompt(config.role, sessionId, effectiveMcpUrl, workerIndex);
    
    // 创建 PTY (ptyId 用于日志，暂时注释)
    // const ptyId = `collab-${config.role}${workerIndex !== undefined ? `-${workerIndex}` : ''}-${generateId()}`;
    const result = await adapterInstance.terminal.create({
      command,
      args,
      cwd: config.cwd || session.projectPath,
      env: {
        ...config.env,
        REBEBUCA_COLLAB_SESSION: sessionId,
        REBEBUCA_AGENT_ROLE: config.role,
        REBEBUCA_WORKER_INDEX: workerIndex !== undefined ? String(workerIndex) : '',
        REBEBUCA_MCP_URL: effectiveMcpUrl,
      },
    });
    
    const instance: AgentInstance = {
      id: config.id,
      config,
      status: 'running',
      pid: undefined, // PTY 可能不返回 PID
      ptyId: result.ptyId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      workerIndex,
      busy: false,
    };
    
    // 发送初始提示词
    setTimeout(async () => {
      await adapterInstance.terminal.write(result.ptyId, mcpPrompt + '\n');
    }, 1000);
    
    return instance;
  };
  
  // 获取 MCP 提示词
  const getMCPPrompt = (role: 'supervisor' | 'worker', sessionId: string, mcpUrl?: string, workerIndex?: number): string => {
    const url = mcpUrl || 'http://localhost:3847';
    
    if (role === 'supervisor') {
      return `你是一个监工 AI，负责监督和协调 Worker AI 的工作。

你需要通过 MCP (Model Context Protocol) 与本项目进行通信。

MCP 服务器地址: ${url}
会话 ID: ${sessionId}

可用的 MCP 工具:
1. get_task - 获取当前任务说明
2. get_progress - 获取任务进度
3. get_chat_history - 获取聊天记录
4. send_message - 发送消息给 Worker 或用户
5. make_decision - 对 Worker 的决策请求做出回应
6. update_progress - 更新任务进度
7. get_workers_status - 获取所有 Worker 的状态

请开始监控 Worker 的工作，并在需要时提供指导。`;
    } else {
      const workerLabel = workerIndex !== undefined ? ` #${workerIndex + 1}` : '';
      return `你是一个 Worker AI${workerLabel}，负责执行具体的编程任务。

你需要通过 MCP (Model Context Protocol) 与本项目进行通信。

MCP 服务器地址: ${url}
会话 ID: ${sessionId}
Worker 索引: ${workerIndex ?? 0}

可用的 MCP 工具:
1. get_task - 获取当前任务说明
2. get_progress - 获取任务进度
3. get_chat_history - 获取聊天记录
4. send_message - 发送消息给监工或用户
5. request_decision - 向监工请求决策
6. report_progress - 报告任务进度
7. set_busy_status - 设置忙碌状态

请获取任务说明并开始工作。遇到需要决策的情况时，使用 request_decision 工具。`;
    }
  };
  
  // 停止 Agent
  const stopAgent = async (agent: AgentInstance): Promise<void> => {
    if (!agent.ptyId) return;
    
    const adapterInstance = await getAdapterInstance();
    try {
      await adapterInstance.terminal.kill(agent.ptyId);
    } catch (error) {
      console.warn('[AICollab] Failed to kill agent:', error);
    }
    agent.status = 'stopped';
  };
  
  // 停止会话
  const stopSession = async (sessionId: string): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session) return;
    
    // 停止所有 Agent
    if (session.supervisor) {
      await stopAgent(session.supervisor);
    }
    // 停止所有 workers
    for (const worker of session.workers) {
      await stopAgent(worker);
    }
    // 兼容：也停止 session.worker
    if (session.worker && !session.workers.find(w => w.id === session.worker?.id)) {
      await stopAgent(session.worker);
    }
    
    // 清除决策定时器
    clearDecisionTimer(sessionId);
    
    session.status = 'completed';
    session.lastActivity = Date.now();
    
    await addMessage(sessionId, {
      from: 'system',
      to: 'all',
      type: 'system',
      content: '协作会话已停止',
    });
    
    await saveSessionToStorage(session);
  };
  
  // 重启 Agent
  const restartAgent = async (sessionId: string, role: 'supervisor' | 'worker', workerIndex?: number): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    let config: AgentConfig;
    let existingAgent: AgentInstance | undefined;
    
    if (role === 'supervisor') {
      config = session.config.supervisor;
      existingAgent = session.supervisor;
    } else {
      // 获取对应 worker 的配置
      const idx = workerIndex ?? 0;
      const workerConfigs = session.config.workers?.length 
        ? session.config.workers 
        : [session.config.worker];
      config = workerConfigs[idx] || session.config.worker;
      existingAgent = session.workers[idx] || session.worker;
    }
    
    // 停止现有 Agent
    if (existingAgent) {
      await stopAgent(existingAgent);
    }
    
    const workerLabel = role === 'worker' && workerIndex !== undefined ? ` #${workerIndex + 1}` : '';
    await addMessage(sessionId, {
      from: 'system',
      to: 'all',
      type: 'system',
      content: `正在重启 ${role === 'supervisor' ? '监工' : 'Worker'}${workerLabel} AI...`,
    });
    
    // 启动新 Agent
    const newAgent = await startAgent(config, sessionId, role === 'worker' ? workerIndex : undefined);
    
    if (role === 'supervisor') {
      session.supervisor = newAgent;
    } else {
      const idx = workerIndex ?? 0;
      if (session.workers[idx]) {
        session.workers[idx] = newAgent;
      } else {
        session.workers.push(newAgent);
      }
      // 兼容：更新 session.worker
      if (idx === 0) {
        session.worker = newAgent;
      }
    }
    
    // 发送恢复提示
    const adapterInstance = await getAdapterInstance();
    const resumePrompt = `请读取任务说明、进度和聊天记录，恢复之前的工作状态并继续执行。`;
    
    setTimeout(async () => {
      if (newAgent.ptyId) {
        await adapterInstance.terminal.write(newAgent.ptyId, resumePrompt + '\n');
      }
    }, 2000);
    
    await addMessage(sessionId, {
      from: 'system',
      to: 'all',
      type: 'system',
      content: `${role === 'supervisor' ? '监工' : 'Worker'}${workerLabel} AI 已重启`,
    });
    
    await saveSessionToStorage(session);
  };
  
  // 添加消息
  const addMessage = async (
    sessionId: string,
    message: Omit<CollabMessage, 'id' | 'sessionId' | 'timestamp'>
  ): Promise<CollabMessage> => {
    const session = sessions.value.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    const fullMessage: CollabMessage = {
      id: generateId(),
      sessionId,
      timestamp: Date.now(),
      ...message,
    };
    
    session.messages.push(fullMessage);
    session.lastActivity = fullMessage.timestamp;
    
    // 保存到本地存储
    await saveChatHistory(session);
    
    return fullMessage;
  };
  
  // 发送消息到 Agent
  const sendToAgent = async (
    sessionId: string,
    role: 'supervisor' | 'worker',
    content: string,
    workerIndex?: number
  ): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    let agent: AgentInstance | undefined;
    if (role === 'supervisor') {
      agent = session.supervisor;
    } else {
      const idx = workerIndex ?? 0;
      agent = session.workers[idx] || session.worker;
    }
    
    if (!agent || !agent.ptyId) {
      throw new Error(`Agent not running: ${role}${workerIndex !== undefined ? ` #${workerIndex}` : ''}`);
    }
    
    const adapterInstance = await getAdapterInstance();
    await adapterInstance.terminal.write(agent.ptyId, content + '\n');
    
    agent.lastActivity = Date.now();
  };
  
  // 创建决策请求
  const createDecisionRequest = async (
    sessionId: string,
    request: Omit<DecisionRequest, 'id' | 'sessionId' | 'createdAt' | 'status'>
  ): Promise<DecisionRequest> => {
    const session = sessions.value.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    const fullRequest: DecisionRequest = {
      id: generateId(),
      sessionId,
      createdAt: Date.now(),
      status: 'pending',
      ...request,
    };
    
    session.pendingDecision = fullRequest;
    decisionRemainingTime.value.set(fullRequest.id, request.timeout);
    
    // 添加消息
    await addMessage(sessionId, {
      from: 'worker',
      to: 'supervisor',
      type: 'decision_request',
      content: request.question,
      metadata: {
        decisionId: fullRequest.id,
        options: request.options,
        timeout: request.timeout,
      },
    });
    
    // 启动倒计时
    startDecisionTimer(sessionId, fullRequest);
    
    return fullRequest;
  };
  
  // 启动决策倒计时
  const startDecisionTimer = (sessionId: string, request: DecisionRequest): void => {
    // 清除现有定时器
    clearDecisionTimer(sessionId);
    
    const session = sessions.value.get(sessionId);
    if (!session) return;
    
    const timerId = setInterval(() => {
      const remaining = decisionRemainingTime.value.get(request.id) || 0;
      
      if (remaining <= 0) {
        // 倒计时结束，自动决策
        clearDecisionTimer(sessionId);
        if (session.config.autoDecision) {
          autoDecide(sessionId, request.id);
        } else {
          // 超时，标记为超时状态
          timeoutDecision(sessionId, request.id);
        }
      } else {
        decisionRemainingTime.value.set(request.id, remaining - 1);
      }
    }, 1000);
    
    decisionTimers.value.set(sessionId, timerId);
  };
  
  // 清除决策定时器
  const clearDecisionTimer = (sessionId: string): void => {
    const timerId = decisionTimers.value.get(sessionId);
    if (timerId) {
      clearInterval(timerId);
      decisionTimers.value.delete(sessionId);
    }
  };
  
  // 取消决策倒计时（用户介入）
  const cancelDecisionTimer = (sessionId: string): void => {
    clearDecisionTimer(sessionId);
  };
  
  // 用户回复决策
  const userDecide = async (sessionId: string, decisionId: string, answer: string): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session || !session.pendingDecision || session.pendingDecision.id !== decisionId) {
      throw new Error('Invalid decision request');
    }
    
    clearDecisionTimer(sessionId);
    
    session.pendingDecision.status = 'answered';
    session.pendingDecision.answer = answer;
    session.pendingDecision.answeredBy = 'user';
    session.pendingDecision.answeredAt = Date.now();
    
    // 添加消息
    await addMessage(sessionId, {
      from: 'user',
      to: 'worker',
      type: 'decision_response',
      content: answer,
      metadata: {
        decisionId,
        answeredBy: 'user',
      },
    });
    
    // 发送给 Worker
    await sendToAgent(sessionId, 'worker', `用户决策: ${answer}`);
    
    session.pendingDecision = undefined;
    await saveSessionToStorage(session);
  };
  
  // 监工自动决策
  const autoDecide = async (sessionId: string, decisionId: string): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session || !session.pendingDecision || session.pendingDecision.id !== decisionId) {
      return;
    }
    
    // 通知监工进行决策
    await addMessage(sessionId, {
      from: 'system',
      to: 'supervisor',
      type: 'system',
      content: '倒计时结束，请做出决策',
      metadata: {
        decisionId,
        question: session.pendingDecision.question,
        options: session.pendingDecision.options,
      },
    });
    
    // 发送给监工
    const prompt = `Worker 请求决策已超时，请你做出决策:
问题: ${session.pendingDecision.question}
${session.pendingDecision.options ? `选项: ${session.pendingDecision.options.join(', ')}` : ''}
请使用 make_decision 工具回复。`;
    
    await sendToAgent(sessionId, 'supervisor', prompt);
  };
  
  // 决策超时
  const timeoutDecision = async (sessionId: string, decisionId: string): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session || !session.pendingDecision || session.pendingDecision.id !== decisionId) {
      return;
    }
    
    session.pendingDecision.status = 'timeout';
    
    await addMessage(sessionId, {
      from: 'system',
      to: 'all',
      type: 'system',
      content: '决策请求已超时，等待用户介入',
    });
  };
  
  // 监工做出决策
  const supervisorDecide = async (sessionId: string, decisionId: string, answer: string): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session || !session.pendingDecision || session.pendingDecision.id !== decisionId) {
      throw new Error('Invalid decision request');
    }
    
    clearDecisionTimer(sessionId);
    
    session.pendingDecision.status = 'answered';
    session.pendingDecision.answer = answer;
    session.pendingDecision.answeredBy = 'supervisor';
    session.pendingDecision.answeredAt = Date.now();
    
    // 添加消息
    await addMessage(sessionId, {
      from: 'supervisor',
      to: 'worker',
      type: 'decision_response',
      content: answer,
      metadata: {
        decisionId,
        answeredBy: 'supervisor',
      },
    });
    
    // 发送给 Worker
    await sendToAgent(sessionId, 'worker', `监工决策: ${answer}`);
    
    session.pendingDecision = undefined;
    await saveSessionToStorage(session);
  };
  
  // 获取决策剩余时间
  const getDecisionRemainingTime = (decisionId: string): number => {
    return decisionRemainingTime.value.get(decisionId) || 0;
  };
  
  // 检查 Agent 存活状态
  const checkAgentAlive = async (sessionId: string): Promise<{
    supervisor: boolean;
    workers: boolean[];
  }> => {
    const session = sessions.value.get(sessionId);
    if (!session) {
      return { supervisor: false, workers: [] };
    }
    
    const adapterInstance = await getAdapterInstance();
    
    const supervisorAlive = session.supervisor?.ptyId
      ? await adapterInstance.terminal.isRunning(session.supervisor.ptyId)
      : false;
    
    // 检查所有 workers
    const workersAlive: boolean[] = [];
    for (const worker of session.workers) {
      const alive = worker.ptyId
        ? await adapterInstance.terminal.isRunning(worker.ptyId)
        : false;
      workersAlive.push(alive);
      
      // 更新状态
      if (!alive && worker.status === 'running') {
        worker.status = 'stopped';
      }
    }
    
    // 更新 supervisor 状态
    if (session.supervisor && !supervisorAlive && session.supervisor.status === 'running') {
      session.supervisor.status = 'stopped';
    }
    
    return { supervisor: supervisorAlive, workers: workersAlive };
  };
  
  // 更新 Agent 状态
  const updateAgentStatus = (
    sessionId: string,
    role: 'supervisor' | 'worker',
    status: AgentStatus,
    workerIndex?: number,
    error?: string
  ): void => {
    const session = sessions.value.get(sessionId);
    if (!session) return;
    
    if (role === 'supervisor' && session.supervisor) {
      session.supervisor.status = status;
      if (error) session.supervisor.error = error;
    } else if (role === 'worker') {
      const idx = workerIndex ?? 0;
      const worker = session.workers[idx];
      if (worker) {
        worker.status = status;
        if (error) worker.error = error;
      }
    }
  };
  
  // 设置 Worker 忙碌状态
  const setWorkerBusy = (
    sessionId: string,
    workerIndex: number,
    busy: boolean,
    currentTask?: string
  ): void => {
    const session = sessions.value.get(sessionId);
    if (!session) return;
    
    const worker = session.workers[workerIndex];
    if (worker) {
      worker.busy = busy;
      worker.currentTask = currentTask;
      worker.lastActivity = Date.now();
    }
  };
  
  // 获取所有 Workers 状态
  const getWorkersStatus = (sessionId: string): Array<{
    index: number;
    id: string;
    status: AgentStatus;
    busy: boolean;
    currentTask?: string;
    error?: string;
  }> => {
    const session = sessions.value.get(sessionId);
    if (!session) return [];
    
    return session.workers.map((worker, index) => ({
      index,
      id: worker.id,
      status: worker.status,
      busy: worker.busy || false,
      currentTask: worker.currentTask,
      error: worker.error,
    }));
  };
  
  // 添加 Worker
  const addWorker = async (sessionId: string, config: AgentConfig): Promise<AgentInstance> => {
    const session = sessions.value.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    const workerIndex = session.workers.length;
    
    // 添加到配置
    if (!session.config.workers) {
      session.config.workers = [session.config.worker];
    }
    session.config.workers.push(config);
    
    // 如果会话正在运行，立即启动 worker
    if (session.status === 'running') {
      const workerInstance = await startAgent(config, sessionId, workerIndex);
      workerInstance.workerIndex = workerIndex;
      session.workers.push(workerInstance);
      
      await addMessage(sessionId, {
        from: 'system',
        to: 'all',
        type: 'system',
        content: `Worker AI #${workerIndex + 1} 已添加并启动`,
      });
      
      await saveSessionToStorage(session);
      return workerInstance;
    } else {
      // 会话未运行，只添加配置
      const placeholder: AgentInstance = {
        id: config.id,
        config,
        status: 'idle',
        workerIndex,
        busy: false,
      };
      session.workers.push(placeholder);
      await saveSessionToStorage(session);
      return placeholder;
    }
  };
  
  // 移除 Worker
  const removeWorker = async (sessionId: string, workerIndex: number): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    if (workerIndex < 0 || workerIndex >= session.workers.length) {
      throw new Error(`Invalid worker index: ${workerIndex}`);
    }
    
    // 不能移除最后一个 worker
    if (session.workers.length <= 1) {
      throw new Error('Cannot remove the last worker');
    }
    
    const worker = session.workers[workerIndex];
    
    // 停止 worker
    if (worker.status === 'running') {
      await stopAgent(worker);
    }
    
    // 从数组中移除
    session.workers.splice(workerIndex, 1);
    
    // 更新配置
    if (session.config.workers) {
      session.config.workers.splice(workerIndex, 1);
    }
    
    // 更新剩余 workers 的索引
    session.workers.forEach((w, idx) => {
      w.workerIndex = idx;
    });
    
    await addMessage(sessionId, {
      from: 'system',
      to: 'all',
      type: 'system',
      content: `Worker AI #${workerIndex + 1} 已移除`,
    });
    
    await saveSessionToStorage(session);
  };
  
  // 保存会话到本地存储
  const saveSessionToStorage = async (session: CollabSession): Promise<void> => {
    const adapterInstance = await getAdapterInstance();
    const storagePath = `${session.projectPath}/.rebebuca/ai-collab`;
    
    try {
      // 确保目录存在
      await adapterInstance.fs.mkdir(storagePath, { recursive: true });
      
      // 保存会话配置
      const sessionData = {
        id: session.id,
        projectPath: session.projectPath,
        config: session.config,
        status: session.status,
        startTime: session.startTime,
        lastActivity: session.lastActivity,
        iterationCount: session.iterationCount,
        error: session.error,
      };
      
      await adapterInstance.fs.writeTextFile(
        `${storagePath}/session.json`,
        JSON.stringify(sessionData, null, 2)
      );
    } catch (error) {
      console.error('[AICollab] Failed to save session:', error);
    }
  };
  
  // 保存聊天记录
  const saveChatHistory = async (session: CollabSession): Promise<void> => {
    const adapterInstance = await getAdapterInstance();
    const storagePath = `${session.projectPath}/.rebebuca/ai-collab`;
    
    try {
      await adapterInstance.fs.mkdir(storagePath, { recursive: true });
      await adapterInstance.fs.writeTextFile(
        `${storagePath}/chat-history.json`,
        JSON.stringify(session.messages, null, 2)
      );
    } catch (error) {
      console.error('[AICollab] Failed to save chat history:', error);
    }
  };
  
  // 加载会话
  const loadSession = async (projectPath: string): Promise<CollabSession | null> => {
    const adapterInstance = await getAdapterInstance();
    const storagePath = `${projectPath}/.rebebuca/ai-collab`;
    
    try {
      const exists = await adapterInstance.fs.exists(`${storagePath}/session.json`);
      if (!exists) return null;
      
      const sessionJson = await adapterInstance.fs.readTextFile(`${storagePath}/session.json`);
      const sessionData = JSON.parse(sessionJson);
      
      // 加载聊天记录
      let messages: CollabMessage[] = [];
      const chatExists = await adapterInstance.fs.exists(`${storagePath}/chat-history.json`);
      if (chatExists) {
        const chatJson = await adapterInstance.fs.readTextFile(`${storagePath}/chat-history.json`);
        messages = JSON.parse(chatJson);
      }
      
      const session: CollabSession = {
        ...sessionData,
        messages,
        supervisor: undefined,
        worker: undefined,
        workers: [],
        pendingDecision: undefined,
      };
      
      sessions.value.set(session.id, session);
      return session;
    } catch (error) {
      console.error('[AICollab] Failed to load session:', error);
      return null;
    }
  };
  
  // 删除会话
  const deleteSession = async (sessionId: string): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session) return;
    
    // 停止会话
    if (session.status === 'running') {
      await stopSession(sessionId);
    }
    
    // 删除本地存储
    const adapterInstance = await getAdapterInstance();
    const storagePath = `${session.projectPath}/.rebebuca/ai-collab`;
    
    try {
      await adapterInstance.fs.remove(storagePath, { recursive: true });
    } catch (error) {
      console.warn('[AICollab] Failed to delete session storage:', error);
    }
    
    sessions.value.delete(sessionId);
    
    if (activeSessionId.value === sessionId) {
      activeSessionId.value = null;
    }
  };
  
  // 设置活动会话
  const setActiveSession = (sessionId: string | null): void => {
    activeSessionId.value = sessionId;
  };
  
  // 更新任务进度
  const updateProgress = async (
    sessionId: string,
    progress: Partial<TaskProgress>
  ): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session) return;
    
    const adapterInstance = await getAdapterInstance();
    const storagePath = `${session.projectPath}/.rebebuca/ai-collab`;
    const progressPath = `${storagePath}/progress.json`;
    
    try {
      let currentProgress: TaskProgress;
      
      const exists = await adapterInstance.fs.exists(progressPath);
      if (exists) {
        const json = await adapterInstance.fs.readTextFile(progressPath);
        currentProgress = { ...JSON.parse(json), ...progress, lastUpdate: Date.now() };
      } else {
        currentProgress = {
          sessionId,
          taskDescription: '',
          currentStep: 0,
          totalSteps: 0,
          stepDescriptions: [],
          completedSteps: [],
          status: 'pending',
          startTime: Date.now(),
          lastUpdate: Date.now(),
          ...progress,
        };
      }
      
      await adapterInstance.fs.writeTextFile(progressPath, JSON.stringify(currentProgress, null, 2));
    } catch (error) {
      console.error('[AICollab] Failed to update progress:', error);
    }
  };
  
  // 获取任务进度
  const getProgress = async (sessionId: string): Promise<TaskProgress | null> => {
    const session = sessions.value.get(sessionId);
    if (!session) return null;
    
    const adapterInstance = await getAdapterInstance();
    const progressPath = `${session.projectPath}/.rebebuca/ai-collab/progress.json`;
    
    try {
      const exists = await adapterInstance.fs.exists(progressPath);
      if (!exists) return null;
      
      const json = await adapterInstance.fs.readTextFile(progressPath);
      return JSON.parse(json);
    } catch (error) {
      console.error('[AICollab] Failed to get progress:', error);
      return null;
    }
  };
  
  return {
    // State
    sessions,
    activeSessionId,
    decisionRemainingTime,
    
    // Computed
    activeSession,
    activeSessions,
    allSessions,
    
    // Methods
    createSession,
    updateSession,
    startSession,
    stopSession,
    restartAgent,
    startAgent,
    deleteSession,
    setActiveSession,
    addMessage,
    sendToAgent,
    createDecisionRequest,
    cancelDecisionTimer,
    userDecide,
    supervisorDecide,
    getDecisionRemainingTime,
    checkAgentAlive,
    loadSession,
    updateProgress,
    getProgress,
    // 多 Worker 相关
    updateAgentStatus,
    setWorkerBusy,
    getWorkersStatus,
    addWorker,
    removeWorker,
  };
});
