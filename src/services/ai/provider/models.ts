/**
 * Rebebuca AI Service Layer - Model Definitions
 * Supported AI models and their configurations
 */

import { reactive, ref } from 'vue';
import type { ModelInfo } from '../types';

export type { ProviderType } from '../types';

/**
 * Model definitions grouped by provider type for easy access
 */
export const MODEL_DEFINITIONS = reactive<Record<string, ModelInfo[]>>({});

// 存储 Kilo AI 的最新版本号
export const kiloLatestVersion = ref('4.151.0');

/**
 * 从 Marketplace 动态获取 Kilo Code 的最新版本号
 */
export async function updateKiloVersion(): Promise<string> {
  const url = 'https://marketplace.visualstudio.com/items/kilocode.Kilo-Code/changelog';
  try {
    const { proxyFetch } = await import('@/utils/proxyFetch');
    const resp = await proxyFetch(url);
    const text = await resp.text();
    
    // 匹配 <h2>4.151.0</h2> 这种格式
    const match = text.match(/<h2>(\d+\.\d+\.\d+)<\/h2>/);
    if (match && match[1]) {
      kiloLatestVersion.value = match[1];
      console.log('[Models] Dynamic Kilo version updated from HTML:', match[1]);
      return match[1];
    }
    
    // 备选匹配：Marketplace 可能会有不同的展示方式
    const versionMatch = text.match(/"version":"(\d+\.\d+\.\d+)"/);
    if (versionMatch && versionMatch[1]) {
      kiloLatestVersion.value = versionMatch[1];
      console.log('[Models] Dynamic Kilo version updated from JSON-in-HTML:', versionMatch[1]);
      return versionMatch[1];
    }
  } catch (error) {
    console.error('[Models] Failed to update Kilo version:', error);
  }
  return kiloLatestVersion.value;
}

