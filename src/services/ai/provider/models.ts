/**
 * Rebebuca AI Service Layer - Model Definitions
 * Supported AI models and their configurations
 */

import type { ModelInfo } from '../types';

export type { ProviderType } from '../types';

/**
 * Model definitions grouped by provider type for easy access
 */
export const MODEL_DEFINITIONS: Record<string, ModelInfo[]> = {};

export const MODELS: Record<string, ModelInfo> = {
  // Anthropic Claude
  'claude-sonnet-4-20250514': {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
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
  'minimax-m2.1-free': {
    id: 'minimax-m2.1-free',
    name: 'MiniMax M2.1 (免费)',
    provider: 'opencode',
    contextWindow: 204800,
    maxOutput: 131072,
    supportsTools: true,
    supportsVision: false,
  },
};

/**
 * Get models for a specific provider
 */
export function getModelsForProvider(provider: ProviderType): ModelInfo[] {
  return Object.values(MODELS).filter(m => m.provider === provider);
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
  const providers = ['anthropic', 'openai', 'google', 'deepseek', 'glm', 'kimi', 'opencode', 'custom'];
  for (const p of providers) {
    MODEL_DEFINITIONS[p] = Object.values(MODELS).filter(m => m.provider === p);
  }
})();

// Re-export ProviderType from types
export type { ProviderType as ProviderTypeExport } from '../types';

import type { ProviderType } from '../types';

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
  custom: {
    name: 'Custom',
  },
};
