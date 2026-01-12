/**
 * Rebebuca AI Service Layer - Provider Manager
 * Unified interface for multiple AI providers
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { ProviderConfig, ProviderType } from '../types';
import { PROVIDER_CONFIG } from './models';

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

    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}

/**
 * Validate API key format (basic check)
 */
export function validateApiKey(type: ProviderType, apiKey: string): boolean {
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
