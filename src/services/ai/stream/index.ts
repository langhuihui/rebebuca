/**
 * Rebebuca AI Service Layer - Stream Module
 * Handle streaming responses from AI providers
 */

import { streamText, tool as createTool } from 'ai';
import type {
  ProviderConfig,
  Tool,
  ToolContext,
  TypedStreamEvent,
  TokenUsage,
  ToolExecuteResult,
} from '../types';
import { createLanguageModel } from '../provider';
import { aiEventBus } from '../utils/eventBus';

export interface StreamInput {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
  }>;
  provider: ProviderConfig;
  tools: Tool[];
  systemPrompt?: string;
  abortSignal?: AbortSignal;
  createToolContext: (toolCallId: string) => ToolContext;
  onEvent?: (event: TypedStreamEvent) => void;
}

export interface StreamResult {
  response: string;
  toolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
    result?: ToolExecuteResult;
  }>;
  usage: TokenUsage;
  finishReason: 'stop' | 'tool-calls' | 'length' | 'content-filter' | 'error';
}

/**
 * Stream a response from the AI model
 */
export async function streamResponse(input: StreamInput): Promise<StreamResult> {
  const {
    sessionId,
    messages,
    provider,
    tools,
    systemPrompt,
    abortSignal,
    createToolContext,
    onEvent,
  } = input;

  // Create language model
  console.log('[Stream] Creating language model:', { 
    type: provider.type, 
    model: provider.model, 
    baseUrl: provider.baseUrl || 'default',
    hasApiKey: !!provider.apiKey 
  });
  
  const model = await createLanguageModel(provider);

  // Convert tools to AI SDK format
  const aiTools = buildAITools(tools, createToolContext, sessionId);

  // Build messages with system prompt
  const allMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
  if (systemPrompt) {
    allMessages.push({ role: 'system', content: systemPrompt });
  }
  for (const msg of messages) {
    if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') {
      allMessages.push({ role: msg.role, content: msg.content });
    }
  }

  // Result accumulators
  let responseText = '';
  const toolCalls: StreamResult['toolCalls'] = [];
  let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let finishReason: StreamResult['finishReason'] = 'stop';

  try {
    // Validate provider config before making request
    const finalBaseUrl = provider.baseUrl || (await import('../provider/models')).PROVIDER_CONFIG[provider.type]?.baseUrl;
    if (!finalBaseUrl && provider.type !== 'opencode') {
      console.warn('[Stream] No baseUrl provided for provider:', provider.type);
    }
    
    console.log('[Stream] Starting stream request:', {
      provider: provider.type,
      model: provider.model,
      baseUrl: finalBaseUrl || 'default',
      messageCount: allMessages.length,
      hasTools: Object.keys(aiTools).length > 0,
    });
    
    const response = streamText({
      model,
      messages: allMessages,
      tools: aiTools,
      maxOutputTokens: provider.options?.maxTokens ?? 8192,
      temperature: provider.options?.temperature ?? 0.7,
      topP: provider.options?.topP,
      abortSignal,
    });

    // Process stream
    for await (const chunk of response.fullStream) {
      switch (chunk.type) {
        case 'text-delta': {
          const delta = 'text' in chunk ? chunk.text : '';
          responseText += delta;
          const event: TypedStreamEvent = { type: 'text-delta', text: delta };
          onEvent?.(event);
          aiEventBus.emit('stream:event', { sessionId, event });
          break;
        }

        case 'reasoning-delta': {
          const delta = 'text' in chunk ? chunk.text : '';
          const event: TypedStreamEvent = { type: 'reasoning-delta', text: delta };
          onEvent?.(event);
          aiEventBus.emit('stream:event', { sessionId, event });
          break;
        }

        case 'tool-call': {
          const args = 'input' in chunk ? chunk.input as Record<string, unknown> : {};
          const event: TypedStreamEvent = {
            type: 'tool-call',
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            args,
          };
          onEvent?.(event);
          aiEventBus.emit('stream:event', { sessionId, event });

          // Track tool call
          toolCalls.push({
            id: chunk.toolCallId,
            name: chunk.toolName,
            args,
          });
          break;
        }

        case 'tool-result': {
          // Find and update tool call with result
          const toolCall = toolCalls.find(tc => tc.id === chunk.toolCallId);
          const output = 'output' in chunk ? chunk.output : chunk;
          if (toolCall) {
            toolCall.result = output as ToolExecuteResult;
          }

          const event: TypedStreamEvent = {
            type: 'tool-result',
            toolCallId: chunk.toolCallId,
            result: output as ToolExecuteResult,
          };
          onEvent?.(event);
          aiEventBus.emit('stream:event', { sessionId, event });
          break;
        }

        case 'finish': {
          finishReason = mapFinishReason(chunk.finishReason);
          const event: TypedStreamEvent = { type: 'finish', reason: finishReason };
          onEvent?.(event);
          aiEventBus.emit('stream:event', { sessionId, event });
          break;
        }

        case 'error': {
          const error = chunk.error instanceof Error ? chunk.error : new Error(String(chunk.error));
          const event: TypedStreamEvent = { type: 'error', error };
          onEvent?.(event);
          aiEventBus.emit('stream:event', { sessionId, event });
          throw error;
        }
      }
    }

    // Get final usage
    const finalUsage = await response.usage;
    if (finalUsage) {
      // Extract usage values, handling different possible shapes
      const usageAny = finalUsage as unknown as Record<string, unknown>;
      usage = {
        promptTokens: typeof usageAny.promptTokens === 'number' ? usageAny.promptTokens : 0,
        completionTokens: typeof usageAny.completionTokens === 'number' ? usageAny.completionTokens : 0,
        totalTokens: typeof usageAny.totalTokens === 'number' ? usageAny.totalTokens : 0,
      };

      console.log('[StreamResponse] Usage extracted:', { usage, finalUsage, sessionId });
      const event: TypedStreamEvent = { type: 'usage', usage };
      onEvent?.(event);
      aiEventBus.emit('stream:event', { sessionId, event });
    } else {
      console.warn('[StreamResponse] No usage data available from response');
    }

    return {
      response: responseText,
      toolCalls,
      usage,
      finishReason,
    };
  } catch (error) {
    // Handle abort
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        response: responseText,
        toolCalls,
        usage,
        finishReason: 'stop',
      };
    }

    // Enhance error message for network errors
    let enhancedError: Error;
    if (error instanceof TypeError && error.message.includes('Load failed')) {
      const baseUrl = provider.baseUrl || 'default';
      const providerType = provider.type;
      
      // 尝试获取更详细的错误信息
      let detailedMessage = `网络请求失败: ${error.message}\n\n可能的原因：\n`;
      detailedMessage += `1. API endpoint: ${baseUrl}\n`;
      detailedMessage += `2. Provider type: ${providerType}\n`;
      detailedMessage += `3. Model: ${provider.model}\n\n`;
      detailedMessage += `请检查：\n`;
      detailedMessage += `- 网络连接是否正常\n`;
      detailedMessage += `- API endpoint 是否可访问\n`;
      detailedMessage += `- 是否存在防火墙或代理阻止\n`;
      
      if (providerType === 'opencode') {
        detailedMessage += `- OpenCode Zen 服务是否可用\n`;
        detailedMessage += `- 可以尝试访问 https://opencode.ai 检查服务状态\n`;
      }
      
      enhancedError = new Error(detailedMessage);
      (enhancedError as any).cause = error;
      enhancedError.name = 'NetworkError';
    } else {
      enhancedError = error instanceof Error ? error : new Error(String(error));
    }

    const event: TypedStreamEvent = {
      type: 'error',
      error: enhancedError,
    };
    onEvent?.(event);
    aiEventBus.emit('stream:event', { sessionId, event });

    throw enhancedError;
  }
}

