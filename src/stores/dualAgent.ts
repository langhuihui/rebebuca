/**
 * Rebebuca - Dual Agent Store
 * Copyright (C) 2025 rebebuca contributors
 * 
 * Store for managing Supervisor-Worker dual agent sessions.
 */

import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import { DualAgentOrchestrator } from '../services/ai/agents';
import type {
  DualAgentSession,
  DualAgentConfig,
} from '../services/ai/agents/types';
import type { PermissionRequest, PermissionReply } from '../services/ai/types';

export const useDualAgentStore = defineStore('dualAgent', () => {
  // Active orchestrators
  const orchestrators = shallowRef<Map<string, DualAgentOrchestrator>>(new Map());
  
  // Sessions (reactive for UI)
  const sessions = ref<Map<string, DualAgentSession>>(new Map());
  
  // Active session ID
  const activeSessionId = ref<string | null>(null);
  
  // Pending permission requests
  const pendingPermissions = ref<PermissionRequest[]>([]);
  
  // ============================================================================
  // Computed
  // ============================================================================
  
  const activeSession = computed(() => {
    if (!activeSessionId.value) return null;
    return sessions.value.get(activeSessionId.value) || null;
  });
  
  const activeOrchestrator = computed(() => {
    if (!activeSessionId.value) return null;
    return orchestrators.value.get(activeSessionId.value) || null;
  });
  
  // ============================================================================
  // Session Management
  // ============================================================================
  
  /**
   * 创建新的双 Agent 会话
   */
  async function createSession(config: DualAgentConfig): Promise<DualAgentSession> {
    const orchestrator = new DualAgentOrchestrator(config);
    const sessionId = orchestrator.getSessionId();
    const session = orchestrator.getSession();
    
    // Store orchestrator and session
    const newOrchestrators = new Map(orchestrators.value);
    newOrchestrators.set(sessionId, orchestrator);
    orchestrators.value = newOrchestrators;
    
    sessions.value.set(sessionId, session);
    
    // Setup event listeners
    setupEventListeners(sessionId, orchestrator);
    
    // Set as active
    activeSessionId.value = sessionId;
    
    console.log('[DualAgentStore] Created session:', sessionId);
    
    return session;
  }
  
  /**
   * 开始执行任务
   */
  async function startSession(sessionId: string): Promise<void> {
    const orchestrator = orchestrators.value.get(sessionId);
    if (!orchestrator) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    await orchestrator.start();
  }
  
  /**
   * 暂停会话
   */
  function pauseSession(sessionId: string): void {
    const orchestrator = orchestrators.value.get(sessionId);
    if (orchestrator) {
      orchestrator.pause();
    }
  }
  
  /**
   * 恢复会话
   */
  async function resumeSession(sessionId: string): Promise<void> {
    const orchestrator = orchestrators.value.get(sessionId);
    if (orchestrator) {
      await orchestrator.resume();
    }
  }
  
  /**
   * 停止会话
   */
  function stopSession(sessionId: string): void {
    const orchestrator = orchestrators.value.get(sessionId);
    if (orchestrator) {
      orchestrator.stop();
    }
  }
  
  /**
   * 删除会话
   */
  function deleteSession(sessionId: string): void {
    const orchestrator = orchestrators.value.get(sessionId);
    if (orchestrator) {
      orchestrator.stop();
    }
    
    const newOrchestrators = new Map(orchestrators.value);
    newOrchestrators.delete(sessionId);
    orchestrators.value = newOrchestrators;
    
    sessions.value.delete(sessionId);
    
    if (activeSessionId.value === sessionId) {
      activeSessionId.value = null;
    }
  }
  
  /**
   * 回复权限请求
   */
  function replyPermission(requestId: string, reply: PermissionReply): void {
    if (!activeSessionId.value) return;
    
    const orchestrator = orchestrators.value.get(activeSessionId.value);
    if (orchestrator) {
      orchestrator.replyPermission(requestId, reply);
      
      // Remove from pending
      pendingPermissions.value = pendingPermissions.value.filter(p => p.id !== requestId);
    }
  }
  
  // ============================================================================
  // Event Handling
  // ============================================================================
  
  function setupEventListeners(sessionId: string, orchestrator: DualAgentOrchestrator): void {
    // Session status changes
    orchestrator.on('session:status', ({ status }) => {
      const session = sessions.value.get(sessionId);
      if (session) {
        session.status = status;
        session.updatedAt = Date.now();
      }
    });
    
    // Agent state changes
    orchestrator.on('agent:state', ({ role, state }) => {
      const session = sessions.value.get(sessionId);
      if (session) {
        if (role === 'supervisor') {
          session.supervisorState = state;
        } else {
          session.workerState = state;
        }
        session.updatedAt = Date.now();
      }
    });
    
    // New conversation messages
    orchestrator.on('conversation:message', ({ message }) => {
      const session = sessions.value.get(sessionId);
      if (session) {
        session.conversation.push(message);
        session.updatedAt = Date.now();
      }
    });
    
    // Progress updates
    orchestrator.on('progress:update', ({ progress }) => {
      const session = sessions.value.get(sessionId);
      if (session) {
        session.progress = progress;
        session.updatedAt = Date.now();
      }
    });
    
    // Completion
    orchestrator.on('complete', ({ summary }) => {
      console.log('[DualAgentStore] Session completed:', sessionId, summary);
    });
    
    // Errors
    orchestrator.on('error', ({ error }) => {
      console.error('[DualAgentStore] Session error:', sessionId, error);
    });
  }
  
  // ============================================================================
  // Getters
  // ============================================================================
  
  function getSession(sessionId: string): DualAgentSession | undefined {
    return sessions.value.get(sessionId);
  }
  
  function getAllSessions(): DualAgentSession[] {
    return Array.from(sessions.value.values());
  }
  
  // ============================================================================
  // Return
  // ============================================================================
  
  return {
    // State
    sessions,
    activeSessionId,
    pendingPermissions,
    
    // Computed
    activeSession,
    activeOrchestrator,
    
    // Actions
    createSession,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    deleteSession,
    replyPermission,
    
    // Getters
    getSession,
    getAllSessions,
  };
});
