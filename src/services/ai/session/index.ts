/**
 * Rebebuca AI Service Layer - Session Manager
 * Manage AI conversation sessions
 */

import type {
  AISession,
  CreateSessionConfig,
  Message,
  ToolContext,
  TokenUsage,
  PermissionRequest,
} from '../types';
import { streamResponse, type StreamResult } from '../stream';
import { getTools, getDefaultToolIds } from '../tools';
import { permissionManager } from '../permission';
import { aiEventBus } from '../utils/eventBus';
import { generateSessionId, generateMessageId } from '../utils/id';

/**
 * Build default system prompt
 */
function buildSystemPrompt(projectPath: string): string {
  const date = new Date().toISOString().split('T')[0];
  
  return `You are an AI assistant helping with software development tasks.

Current project: ${projectPath}
Today's date: ${date}

Guidelines:
- Use the available tools to read, write, and edit files
- Use bash for running commands (build, test, git, etc.)
- Use glob and grep to find files and search content
- Always read files before editing them
- Be concise and focused on the task
- Ask for clarification if the task is ambiguous

When editing code:
- Preserve existing code style and formatting
- Add helpful comments for complex logic
- Consider error handling and edge cases`;
}

class AISessionManager {
  private sessions = new Map<string, AISession>();
  private abortControllers = new Map<string, AbortController>();
  private metadataCallbacks = new Map<string, Map<string, (metadata: Record<string, unknown>) => void>>();

  /**
   * Create a new AI session
   */
  async createSession(config: CreateSessionConfig): Promise<AISession> {
    const session: AISession = {
      id: generateSessionId(),
      projectPath: config.projectPath,
      provider: config.provider,
      messages: [],
      tools: config.tools ?? getDefaultToolIds(),
      systemPrompts: config.systemPrompts ?? [buildSystemPrompt(config.projectPath)],
      status: 'idle',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.sessions.set(session.id, session);
    aiEventBus.emit('session:created', { session });

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): AISession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): AISession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Add a user message and run the conversation loop
   */
  async sendMessage(sessionId: string, content: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Add user message
    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content,
      createdAt: Date.now(),
    };
    session.messages.push(userMessage);
    session.updatedAt = Date.now();

    aiEventBus.emit('session:message', { sessionId, message: userMessage });