export const MODELS: Record<string, ModelInfo> = {
  // Anthropic Claude - 简短 ID (用于兼容第三方 API 端点)
  'claude-opus-4-5': {
    id: 'claude-opus-4-5',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 32000,
    supportsTools: true,
    supportsVision: true,
  },
  'claude-opus-4': {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 32000,
    supportsTools: true,
    supportsVision: true,
  },
  'claude-sonnet-4-5': {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 64000,
    supportsTools: true,
    supportsVision: true,
  },
  'claude-sonnet-4': {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 64000,
    supportsTools: true,
    supportsVision: true,
  },
  'claude-haiku-4-5': {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 8192,
    supportsTools: true,
    supportsVision: true,
  },
  // Anthropic Claude - 带日期版本的 ID (官方 API)
  'claude-opus-4-20250514': {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4 (20250514)',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 32000,
    supportsTools: true,
    supportsVision: true,
  },
  'claude-opus-4-5-20251101': {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5 (20251101)',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 32000,
    supportsTools: true,
    supportsVision: true,
  },
  'claude-sonnet-4-20250514': {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4 (20250514)',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 64000,
    supportsTools: true,
    supportsVision: true,
  },
  'claude-sonnet-4-5-20250929': {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5 (20250929)',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 64000,
    supportsTools: true,
    supportsVision: true,
  },
  'claude-haiku-4-5-20251001': {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5 (20251001)',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 8192,
    supportsTools: true,
    supportsVision: true,
  },
  'claude-3-7-sonnet-20250219': {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 64000,
    supportsTools: true,
    supportsVision: true,
  },
  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 8192,
    supportsTools: true,
    supportsVision: true,
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 8192,
    supportsTools: true,
    supportsVision: true,
  },
  'claude-3-opus-20240229': {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutput: 4096,
    supportsTools: true,
    supportsVision: true,
  },

  // OpenAI GPT
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    maxOutput: 16384,
    supportsTools: true,
    supportsVision: true,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128000,
    maxOutput: 16384,
    supportsTools: true,
    supportsVision: true,
  },
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    contextWindow: 128000,
    maxOutput: 4096,
    supportsTools: true,
    supportsVision: true,
  },
  'o1': {
    id: 'o1',
    name: 'o1',
    provider: 'openai',
    contextWindow: 200000,
    maxOutput: 100000,
    supportsTools: true,
    supportsVision: true,
  },
  'o1-mini': {
    id: 'o1-mini',
    name: 'o1 Mini',
    provider: 'openai',
    contextWindow: 128000,
    maxOutput: 65536,
    supportsTools: true,
    supportsVision: false,
  },

  // Google Gemini
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    contextWindow: 1000000,
    maxOutput: 8192,
    supportsTools: true,
    supportsVision: true,
  },
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    contextWindow: 2000000,
    maxOutput: 8192,
    supportsTools: true,
    supportsVision: true,
  },
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    contextWindow: 1000000,
    maxOutput: 8192,
    supportsTools: true,
    supportsVision: true,
  },

  // DeepSeek
  'deepseek-chat': {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    contextWindow: 64000,
    maxOutput: 8192,
    supportsTools: true,
    supportsVision: false,
  },
  'deepseek-reasoner': {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    provider: 'deepseek',
    contextWindow: 64000,
    maxOutput: 8192,
    supportsTools: true,
    supportsVision: false,
  },

  // 智谱 GLM
  'glm-4-plus': {
    id: 'glm-4-plus',
    name: 'GLM-4 Plus',
    provider: 'glm',
    contextWindow: 128000,
    maxOutput: 4096,
    supportsTools: true,
    supportsVision: false,
  },
  'glm-4': {
    id: 'glm-4',
    name: 'GLM-4',
    provider: 'glm',
    contextWindow: 128000,
    maxOutput: 4096,
    supportsTools: true,
    supportsVision: false,
  },

  // Moonshot Kimi
  'moonshot-v1-128k': {
    id: 'moonshot-v1-128k',
    name: 'Moonshot v1 128K',
    provider: 'kimi',
    contextWindow: 128000,
    maxOutput: 4096,
    supportsTools: true,
    supportsVision: false,
  },
  'moonshot-v1-32k': {
    id: 'moonshot-v1-32k',
    name: 'Moonshot v1 32K',
    provider: 'kimi',
    contextWindow: 32000,
    maxOutput: 4096,
    supportsTools: true,
    supportsVision: false,
  },
  'openrouter/auto': {
    id: 'openrouter/auto',
    name: 'OpenRouter Auto',
    provider: 'openrouter',
    contextWindow: 128000,
    maxOutput: 8192,
    supportsTools: true,
    supportsVision: false,
  },

  // OpenCode Zen (免费网关)
  'gpt-5-nano': {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano (免费)',
    provider: 'opencode',
    contextWindow: 400000,
    maxOutput: 128000,
    supportsTools: true,
    supportsVision: true,
  },
  'big-pickle': {
    id: 'big-pickle',
    name: 'Big Pickle (免费)',
    provider: 'opencode',
    contextWindow: 200000,
    maxOutput: 128000,
    supportsTools: true,
    supportsVision: false,
  },
  'glm-4.7-free': {
    id: 'glm-4.7-free',
    name: 'GLM-4.7 Free (免费)',
    provider: 'opencode',
    contextWindow: 204800,
    maxOutput: 131072,
    supportsTools: true,
    supportsVision: false,
  },
  'grok-code': {
    id: 'grok-code',
    name: 'Grok Code (免费)',
    provider: 'opencode',
    contextWindow: 256000,
    maxOutput: 256000,
    supportsTools: true,
    supportsVision: false,
  },
  'giga-potato': {
    id: 'giga-potato',
    name: 'Giga Potato',
    provider: 'kilo',
    contextWindow: 256000,
    maxOutput: 32000,
    supportsTools: true,
    supportsVision: true,
  },
  'minimax-m2.1-free': {
    id: 'minimax-m2.1-free',
    name: 'MiniMax M2.1 (免费)',
    provider: 'opencode',
    contextWindow: 204800,
    maxOutput: 131072,
    supportsTools: false, // NOTE: This model returns empty tool arguments and doesn't properly support function calling
    supportsVision: false,
  },
};

/**
 * Get models for a specific provider
 */
export function getModelsForProvider(provider: ProviderType): ModelInfo[] {
  return MODEL_DEFINITIONS[provider] || [];
}

/**
 * Fetch and register models from Kilo AI
 */
