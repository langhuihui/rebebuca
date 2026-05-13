/**
 * Rebebuca AI Service Layer - Provider Manager
 * Unified interface for multiple AI providers
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText, type LanguageModel } from 'ai';
import type { ProviderConfig, ProviderType, TokenUsage } from '../types';
import { PROVIDER_CONFIG } from './models';
import { proxyFetch } from '@/utils/proxyFetch';

// Message format for chat
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ============================================================================
// LLM Provider Interface
// ============================================================================

export interface ChatResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    function: {
      name: string;
      arguments: string | Record<string, unknown>;
    };
  }>;
  usage?: TokenUsage;
}

export interface LLMProvider {
  chat(messages: ChatMessage[], options?: { stream?: boolean }): Promise<ChatResponse>;
  chatWithTools(
    messages: ChatMessage[],
    tools: Array<{
      type: 'function';
      function: {
        name: string;
        description: string;
        parameters: unknown;
      };
    }>,
    options?: { stream?: boolean }
  ): Promise<ChatResponse>;
}

/**
 * Create a unified LLM provider wrapper
 */
export function createProvider(config: ProviderConfig): LLMProvider {
  return {
    async chat(messages, options = {}) {
      const model = await createLanguageModel(config);
      
      if (options.stream) {
        // For streaming, collect all text
        const result = await streamText({
          model,
          messages: messages as any,
        });
        
        let content = '';
        for await (const chunk of result.textStream) {
          content += chunk;
        }
        
        const usage = await result.usage;
        return {
          content,
          usage: {
            promptTokens: (usage as any).promptTokens ?? 0,
            completionTokens: (usage as any).completionTokens ?? 0,
            totalTokens: (usage as any).totalTokens ?? 0,
          },
        };
      } else {
        const result = await generateText({
          model,
          messages: messages as any,
        });
        
        return {
          content: result.text,
          usage: {
            promptTokens: (result.usage as any).promptTokens ?? 0,
            completionTokens: (result.usage as any).completionTokens ?? 0,
            totalTokens: (result.usage as any).totalTokens ?? 0,
          },
        };
      }
    },
    
    async chatWithTools(messages, toolDefs, _options = {}) {
      const model = await createLanguageModel(config);
      
      // Convert tool definitions to CoreTool format
      const tools: Record<string, { description: string; parameters: unknown }> = {};
      for (const toolDef of toolDefs) {
        tools[toolDef.function.name] = {
          description: toolDef.function.description,
          parameters: toolDef.function.parameters as any,
        };
      }
      
      // Debug: log tool definitions being passed
      console.log('[Provider] Tool definitions:', JSON.stringify(Object.keys(tools)));
      for (const [name, def] of Object.entries(tools)) {
        const params = def.parameters as any;
        const typeName = params?._def?.typeName;
        console.log(`[Provider] Tool ${name} parameters type:`, typeof def.parameters, typeName);
      }
      
      const result = await generateText({
        model,
        messages: messages as any,
        tools: tools as any,
      });
      
      // Debug: log raw tool calls from AI SDK
      console.log('[Provider] Raw toolCalls from AI SDK:', JSON.stringify(result.toolCalls, null, 2));
      
      // Extract tool calls
      const toolCalls = result.toolCalls?.map((tc: any) => {
        console.log(`[Provider] Processing toolCall: toolName=${tc.toolName}, args=`, tc.args, 'type=', typeof tc.args);
        return {
          id: tc.toolCallId,
          function: {
            name: tc.toolName,
            arguments: tc.args ?? {},
          },
        };
      });
      
      return {
        content: result.text,
        toolCalls,
        usage: {
          promptTokens: (result.usage as any).promptTokens ?? 0,
          completionTokens: (result.usage as any).completionTokens ?? 0,
          totalTokens: (result.usage as any).totalTokens ?? 0,
        },
      };
    },
  };
}

/**
 * Create a language model instance from provider config
 */
