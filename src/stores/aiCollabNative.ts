/**
 * Rebebuca - AI Collaboration Store (Native Mode)
 * Copyright (C) 2025 rebebuca contributors
 * 
 * This store uses the native AI service layer for direct LLM communication,
 * bypassing CLI tools for better performance and control.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getAdapter, type BackendAdapter } from '../adapters';
import {
  aiSessionManager,
  aiEventBus,
  permissionManager,
  type ProviderConfig,
  type PermissionRequest,
  type TypedStreamEvent,
  type Message,
} from '../services/ai';
import type {
  CollabMessage,
  DecisionRequest,
  TaskProgress,
} from '../types/aiCollab';

// 生成唯一 ID
const generateId = () => `collab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Native AI 协作会话
export interface NativeCollabSession {
  id: string;
  projectPath: string;
  provider: ProviderConfig;
  tools: string[];
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  messages: CollabMessage[];
  aiSessionId?: string;  // 底层 AI session ID
  pendingDecision?: DecisionRequest;
  startTime: number;
  lastActivity: number;
  error?: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// 会话配置
export interface NativeCollabConfig {
  projectPath: string;
  provider: ProviderConfig;
  tools?: string[];
  systemPrompts?: string[];
}

export const useAICollabNativeStore = defineStore('aiCollabNative', () => {
  // 所有协作会话
  const sessions = ref<Map<string, NativeCollabSession>>(new Map());
  
  // 当前活动会话 ID
  const activeSessionId = ref<string | null>(null);
  
  const decisionRemainingTime = ref<Map<string, number>>(new Map());
  
  // 当前流式响应
  const streamingText = ref<Map<string, string>>(new Map());
  const streamingToolCalls = ref<Map<string, Array<{ id: string; name: string; status: string }>>>(new Map());
  
  // 权限请求队列
  const pendingPermissions = ref<PermissionRequest[]>([]);
  
  // Adapter 实例
  let adapter: BackendAdapter | null = null;
  
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
  
  const currentStreamingText = computed(() => {
    return activeSessionId.value ? streamingText.value.get(activeSessionId.value) || '' : '';
  });
  
  const currentToolCalls = computed(() => {
    return activeSessionId.value ? streamingToolCalls.value.get(activeSessionId.value) || [] : [];
  });
  
  // 设置事件监听
  const setupEventListeners = () => {
    // 监听流式事件
    aiEventBus.on('stream:event', ({ sessionId, event }) => {
      handleStreamEvent(sessionId, event);
    });
    
    // 监听权限请求
    aiEventBus.on('permission:request', ({ request }) => {
      pendingPermissions.value.push(request);
    });
    
    // 监听会话消息
    aiEventBus.on('session:message', ({ sessionId, message }) => {
      handleSessionMessage(sessionId, message);
    });
    
    // 监听会话状态
    aiEventBus.on('session:status', ({ sessionId, status }) => {
      const session = findSessionByAIId(sessionId);
      if (session) {
        session.status = status === 'running' ? 'running' : 
                         status === 'completed' ? 'completed' :
                         status === 'error' ? 'error' : 'idle';
        session.lastActivity = Date.now();
      }
    });
    
    // 监听工具执行
    aiEventBus.on('tool:start', ({ sessionId, toolCallId, toolName }) => {
      const session = findSessionByAIId(sessionId);
      if (session) {
        const calls = streamingToolCalls.value.get(session.id) || [];
        calls.push({ id: toolCallId, name: toolName, status: 'running' });
        streamingToolCalls.value.set(session.id, calls);
      }
    });
    
    aiEventBus.on('tool:complete', ({ sessionId, toolCallId }) => {
      const session = findSessionByAIId(sessionId);
      if (session) {
        const calls = streamingToolCalls.value.get(session.id) || [];
        const call = calls.find(c => c.id === toolCallId);
        if (call) call.status = 'completed';
      }
    });
    
    aiEventBus.on('tool:error', ({ sessionId, toolCallId }) => {
      const session = findSessionByAIId(sessionId);
      if (session) {
        const calls = streamingToolCalls.value.get(session.id) || [];
        const call = calls.find(c => c.id === toolCallId);
        if (call) call.status = 'error';
      }
    });
  };
  
  // 查找会话（通过 AI session ID）
  const findSessionByAIId = (aiSessionId: string): NativeCollabSession | undefined => {
    for (const session of sessions.value.values()) {
      if (session.aiSessionId === aiSessionId) {
        return session;
      }
    }
    return undefined;
  };
  
  // 处理流式事件
  const handleStreamEvent = (aiSessionId: string, event: TypedStreamEvent) => {
    const session = findSessionByAIId(aiSessionId);
    if (!session) return;
    
    switch (event.type) {
      case 'text-delta':
        const current = streamingText.value.get(session.id) || '';
        streamingText.value.set(session.id, current + event.text);
        break;
        
      case 'usage':
        session.usage = {
          promptTokens: session.usage.promptTokens + event.usage.promptTokens,
          completionTokens: session.usage.completionTokens + event.usage.completionTokens,
          totalTokens: session.usage.totalTokens + event.usage.totalTokens,
        };
        break;
        
      case 'finish':
        // 完成后清除流式文本
        const finalText = streamingText.value.get(session.id) || '';
        if (finalText) {
          addMessageToSession(session.id, {
            from: 'assistant',
            to: 'user',
            type: 'chat',
            content: finalText,
          });
        }
        streamingText.value.delete(session.id);
        streamingToolCalls.value.delete(session.id);
        break;
        
      case 'error':
        session.error = event.error.message;
        break;
    }
  };
  
  // 处理会话消息
  const handleSessionMessage = (aiSessionId: string, message: Message) => {
    const session = findSessionByAIId(aiSessionId);
    if (!session) return;
    
    // 转换消息格式
    const content = typeof message.content === 'string' 
      ? message.content 
      : JSON.stringify(message.content);
      
    addMessageToSession(session.id, {
      from: message.role === 'user' ? 'user' : 
            message.role === 'assistant' ? 'assistant' : 'system',
      to: 'all',
      type: 'chat',
      content,
    });
  };
  
  // 添加消息到会话
  const addMessageToSession = (
    sessionId: string,
    message: Omit<CollabMessage, 'id' | 'sessionId' | 'timestamp'>
  ): CollabMessage | undefined => {
    const session = sessions.value.get(sessionId);
    if (!session) return undefined;
    
    const fullMessage: CollabMessage = {
      id: generateId(),
      sessionId,
      timestamp: Date.now(),
      ...message,
    };
    
    session.messages.push(fullMessage);
    session.lastActivity = fullMessage.timestamp;
    
    return fullMessage;
  };
  
  // 创建会话
  const createSession = async (config: NativeCollabConfig): Promise<NativeCollabSession> => {
    const id = generateId();
    const now = Date.now();
    
    // 创建底层 AI session
    const aiSession = await aiSessionManager.createSession({
      projectPath: config.projectPath,
      provider: config.provider,
      tools: config.tools,
      systemPrompts: config.systemPrompts,
    });
    
    const session: NativeCollabSession = {
      id,
      projectPath: config.projectPath,
      provider: config.provider,
      tools: config.tools || ['read', 'write', 'edit', 'bash', 'glob', 'grep'],
      status: 'idle',
      messages: [],
      aiSessionId: aiSession.id,
      startTime: now,
      lastActivity: now,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
    
    sessions.value.set(id, session);
    activeSessionId.value = id;
    
    addMessageToSession(id, {
      from: 'system',
      to: 'all',
      type: 'system',
      content: 'AI 协作会话已创建，使用原生模式直接与大模型通讯。',
    });
    
    await saveSessionToStorage(session);
    
    return session;
  };
  
  // 发送消息
  const sendMessage = async (sessionId: string, content: string): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session || !session.aiSessionId) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    // 添加用户消息
    addMessageToSession(sessionId, {
      from: 'user',
      to: 'assistant',
      type: 'chat',
      content,
    });
    
    session.status = 'running';
    session.lastActivity = Date.now();
    
    // 发送到 AI session
    try {
      await aiSessionManager.sendMessage(session.aiSessionId, content);
    } catch (error) {
      session.status = 'error';
      session.error = error instanceof Error ? error.message : String(error);
      
      addMessageToSession(sessionId, {
        from: 'system',
        to: 'all',
        type: 'error',
        content: `错误: ${session.error}`,
      });
    }
  };
  
  // 停止会话
  const stopSession = async (sessionId: string): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session) return;
    
    if (session.aiSessionId) {
      aiSessionManager.stop(session.aiSessionId);
    }
    
    session.status = 'paused';
    session.lastActivity = Date.now();
    
    addMessageToSession(sessionId, {
      from: 'system',
      to: 'all',
      type: 'system',
      content: '会话已暂停',
    });
    
    await saveSessionToStorage(session);
  };
  
  // 恢复会话
  const resumeSession = async (sessionId: string): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session || !session.aiSessionId) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    await aiSessionManager.resume(session.aiSessionId);
  };
  
  // 删除会话
  const deleteSession = async (sessionId: string): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session) return;
    
    // 停止 AI session
    if (session.aiSessionId) {
      aiSessionManager.deleteSession(session.aiSessionId);
    }
    
    // 删除本地存储
    const adapterInstance = await getAdapterInstance();
    const storagePath = `${session.projectPath}/.rebebuca/ai-collab-native`;
    
    try {
      await adapterInstance.fs.remove(storagePath, { recursive: true });
    } catch (error) {
      console.warn('[AICollabNative] Failed to delete session storage:', error);
    }
    
    sessions.value.delete(sessionId);
    
    if (activeSessionId.value === sessionId) {
      activeSessionId.value = null;
    }
  };
  
  // 回复权限请求
  const replyPermission = (requestId: string, reply: 'allow' | 'deny' | 'always'): void => {
    const session = activeSession.value;
    permissionManager.reply(requestId, reply, session?.aiSessionId);
    
    // 从队列中移除
    const index = pendingPermissions.value.findIndex(p => p.id === requestId);
    if (index !== -1) {
      pendingPermissions.value.splice(index, 1);
    }
  };
  
  // 更新 Provider 配置
  const updateProvider = async (sessionId: string, provider: ProviderConfig): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    session.provider = provider;
    
    if (session.aiSessionId) {
      aiSessionManager.updateProvider(session.aiSessionId, provider);
    }
    
    await saveSessionToStorage(session);
  };
  
  // 更新工具列表
  const updateTools = async (sessionId: string, tools: string[]): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    session.tools = tools;
    
    if (session.aiSessionId) {
      aiSessionManager.updateTools(session.aiSessionId, tools);
    }
    
    await saveSessionToStorage(session);
  };
  
  // 保存会话到本地存储
  const saveSessionToStorage = async (session: NativeCollabSession): Promise<void> => {
    const adapterInstance = await getAdapterInstance();
    const storagePath = `${session.projectPath}/.rebebuca/ai-collab-native`;
    
    try {
      await adapterInstance.fs.mkdir(storagePath, { recursive: true });
      
      const sessionData = {
        id: session.id,
        projectPath: session.projectPath,
        provider: {
          ...session.provider,
          apiKey: '***', // 不保存 API key
        },
        tools: session.tools,
        status: session.status,
        startTime: session.startTime,
        lastActivity: session.lastActivity,
        usage: session.usage,
      };
      
      await adapterInstance.fs.writeTextFile(
        `${storagePath}/session.json`,
        JSON.stringify(sessionData, null, 2)
      );
      
      // 保存消息
      await adapterInstance.fs.writeTextFile(
        `${storagePath}/messages.json`,
        JSON.stringify(session.messages, null, 2)
      );
    } catch (error) {
      console.error('[AICollabNative] Failed to save session:', error);
    }
  };
  
  // 加载会话
  const loadSession = async (projectPath: string): Promise<NativeCollabSession | null> => {
    const adapterInstance = await getAdapterInstance();
    const storagePath = `${projectPath}/.rebebuca/ai-collab-native`;
    
    try {
      const exists = await adapterInstance.fs.exists(`${storagePath}/session.json`);
      if (!exists) return null;
      
      const sessionJson = await adapterInstance.fs.readTextFile(`${storagePath}/session.json`);
      const sessionData = JSON.parse(sessionJson);
      
      // 加载消息
      let messages: CollabMessage[] = [];
      const messagesExists = await adapterInstance.fs.exists(`${storagePath}/messages.json`);
      if (messagesExists) {
        const messagesJson = await adapterInstance.fs.readTextFile(`${storagePath}/messages.json`);
        messages = JSON.parse(messagesJson);
      }
      
      // 注意：需要重新提供 API key
      const session: NativeCollabSession = {
        ...sessionData,
        messages,
        aiSessionId: undefined, // 需要重新创建
      };
      
      sessions.value.set(session.id, session);
      return session;
    } catch (error) {
      console.error('[AICollabNative] Failed to load session:', error);
      return null;
    }
  };
  
  // 设置活动会话
  const setActiveSession = (sessionId: string | null): void => {
    activeSessionId.value = sessionId;
  };
  
  // 更新任务进度
  const updateProgress = async (sessionId: string, progress: Partial<TaskProgress>): Promise<void> => {
    const session = sessions.value.get(sessionId);
    if (!session) return;
    
    const adapterInstance = await getAdapterInstance();
    const storagePath = `${session.projectPath}/.rebebuca/ai-collab-native`;
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
      console.error('[AICollabNative] Failed to update progress:', error);
    }
  };
  
  // 获取任务进度
  const getProgress = async (sessionId: string): Promise<TaskProgress | null> => {
    const session = sessions.value.get(sessionId);
    if (!session) return null;
    
    const adapterInstance = await getAdapterInstance();
    const progressPath = `${session.projectPath}/.rebebuca/ai-collab-native/progress.json`;
    
    try {
      const exists = await adapterInstance.fs.exists(progressPath);
      if (!exists) return null;
      
      const json = await adapterInstance.fs.readTextFile(progressPath);
      return JSON.parse(json);
    } catch (error) {
      console.error('[AICollabNative] Failed to get progress:', error);
      return null;
    }
  };
  
  // 初始化
  setupEventListeners();
  
  return {
    // State
    sessions,
    activeSessionId,
    pendingPermissions,
    streamingText,
    streamingToolCalls,
    decisionRemainingTime,
    
    // Computed
    activeSession,
    activeSessions,
    allSessions,
    currentStreamingText,
    currentToolCalls,
    
    // Methods
    createSession,
    sendMessage,
    stopSession,
    resumeSession,
    deleteSession,
    setActiveSession,
    replyPermission,
    updateProvider,
    updateTools,
    loadSession,
    updateProgress,
    getProgress,
  };
});
