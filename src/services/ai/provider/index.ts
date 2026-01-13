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
import { tauriFetch } from '@/utils/tauriFetch';

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
      
      const result = await generateText({
        model,
        messages: messages as any,
        tools: tools as any,
      });
      
      // Extract tool calls
      const toolCalls = result.toolCalls?.map((tc: any) => ({
        id: tc.toolCallId,
        function: {
          name: tc.toolName,
          arguments: tc.args ?? {},
        },
      }));
      
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

  switch (type) {
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey,
        baseURL: baseUrl,
        headers: {
          // Enable extended features for Claude
          'anthropic-beta': 'interleaved-thinking-2025-05-14,output-128k-2025-02-19',
        },
      });
      return anthropic(model);
    }

    case 'openai': {
      const openai = createOpenAI({
        apiKey,
        baseURL: baseUrl,
      });
      return openai(model);
    }

    case 'google': {
      const google = createGoogleGenerativeAI({
        apiKey,
        baseURL: baseUrl,
      });
      return google(model);
    }

    case 'deepseek':
    case 'glm':
    case 'kimi':
    case 'custom': {
      // Use OpenAI-compatible endpoint
      const providerConfig = PROVIDER_CONFIG[type];
      const openai = createOpenAI({
        apiKey,
        baseURL: baseUrl || providerConfig.baseUrl,
      });
      return openai(model);
    }

    case 'opencode': {
      // OpenCode Zen 免费网关 - 根据模型类型选择正确的 SDK 和 endpoint
      // 不同模型使用不同的 API 格式：
      // - gpt-5-nano: @ai-sdk/openai (Responses API)
      // - big-pickle, glm-4.7-free, grok-code: @ai-sdk/openai-compatible (Chat Completions)
      // - minimax-m2.1-free: @ai-sdk/anthropic (Messages API)
      // - claude-*: @ai-sdk/anthropic (Messages API)
      // - gemini-*: @ai-sdk/google
      
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
          fetch: tauriFetch,
        });
        return google(model);
      }
      
      // 对于 Claude 系列和 minimax-m2.1-free，使用 Anthropic SDK
      if (isClaude || isMinimaxFree) {
        const anthropic = createAnthropic({
          apiKey: apiKey || 'public',
          baseURL: normalizedBaseUrl,
          fetch: tauriFetch,
        });
        return anthropic(model);
      }
      
      // 对于 GPT 和其他模型，使用 OpenAI SDK
      const openai = createOpenAI({
        apiKey: apiKey || 'public',
        baseURL: normalizedBaseUrl,
        // 使用 Tauri HTTP 插件（在 Tauri 环境中）或原生 fetch（在浏览器中）
        fetch: async (url, init) => {
          const urlStr = typeof url === 'string' ? url : url.toString();
          
          // 打印完整的请求头信息用于调试
          const headersObj = init?.headers as Record<string, string> || {};
          console.log('[Provider] Making request via tauriFetch:', {
            url: urlStr,
            method: init?.method || 'GET',
            hasBody: !!init?.body,
            headers: Object.keys(headersObj),
            hasAuthorization: 'authorization' in headersObj || 'Authorization' in headersObj,
          });
          
          try {
            // 确保 URL 是字符串格式
            const fetchUrl = typeof url === 'string' ? url : url.toString();
            
            // 构建请求配置
            const fetchInit: RequestInit = {
              ...init,
              headers: {
                ...(init?.headers as Record<string, string> || {}),
                'Content-Type': 'application/json',
              },
            };
            
            // 使用 tauriFetch（会自动选择 Tauri HTTP 插件或原生 fetch）
            const response = await tauriFetch(fetchUrl, fetchInit);
            
            console.log('[Provider] Fetch response:', {
              status: response.status,
              statusText: response.statusText,
              ok: response.ok,
              headers: Object.fromEntries(response.headers.entries()),
            });
            
                    // 如果响应不成功，尝试读取错误信息并构造标准化的错误响应
                    if (!response.ok) {
                      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                      let errorCode = 'api_error';
                      
                      try {
                        const errorData = await response.clone().json();
                        console.error('[Provider] API error response:', errorData);
                        
                        // 尝试从多种错误格式中提取信息
                        if (errorData.error) {
                          if (typeof errorData.error === 'string') {
                            errorMessage = errorData.error;
                          } else if (errorData.error.message) {
                            errorMessage = errorData.error.message;
                            errorCode = errorData.error.code || errorData.error.type || errorCode;
                          }
                        } else if (errorData.message) {
                          errorMessage = errorData.message;
                          errorCode = errorData.code || errorCode;
                        } else if (errorData.detail) {
                          errorMessage = typeof errorData.detail === 'string' 
                            ? errorData.detail 
                            : JSON.stringify(errorData.detail);
                        }
                      } catch {
                        const errorText = await response.clone().text();
                        console.error('[Provider] API error text:', errorText);
                        if (errorText) {
                          errorMessage = errorText;
                        }
                      }
                      
                      // 构造 OpenAI 风格的错误响应，以便 AI SDK 能正确解析
                      const standardErrorBody = JSON.stringify({
                        error: {
                          message: errorMessage,
                          type: errorCode,
                          code: errorCode,
                        },
                      });
                      
                      // 返回一个新的 Response 对象，带有标准化的错误格式
                      return new Response(standardErrorBody, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: {
                          'Content-Type': 'application/json',
                        },
                      });
                    }
                    
                    return response;
          } catch (error) {
            console.error('[Provider] Fetch error details:', {
              error: error instanceof Error ? error.message : String(error),
              name: error instanceof Error ? error.name : 'Unknown',
              stack: error instanceof Error ? error.stack : undefined,
              url: urlStr,
            });
            
            // 提供更详细的错误信息
            if (error instanceof TypeError) {
              if (error.message.includes('Load failed')) {
                throw new TypeError(
                  `无法连接到 ${urlStr}。请检查：\n` +
                  `1. 网络连接是否正常\n` +
                  `2. API 服务是否可用\n` +
                  `3. 是否存在防火墙或代理阻止\n` +
                  `4. SSL/TLS 证书是否有效`
                );
              }
            }
            
            throw error;
          }
        },
      });
      
      // 对于 GPT 模型使用 responses 方法（会自动使用 /responses endpoint）
      // 对于其他模型使用 chat 方法（使用 /chat/completions endpoint）
      if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) {
        // OpenAI 官方模型使用 responses API
        return openai.responses(model);
      }
      
      // 其他模型（如 minimax、deepseek 等第三方模型）使用 chat completions API
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
      // Note: In Tauri, fetch requests are not subject to CORS restrictions
      // "Load failed" usually means the endpoint is unreachable or SSL/TLS issues
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