export async function createLanguageModel(config: ProviderConfig): Promise<LanguageModel> {
  const { type, apiKey, baseUrl, model } = config;

  // Debug log to verify config
  console.log('[Provider] Creating language model:', {
    type,
    model,
    baseUrl: baseUrl || 'default',
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : 'none',
  });

  if (type === 'kilo') {
    console.warn('[Provider] Kilo provider is temporarily disabled');
    throw new Error('Kilo provider is temporarily disabled');
  }

  switch (type) {
    case 'anthropic': {
      // Only enable beta features for official Anthropic API
      // Third-party proxies may not support these features
      const isOfficialApi = !baseUrl || baseUrl.includes('anthropic.com');
      
      const anthropic = createAnthropic({
        apiKey,
        baseURL: baseUrl,
        headers: isOfficialApi ? {
          // Enable extended features for Claude (official API only)
          'anthropic-beta': 'interleaved-thinking-2025-05-14,output-128k-2025-02-19',
        } : undefined,
        fetch: proxyFetch,
      });
      return anthropic(model);
    }

    case 'openai': {
      const openai = createOpenAI({
        apiKey,
        baseURL: baseUrl,
        fetch: proxyFetch,
      });
      return openai(model);
    }

    case 'openrouter':
    case 'deepseek':
    case 'glm':
    case 'kimi':
    case 'custom': {
      // Use OpenAI-compatible endpoint
      const providerConfig = PROVIDER_CONFIG[type];
      const effectiveApiKey = apiKey || '';

      const openai = createOpenAI({
        apiKey: effectiveApiKey,
        baseURL: baseUrl || providerConfig.baseUrl,
        fetch: proxyFetch,
      });
      return openai(model);
    }

    case 'google': {
      const google = createGoogleGenerativeAI({
        apiKey,
        baseURL: baseUrl,
        fetch: proxyFetch,
      });
      return google(model);
    }

    case 'opencode': {
      // OpenCode Zen - 根据模型类型选择正确的 SDK 和 endpoint
      // 免费模型使用 apiKey: "public"
      // 不同模型使用不同的 API 格式：
      // - gpt-5-nano: @ai-sdk/openai (Responses API)
      // - big-pickle, glm-4.7-free, grok-code: @ai-sdk/openai-compatible (Chat Completions)
      // - minimax-m2.1-free: @ai-sdk/anthropic (Messages API)
      // - claude-*: @ai-sdk/anthropic (Messages API)
      // - gemini-*: @ai-sdk/google

      const effectiveApiKey = apiKey || 'public';
      console.log('[Provider] OpenCode using apiKey:', effectiveApiKey === 'public' ? '"public" (free model)' : '***');

      // 确定基础 URL
      const userBaseUrl = baseUrl || 'https://opencode.ai/zen/v1';
      
      const baseUrlRoot = userBaseUrl.replace(/\/(chat\/completions|responses|messages|v1\/models\/.*)?$/, '');
      const zenBase = baseUrlRoot.endsWith('/zen/v1') ? baseUrlRoot : `${baseUrlRoot}/zen/v1`;
      const normalizedBaseUrl = zenBase.replace(/\/+$/, '');
      
      // 判断模型类型
      const isGPT = model.startsWith('gpt-');
      const isClaude = model.startsWith('claude-') || model.includes('claude');
      const isGemini = model.startsWith('gemini-');
      // minimax-m2.1-free 在 OpenCode 上使用 Anthropic 格式
      const isMinimaxFree = model === 'minimax-m2.1-free';
      // 这些模型使用 OpenAI Compatible 格式
      const isOpenAICompatible = ['big-pickle', 'glm-4.7-free', 'grok-code'].includes(model);
      
      console.log('[Provider] Creating OpenCode model:', { 
        model, 
        baseUrl: normalizedBaseUrl,
        isGPT,
        isClaude,
        isGemini,
        isMinimaxFree,
        isOpenAICompatible,
        apiKey: apiKey ? '***' : 'public' 
      });
      
      // 对于 Gemini，使用 Google SDK
      if (isGemini) {
        const google = createGoogleGenerativeAI({
          apiKey: apiKey || 'public',
          baseURL: `${normalizedBaseUrl}/models/${model}`,
          fetch: proxyFetch,
        });
        return google(model);
      }
      
      // 对于 Claude 系列和 minimax-m2.1-free，使用 Anthropic SDK
      if (isClaude || isMinimaxFree) {
        const anthropic = createAnthropic({
          apiKey: effectiveApiKey,
          baseURL: normalizedBaseUrl,
          fetch: proxyFetch,
        });
        return anthropic(model);
      }

      // 对于 GPT 和其他模型，使用 OpenAI SDK
      const openai = createOpenAI({
        apiKey: effectiveApiKey,
        baseURL: normalizedBaseUrl,
        fetch: proxyFetch,
      });

      // 对于 GPT 模型使用 responses 方法（会自动使用 /responses endpoint）
      // 对于其他模型使用 chat completions API
      if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) {
        return openai.responses(model);
      }

      return openai.chat(model);
    }

    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}

/**
 * Validate API key format (basic check)
 */
export function validateApiKey(type: ProviderType, apiKey: string): boolean {
  // OpenCode Zen 免费模型不需要 API key
  if (type === 'opencode') {
    return true;
  }

  if (!apiKey || apiKey.trim().length === 0) {
    return false;
  }

  switch (type) {
    case 'anthropic':
      // Anthropic keys start with 'sk-ant-'
      return apiKey.startsWith('sk-ant-') || apiKey.length > 20;
    case 'openai':
      // OpenAI keys start with 'sk-'
      return apiKey.startsWith('sk-') || apiKey.length > 20;
    case 'google':
      // Google API keys are typically 39 characters
      return apiKey.length >= 20;
    default:
      // For other providers, just check it's not empty
      return apiKey.length >= 10;
  }
}

/**
 * Test provider connection by making a minimal request
 */
export async function testProviderConnection(config: ProviderConfig): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // First, test if the baseUrl is reachable
    const baseUrl = config.baseUrl || PROVIDER_CONFIG[config.type]?.baseUrl;
    if (baseUrl) {
      // "Load failed" often means the endpoint is unreachable or SSL/TLS issues
      console.log('[Provider] Testing connection to:', baseUrl);
    }
    
    // Just try to create the model - if config is invalid, this will fail
    await createLanguageModel(config);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export { MODELS, getModelsForProvider, getModelInfo, PROVIDER_CONFIG } from './models';