    // Run conversation loop
    await this.runLoop(sessionId);
  }

  /**
   * Run the conversation loop
   */
  private async runLoop(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Set up abort controller
    const abortController = new AbortController();
    this.abortControllers.set(sessionId, abortController);

    // Set up metadata callbacks for this session
    this.metadataCallbacks.set(sessionId, new Map());

    try {
      session.status = 'running';
      aiEventBus.emit('session:status', { sessionId, status: 'running' });

      // Get tools
      const tools = getTools(session.tools);

      // Main loop - continue until no more tool calls
      let continueLoop = true;
      while (continueLoop && session.status === 'running') {
        // Convert messages to CoreMessage format
        const coreMessages = this.convertToCoreMessages(session.messages);

        // Create tool context factory
        const createToolContext = (toolCallId: string): ToolContext => ({
          sessionId,
          projectPath: session.projectPath,
          abortSignal: abortController.signal,
          requestPermission: async (request: PermissionRequest) => {
            await permissionManager.request(request, sessionId);
          },
          updateMetadata: (metadata: Record<string, unknown>) => {
            const callbacks = this.metadataCallbacks.get(sessionId);
            const callback = callbacks?.get(toolCallId);
            callback?.(metadata);

            aiEventBus.emit('tool:progress', { sessionId, toolCallId, metadata });
          },
        });

        // Stream response
        console.log('[AISessionManager] Starting stream response:', {
          sessionId,
          provider: session.provider.type,
          model: session.provider.model,
          baseUrl: session.provider.baseUrl || 'default',
          messageCount: coreMessages.length,
        });
        
        const result = await streamResponse({
          sessionId,
          messages: coreMessages,
          provider: session.provider,
          tools,
          systemPrompt: session.systemPrompts.join('\n\n'),
          abortSignal: abortController.signal,
          createToolContext,
        });

        // Add assistant message
        const assistantMessage: Message = {
          id: generateMessageId(),
          role: 'assistant',
          content: this.buildAssistantContent(result),
          createdAt: Date.now(),
        };
        session.messages.push(assistantMessage);
        session.updatedAt = Date.now();

        aiEventBus.emit('session:message', { sessionId, message: assistantMessage });

        // Update usage
        session.usage = {
          promptTokens: session.usage.promptTokens + result.usage.promptTokens,
          completionTokens: session.usage.completionTokens + result.usage.completionTokens,
          totalTokens: session.usage.totalTokens + result.usage.totalTokens,
        };

        // Check if we should continue
        continueLoop = result.finishReason === 'tool-calls' && result.toolCalls.length > 0;

        // If there were tool calls, add tool result messages
        if (result.toolCalls.length > 0) {
          for (const toolCall of result.toolCalls) {
            if (toolCall.result) {
              const toolMessage: Message = {
                id: generateMessageId(),
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolCallId: toolCall.id,
                    result: toolCall.result,
                  },
                ],
                createdAt: Date.now(),
              };
              session.messages.push(toolMessage);
            }
          }
          session.updatedAt = Date.now();
        }
      }

      session.status = 'completed';
      aiEventBus.emit('session:status', { sessionId, status: 'completed' });
    } catch (error) {
      console.error('[AISessionManager] Error in loop:', error);
      session.status = 'error';
      aiEventBus.emit('session:status', { sessionId, status: 'error' });
      throw error;
    } finally {
      this.abortControllers.delete(sessionId);
      this.metadataCallbacks.delete(sessionId);
      permissionManager.clearSessionRules(sessionId);
    }
  }

  /**
   * Convert our messages to simple format for stream
   */
  private convertToCoreMessages(messages: Message[]): Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
  }> {
    const result: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }> = [];

    for (const msg of messages) {
      if (msg.role === 'user' || msg.role === 'system') {
        result.push({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        });
      } else if (msg.role === 'assistant') {
        if (typeof msg.content === 'string') {
          result.push({ role: 'assistant', content: msg.content });
        } else {
          // Extract text from complex content
          const textParts = msg.content
            .filter(p => p.type === 'text')
            .map(p => (p as { type: 'text'; text: string }).text)
            .join('\n');
          if (textParts) {
            result.push({ role: 'assistant', content: textParts });
          }
        }
      } else if (msg.role === 'tool') {
        if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-result') {
              result.push({
                role: 'tool',
                content: JSON.stringify(part.result),
              });
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Build assistant message content from stream result
   */
  private buildAssistantContent(result: StreamResult): string | Message['content'] {
    if (result.toolCalls.length === 0) {
      return result.response;
    }

    // Build content with text and tool calls
    const parts: Message['content'] = [];

    if (result.response) {
      parts.push({ type: 'text', text: result.response });
    }

    for (const toolCall of result.toolCalls) {
      parts.push({
        type: 'tool-call',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        args: toolCall.args,
      });
    }

    return parts;
  }

  /**
   * Stop a running session
   */
  stop(sessionId: string): void {
    const abortController = this.abortControllers.get(sessionId);
    if (abortController) {
      abortController.abort();
    }

    const session = this.sessions.get(sessionId);
    if (session && session.status === 'running') {
      session.status = 'paused';
      aiEventBus.emit('session:status', { sessionId, status: 'paused' });
    }

    permissionManager.cancelSession(sessionId);
  }

  /**
   * Resume a paused session
   */
  async resume(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'paused' && session.status !== 'completed') {
      throw new Error(`Cannot resume session in status: ${session.status}`);
    }

    session.status = 'idle';
    await this.runLoop(sessionId);
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    this.stop(sessionId);
    this.sessions.delete(sessionId);
    permissionManager.clearSessionRules(sessionId);
  }

  /**
   * Clear all sessions
   */
  clearAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.stop(sessionId);
    }
    this.sessions.clear();
  }

  /**
   * Update session provider config
   */
  updateProvider(sessionId: string, provider: AISession['provider']): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.provider = provider;
      session.updatedAt = Date.now();
      aiEventBus.emit('session:updated', { session });
    }
  }

  /**
   * Update session tools
   */
  updateTools(sessionId: string, tools: string[]): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.tools = tools;
      session.updatedAt = Date.now();
      aiEventBus.emit('session:updated', { session });
    }
  }

  /**
   * Get session usage summary
   */
  getUsageSummary(sessionId: string): TokenUsage | null {
    const session = this.sessions.get(sessionId);
    return session?.usage ?? null;
  }
}

// Singleton instance
export const aiSessionManager = new AISessionManager();

// Re-export for convenience
export type { AISession, CreateSessionConfig };
export type { SessionStatus } from '../types';