// Tool execute wrapper uses any for flexibility with AI SDK
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Build AI SDK tools from our tool definitions
 */
function buildAITools(
  tools: Tool[],
  createToolContext: (toolCallId: string) => ToolContext,
  sessionId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {};

  for (const t of tools) {
    // Build execute wrapper with proper typing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const executeWrapper = async (args: any) => {
      const toolCallId = `${t.id}_${Date.now()}`;
      const ctx = createToolContext(toolCallId);

      // Emit tool start event
      aiEventBus.emit('tool:start', { sessionId, toolCallId, toolName: t.id });

      try {
        const toolResult = await t.execute(args, ctx);

        // Emit tool complete event
        aiEventBus.emit('tool:complete', { sessionId, toolCallId, result: toolResult });

        return toolResult;
      } catch (error) {
        // Emit tool error event
        aiEventBus.emit('tool:error', {
          sessionId,
          toolCallId,
          error: error instanceof Error ? error : new Error(String(error)),
        });

        throw error;
      }
    };

    result[t.id] = createTool({
      description: t.description,
      parameters: t.parameters as any,
      execute: executeWrapper,
    } as any);
  }

  return result;
}

/**
 * Map AI SDK finish reason to our type
 */
function mapFinishReason(
  reason: string | null | undefined
): StreamResult['finishReason'] {
  switch (reason) {
    case 'stop':
    case 'end-turn':
      return 'stop';
    case 'tool-calls':
    case 'function-call':
      return 'tool-calls';
    case 'length':
    case 'max-tokens':
      return 'length';
    case 'content-filter':
      return 'content-filter';
    default:
      return 'stop';
  }
}