export async function fetchAndRegisterKiloModels(): Promise<ModelInfo[]> {
  const config = PROVIDER_CONFIG.kilo;
  if (!config || !config.baseUrl) {
    console.warn('[Models] Kilo AI config or baseUrl missing');
    return [];
  }

  try {
    // 移除末尾的 /v1 或 /，以获取正确的 models 接口地址
    const url = `${config.baseUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '')}/models`;
    
    console.log('[Models] Fetching Kilo AI models:', url);
    
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    const data = await response.json();
    
    const remoteModels = data.data || [];

    if (remoteModels.length > 0) {
      const parsedModels = remoteModels.map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        provider: 'kilo',
        contextWindow: m.context_length || 256000,
        maxOutput: m.top_provider?.max_completion_tokens || 32000,
        supportsTools: (m.supported_parameters || []).includes('tools'),
        supportsVision: m.id === 'giga-potato' || (m.architecture?.input_modalities || []).includes('image'),
      }));
      
      // 更新响应式对象
      MODEL_DEFINITIONS.kilo = parsedModels;
      console.log('[Models] Successfully updated Kilo AI models:', parsedModels.length);
      return parsedModels;
    } else {
      console.warn('[Models] Kilo AI returned empty model list', data);
    }
  } catch (error) {
    console.error('[Models] Failed to fetch Kilo AI models:', error);
  }
  return [];
}

/**
 * Get model info by ID
 */
export function getModelInfo(modelId: string): ModelInfo | undefined {
  return MODELS[modelId];
}

/**
 * Provider display names and base URLs
 */
// Initialize MODEL_DEFINITIONS
(function initModelDefinitions() {
  const providers = ['anthropic', 'openai', 'google', 'deepseek', 'glm', 'kimi', 'opencode', 'openrouter', 'custom'];
  for (const p of providers) {
    MODEL_DEFINITIONS[p] = Object.values(MODELS).filter(m => m.provider === p);
  }
})();

// Re-export ProviderType from types
export type { ProviderType as ProviderTypeExport } from '../types';

import type { ProviderType } from '../types';

/**
 * Fetch models from a remote API endpoint
 * Supports both Anthropic and OpenAI compatible /v1/models endpoints
 */
export interface RemoteModelInfo {
  id: string;
  name: string;
  created?: number;
  owned_by?: string;
}

export async function fetchModelsFromEndpoint(
  baseUrl: string,
  apiKey?: string,
  providerType?: ProviderType
): Promise<RemoteModelInfo[]> {
  // Normalize base URL - remove trailing slash
  const normalizedUrl = baseUrl.replace(/\/$/, '');
  
  // Build models endpoint URL
  // Check if baseUrl already contains /v1 to avoid /v1/v1/models
  const hasV1 = /\/v1\/?$/.test(normalizedUrl);
  const modelsUrl = hasV1 ? `${normalizedUrl}/models` : `${normalizedUrl}/v1/models`;
  
  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (apiKey) {
    // Anthropic uses x-api-key, OpenAI uses Authorization Bearer
    if (providerType === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }
  
  try {
    let data: any;
    
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      console.warn(`[fetchModelsFromEndpoint] Failed to fetch models: ${response.status} ${response.statusText}`);
      return [];
    }
    data = await response.json();
    
    // Handle both Anthropic and OpenAI response formats
    // OpenAI format: { data: [{ id, created, owned_by }] }
    // Some endpoints return: { models: [...] }
    const modelList = data.data || data.models || [];
    
    return modelList.map((model: Record<string, unknown>) => ({
      id: String(model.id || ''),
      name: String(model.id || model.name || ''),
      created: typeof model.created === 'number' ? model.created : undefined,
      owned_by: typeof model.owned_by === 'string' ? model.owned_by : undefined,
    })).filter((m: RemoteModelInfo) => m.id);
    
  } catch (error) {
    console.warn('[fetchModelsFromEndpoint] Error fetching models:', error);
    return [];
  }
}

export const PROVIDER_CONFIG: Record<ProviderType, {
  name: string;
  baseUrl?: string;
}> = {
  anthropic: {
    name: 'Anthropic',
  },
  openai: {
    name: 'OpenAI',
  },
  google: {
    name: 'Google',
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
  },
  glm: {
    name: '智谱 AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  },
  kimi: {
    name: 'Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
  },
  opencode: {
    name: 'OpenCode Zen (免费)',
    baseUrl: 'https://opencode.ai/zen/v1',
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  kilo: {
    name: 'Kilo AI',
    baseUrl: 'https://api.kilo.ai/api/openrouter',
  },
  custom: {
    name: 'Custom',
  },
};
