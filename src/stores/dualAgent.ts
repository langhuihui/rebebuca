/**
 * Rebebuca - Dual Agent Store
 * Copyright (C) 2025 rebebuca contributors
 *
 * Store for managing Supervisor-Worker dual agent sessions using Rust backend.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { aiTaskLimitService } from '../services/aiTaskLimitService';
import { getAdapter } from '../adapters';
import type {
  DualAgentSession,
  DualAgentConfig,
  AgentMessage,
  AgentRole,
} from '../services/ai/agents/types';
import type { PermissionRequest, PermissionReply } from '../services/ai/types';
import type {
  TaskGoal as AdapterTaskGoal,
  OrchestrationProgressEvent,
  OrchestrationAgentMessageEvent,
  OrchestrationToolUseEvent,
  OrchestrationWorkerStreamEvent,
  OrchestrationCompleteEvent,
  OrchestrationErrorEvent,
} from '../adapters/types';

export interface ToolExecution {
  id: string;
  toolName: string;
  status: 'running' | 'success' | 'error';
  args?: Record<string, unknown>;
  result?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
}

export interface ExtendedDualAgentSession extends DualAgentSession {
  toolExecutions: ToolExecution[];
  rustSessionId: string;
}

export const useDualAgentStore = defineStore('dualAgent', () => {
  const sessions = ref<Map<string, ExtendedDualAgentSession>>(new Map());
  const activeSessionId = ref<string | null>(null);
  const pendingPermissions = ref<PermissionRequest[]>([]);
  const eventUnsubscribers = ref<Map<string, (() => void)[]>>(new Map());

  const activeSession = computed(() => {
    if (!activeSessionId.value) return null;
    return sessions.value.get(activeSessionId.value) || null;
  });

  const getToolExecutions = (sessionId: string): ToolExecution[] => {
    const session = sessions.value.get(sessionId);
    return session?.toolExecutions || [];
  };

  async function createSession(config: DualAgentConfig): Promise<ExtendedDualAgentSession> {
    const limitCheck = aiTaskLimitService.checkCanCreateTask();
    if (!limitCheck.allowed) {
      const reason = limitCheck.reason === 'taskLimitAnonymous'
        ? `AI task limit reached (${limitCheck.info.currentCount}/${limitCheck.info.maxLimit}). Please login to create more tasks.`
        : `AI task limit reached (${limitCheck.info.currentCount}/${limitCheck.info.maxLimit}). Current plan: ${limitCheck.info.planType}`;
      throw new Error(reason);
    }

    const adapter = await getAdapter();
    const getApiKey = (providerType: string, apiKey?: string) => {
      if (providerType === 'opencode') {
        return apiKey && apiKey.trim() ? apiKey : undefined;
      }
      return apiKey;
    };

    const rustSessionId = await adapter.orchestration.createSession({
      projectPath: config.projectPath,
      supervisorProvider: {
        provider: config.supervisorProvider.type,
        model: config.supervisorProvider.model,
        apiKey: getApiKey(config.supervisorProvider.type, config.supervisorProvider.apiKey),
        baseUrl: config.supervisorProvider.baseUrl,
      },
      workerProvider: {
        provider: config.workerProvider.type,
        model: config.workerProvider.model,
        apiKey: getApiKey(config.workerProvider.type, config.workerProvider.apiKey),
        baseUrl: config.workerProvider.baseUrl,
      },
      maxRounds: config.maxRounds,
      autoApprovePermissions: false,
    });

    let restoredRound = 0;
    let restoredAction = 'Initializing';
    try {
      const boulderState = await adapter.orchestration.checkBoulderState(config.projectPath);
      if (boulderState?.exists && boulderState.progress) {
        restoredRound = boulderState.progress.current_round;
        restoredAction = boulderState.progress.current_action;
      }
    } catch {
      console.warn('[DualAgentStore] Failed to check boulder state');
    }

    const sessionId = `rust-${Date.now()}`;
    const session: ExtendedDualAgentSession = {
      id: sessionId,
      rustSessionId,
      projectPath: config.projectPath,
      goal: config.goal,
      supervisorProvider: config.supervisorProvider,
      workerProvider: config.workerProvider,
      status: 'idle',
      supervisorState: 'idle',
      workerState: 'idle',
      conversation: [],
      loop: {
        currentRound: restoredRound,
        maxRounds: config.maxRounds || 10,
        maxStepsPerRound: 100,
        currentStepInRound: 0,
      },
      progress: {
        currentStep: 0,
        totalSteps: config.maxRounds || 10,
        currentAction: restoredAction,
        completedMilestones: [],
        isStuck: false,
        stuckCount: 0,
      },
      usage: {
        supervisor: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        worker: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        total: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      toolExecutions: [],
    };

    sessions.value.set(sessionId, session);
    activeSessionId.value = sessionId;
    console.log('[DualAgentStore] Created session:', sessionId);

    return session;
  }

  async function startSession(sessionId: string): Promise<void> {
    const session = sessions.value.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const adapter = await getAdapter();
    const goal: AdapterTaskGoal = {
      objective: session.goal.objective,
      taskName: session.goal.taskName || session.goal.objective,
      acceptanceCriteria: session.goal.acceptanceCriteria,
      context: session.goal.context,
      constraints: session.goal.constraints,
    };

    setupRustEventListeners(sessionId, session.rustSessionId, adapter);
    await new Promise(resolve => setTimeout(resolve, 100));

    await adapter.orchestration.start(session.rustSessionId, goal);
    session.status = 'running';
    session.updatedAt = Date.now();
  }

  async function pauseSession(sessionId: string): Promise<void> {
    const session = sessions.value.get(sessionId);
    if (!session) return;
    session.status = 'paused';
    session.updatedAt = Date.now();
  }

  async function resumeSession(sessionId: string): Promise<void> {
    const session = sessions.value.get(sessionId);
    if (!session) return;

    try {
      const adapter = await getAdapter();
      const boulderState = await adapter.orchestration.checkBoulderState(session.projectPath);
      if (boulderState?.exists && boulderState.progress) {
        session.loop.currentRound = boulderState.progress.current_round;
        session.progress.currentAction = boulderState.progress.current_action;
      }
    } catch {
      console.warn('[DualAgentStore] Failed to check boulder state');
    }

    const adapter = await getAdapter();
    const goal: AdapterTaskGoal = {
      objective: session.goal.objective,
      taskName: session.goal.taskName || session.goal.objective,
      acceptanceCriteria: session.goal.acceptanceCriteria,
      context: session.goal.context,
      constraints: session.goal.constraints,
    };
    await adapter.orchestration.start(session.rustSessionId, goal);
    session.status = 'running';
    session.updatedAt = Date.now();
  }

  async function stopSession(sessionId: string): Promise<void> {
    const session = sessions.value.get(sessionId);
    if (!session) return;

    console.log('[DualAgentStore] Stopping session:', sessionId);

    const adapter = await getAdapter();
    try {
      await adapter.orchestration.stop(session.rustSessionId);
    } catch (error) {
      console.error('[DualAgentStore] Failed to stop session:', error);
    }

    session.status = 'idle';
    session.supervisorState = 'idle';
    session.workerState = 'idle';
    session.updatedAt = Date.now();
  }

  async function deleteSession(sessionId: string): Promise<void> {
    const session = sessions.value.get(sessionId);
    if (!session) return;

    const adapter = await getAdapter();
    try {
      await adapter.orchestration.stop(session.rustSessionId);
      await adapter.orchestration.removeSession(session.rustSessionId);
    } catch (error) {
      console.warn('[DualAgentStore] Error cleaning up session:', error);
    }

    const unsubscribers = eventUnsubscribers.value.get(sessionId);
    if (unsubscribers) {
      unsubscribers.forEach(unsub => unsub());
      eventUnsubscribers.value.delete(sessionId);
    }

    sessions.value.delete(sessionId);

    if (activeSessionId.value === sessionId) {
      activeSessionId.value = null;
    }
  }

  function replyPermission(requestId: string, _reply: PermissionReply): void {
    pendingPermissions.value = pendingPermissions.value.filter(p => p.id !== requestId);
  }

  async function saveConversationToStorage(
    sessionId: string,
    conversation: any[],
    rustSessionId?: string
  ): Promise<void> {
    try {
      const adapter = await getAdapter();
      await adapter.storage.set(`dualAgentConversation:${sessionId}`, conversation);
      if (rustSessionId && rustSessionId !== sessionId) {
        await adapter.storage.set(`dualAgentConversation:${rustSessionId}`, conversation);
      }
    } catch (error) {
      console.warn('[DualAgentStore] Failed to save conversation:', error);
    }
  }

  const normalizeAgentRole = (role?: string): AgentRole => {
    const normalized = role?.toLowerCase();
    if (normalized === 'supervisor' || normalized === 'worker' || normalized === 'system') {
      return normalized;
    }
    return 'system';
  };

  function setupRustEventListeners(
    sessionId: string,
    rustSessionId: string,
    adapter: Awaited<ReturnType<typeof getAdapter>>
  ): void {
    console.log('[DualAgentStore] Setting up Rust event listeners for session:', sessionId);

    const unsubscribers: (() => void)[] = [];

    const unsubProgress = adapter.orchestration.onProgress((event: OrchestrationProgressEvent) => {
      const eventSessionId = (event as any).sessionId || (event as any).session_id;
      if (eventSessionId !== rustSessionId) return;

      const session = sessions.value.get(sessionId);
      if (session) {
        session.progress = {
          currentStep: event.currentStep,
          totalSteps: event.totalSteps,
          currentAction: event.currentAction,
          completedMilestones: session.progress.completedMilestones,
          isStuck: session.progress.isStuck,
          stuckCount: session.progress.stuckCount,
        };
        session.loop.currentRound = event.currentRound;
        session.loop.maxRounds = event.maxRounds;
        session.updatedAt = Date.now();
      }
    });
    unsubscribers.push(unsubProgress);

    const unsubMessage = adapter.orchestration.onAgentMessage((event: OrchestrationAgentMessageEvent) => {
      const eventSessionId = (event as any).sessionId || (event as any).session_id;
      if (eventSessionId !== rustSessionId) return;

      const session = sessions.value.get(sessionId);
      if (session) {
        const fromRole = normalizeAgentRole(event.fromAgent);
        const toRole = normalizeAgentRole(event.toAgent);

        const message: AgentMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          from: fromRole,
          to: toRole,
          type: event.messageType as 'instruction' | 'report' | 'decision' | 'completion' | 'error',
          content: event.content,
          timestamp: new Date(event.timestamp).getTime(),
        };
        session.conversation.push(message);

        if (fromRole === 'supervisor') {
          session.supervisorState = 'idle';
          session.workerState = 'running';
        } else if (fromRole === 'worker') {
          session.workerState = 'idle';
          session.supervisorState = 'running';
        } else if (toRole === 'worker') {
          session.workerState = 'running';
        } else if (toRole === 'supervisor') {
          session.supervisorState = 'running';
        }

        session.updatedAt = Date.now();
        saveConversationToStorage(sessionId, session.conversation, rustSessionId);
      }
    });
    unsubscribers.push(unsubMessage);

    const unsubStream = adapter.orchestration.onWorkerStream((event: OrchestrationWorkerStreamEvent) => {
      const eventSessionId = (event as any).sessionId || (event as any).session_id;
      if (eventSessionId !== rustSessionId) return;

      const session = sessions.value.get(sessionId);
      if (session) {
        const fromRole = event.from || 'worker';
        const isBlocked = event.content.includes('LLM 调用被拦截')
          || event.content.includes('Access denied')
          || event.content.includes('403');
        if (isBlocked) {
          const providerConfig = fromRole === 'supervisor'
            ? session.supervisorProvider
            : session.workerProvider;
          const apiKeyLength = providerConfig.apiKey?.length ?? 0;
          console.warn('[DualAgentStore] LLM call blocked', {
            sessionId,
            rustSessionId,
            fromRole,
            provider: providerConfig.type,
            model: providerConfig.model,
            baseUrl: providerConfig.baseUrl,
            apiKeyPresent: !!providerConfig.apiKey,
            apiKeyLength,
            eventSnippet: event.content.slice(0, 200),
            timestamp: event.timestamp,
          });
        }

        // Find existing streaming message from the same role
        let workerMsg = session.conversation.find(
          m => m.from === fromRole && m.type === 'streaming' && !m.metadata?.isComplete
        );

        if (!workerMsg) {
          workerMsg = {
            id: `stream-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            from: fromRole as AgentRole,
            to: fromRole === 'supervisor' ? 'worker' : 'supervisor',
            type: 'streaming',
            content: '',
            timestamp: Date.now(),
            metadata: {
              isStreaming: true,
              isComplete: false,
              isInternal: fromRole === 'supervisor', // Supervisor retry logs are internal
            },
          };
          session.conversation.push(workerMsg);
        }

        workerMsg.content += event.content;
        workerMsg.metadata = {
          ...workerMsg.metadata,
          isStreaming: !event.isComplete,
          isComplete: event.isComplete,
        };
        workerMsg.timestamp = new Date(event.timestamp).getTime();
        session.updatedAt = Date.now();
        saveConversationToStorage(sessionId, session.conversation, rustSessionId);
      }
    });
    unsubscribers.push(unsubStream);

    const unsubTool = adapter.orchestration.onToolUse((event: OrchestrationToolUseEvent) => {
      const eventSessionId = (event as any).sessionId || (event as any).session_id;
      if (eventSessionId !== rustSessionId) return;

      const session = sessions.value.get(sessionId);
      if (session) {
        const toolId = `tool-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        if (event.status === 'start') {
          const toolExec: ToolExecution = {
            id: toolId,
            toolName: event.toolName,
            status: 'running',
            args: event.args,
            startTime: new Date(event.timestamp).getTime(),
          };
          session.toolExecutions.push(toolExec);
        } else {
          const existing = session.toolExecutions.find(
            t => t.toolName === event.toolName && t.status === 'running'
          );
          if (existing) {
            if (event.status === 'complete') {
              existing.status = 'success';
            } else if (event.status === 'error') {
              const errorMsg = event.result || '';
              if (errorMsg.includes('stopped by user')) {
                existing.status = 'success';
              } else {
                existing.status = 'error';
              }
            }
            existing.result = event.result;
            existing.endTime = new Date(event.timestamp).getTime();
            existing.durationMs = existing.endTime - existing.startTime;
          }
        }
        session.updatedAt = Date.now();
      }
    });
    unsubscribers.push(unsubTool);

    const unsubComplete = adapter.orchestration.onComplete((event: OrchestrationCompleteEvent) => {
      const eventSessionId = (event as any).sessionId || (event as any).session_id;
      if (eventSessionId !== rustSessionId) return;

      const session = sessions.value.get(sessionId);
      if (session) {
        if (event.success) {
          session.status = 'completed';
        } else {
          const errorMsg = event.summary || '';
          if (errorMsg.includes('stopped by user')) {
            session.status = 'idle';
          } else {
            session.status = 'error';
          }
        }
        session.supervisorState = 'idle';
        session.workerState = 'idle';
        session.updatedAt = Date.now();

        const message: AgentMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          from: 'supervisor',
          to: 'worker',
          type: 'completion',
          content: event.summary,
          timestamp: new Date(event.timestamp).getTime(),
        };
        session.conversation.push(message);
        saveConversationToStorage(sessionId, session.conversation, rustSessionId);
      }
    });
    unsubscribers.push(unsubComplete);

    const unsubError = adapter.orchestration.onError((event: OrchestrationErrorEvent) => {
      const eventSessionId = (event as any).sessionId || (event as any).session_id;
      if (eventSessionId !== rustSessionId) return;

      const session = sessions.value.get(sessionId);
      if (session) {
        if (event.error && event.error.includes('stopped by user')) {
          session.status = 'idle';
        } else if (!event.recoverable) {
          session.status = 'error';
        }
        session.updatedAt = Date.now();

        const fromRole = normalizeAgentRole(event.agent);
        const toRole = normalizeAgentRole(fromRole === 'worker' ? 'supervisor' : 'worker');
        const message: AgentMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          from: fromRole,
          to: toRole,
          type: 'error',
          content: event.error,
          timestamp: new Date(event.timestamp).getTime(),
        };
        session.conversation.push(message);
      }
    });
    unsubscribers.push(unsubError);

    const unsubUsage = adapter.orchestration.onUsage((event) => {
      const eventSessionId = (event as any).sessionId || (event as any).session_id;
      if (eventSessionId !== rustSessionId) return;

      const session = sessions.value.get(sessionId);
      if (session) {
        const promptTokens = event.promptTokens ?? 0;
        const completionTokens = event.completionTokens ?? 0;
        const totalTokens = event.totalTokens ?? (promptTokens + completionTokens);
        const agent = (event as any).agent?.toLowerCase() as 'supervisor' | 'worker' | undefined;

        if (agent === 'supervisor' || agent === 'worker') {
          session.usage[agent] = {
            promptTokens: session.usage[agent].promptTokens + promptTokens,
            completionTokens: session.usage[agent].completionTokens + completionTokens,
            totalTokens: session.usage[agent].totalTokens + totalTokens,
          };
        }

        session.usage.total = {
          promptTokens: session.usage.total.promptTokens + promptTokens,
          completionTokens: session.usage.total.completionTokens + completionTokens,
          totalTokens: session.usage.total.totalTokens + totalTokens,
        };
        session.updatedAt = Date.now();
      }
    });
    unsubscribers.push(unsubUsage);

    eventUnsubscribers.value.set(sessionId, unsubscribers);
  }

  function getSession(sessionId: string): ExtendedDualAgentSession | undefined {
    return sessions.value.get(sessionId);
  }

  function getAllSessions(): ExtendedDualAgentSession[] {
    return Array.from(sessions.value.values());
  }

  async function loadConversationFromStorage(sessionId: string): Promise<any[]> {
    try {
      const adapter = await getAdapter();
      return await adapter.storage.get<any[]>(`dualAgentConversation:${sessionId}`) || [];
    } catch {
      return [];
    }
  }

  return {
    sessions,
    activeSessionId,
    pendingPermissions,
    activeSession,
    createSession,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    deleteSession,
    replyPermission,
    getSession,
    getAllSessions,
    getToolExecutions,
    loadConversationFromStorage,
  };
});
