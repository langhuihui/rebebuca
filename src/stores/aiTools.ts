/**
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getAdapter, type BackendAdapter } from '../adapters';

// AI Tool types supported
/**
 * Supported AI CLI programming tools
 * - claude-code: Anthropic's Claude Code CLI
 * - codex: OpenAI's Codex CLI tool
 * - gemini-cli: Google's Gemini CLI
 * - opencode: OpenCode AI assistant
 * - codebuddy: CodeBuddy programming assistant
 * - qoder-cli: Qoder CLI programming assistant
 */
export type AIToolType = 'claude-code' | 'codex' | 'gemini-cli' | 'opencode' | 'codebuddy' | 'qoder-cli';

// Provider presets
export interface ProviderPreset {
  id: string;
  name: string;
  apiEndpoint?: string;
  getKeyUrl?: string;
  supportsTools: AIToolType[];
}

// Built-in provider presets
export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  original: {
    id: 'original',
    name: 'Original',
    supportsTools: ['claude-code', 'codex', 'gemini-cli', 'opencode', 'codebuddy', 'qoder-cli'],
  },
  glm: {
    id: 'glm',
    name: 'GLM (智谱AI)',
    getKeyUrl: 'https://open.bigmodel.cn/',
    supportsTools: ['claude-code', 'codex', 'gemini-cli'],
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi (月之暗面)',
    getKeyUrl: 'https://platform.moonshot.cn/',
    supportsTools: ['claude-code', 'codex', 'gemini-cli'],
  },
  doubao: {
    id: 'doubao',
    name: 'Doubao (豆包)',
    getKeyUrl: 'https://console.volcengine.com/',
    supportsTools: ['claude-code', 'codex', 'gemini-cli'],
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    getKeyUrl: 'https://www.minimaxi.com/',
    supportsTools: ['claude-code', 'codex', 'gemini-cli'],
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    getKeyUrl: 'https://platform.deepseek.com/',
    supportsTools: ['claude-code', 'codex', 'gemini-cli'],
  },
  aigocode: {
    id: 'aigocode',
    name: 'AIgoCode',
    supportsTools: ['claude-code', 'codex', 'gemini-cli'],
  },
  aicodemirror: {
    id: 'aicodemirror',
    name: 'AiCodeMirror',
    supportsTools: ['claude-code', 'codex', 'gemini-cli'],
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    supportsTools: ['claude-code', 'codex', 'gemini-cli', 'opencode', 'codebuddy', 'qoder-cli'],
  },
};

// AI Tool configuration
export interface AIToolConfig {
  toolType: AIToolType;
  provider: string; // Provider ID
  apiKey?: string;
  customEndpoint?: string;
  enabled: boolean;
}

// Provider API Key storage (for syncing across tools)
export interface ProviderKeys {
  [providerId: string]: string;
}

export const useAIToolsStore = defineStore('aiTools', () => {
  // AI tool configurations
  const toolConfigs = ref<Record<AIToolType, AIToolConfig>>({
    'claude-code': {
      toolType: 'claude-code',
      provider: 'original',
      enabled: false,
    },
    'codex': {
      toolType: 'codex',
      provider: 'original',
      enabled: false,
    },
    'gemini-cli': {
      toolType: 'gemini-cli',
      provider: 'original',
      enabled: false,
    },
    'opencode': {
      toolType: 'opencode',
      provider: 'original',
      enabled: false,
    },
    'codebuddy': {
      toolType: 'codebuddy',
      provider: 'original',
      enabled: false,
    },
    'qoder-cli': {
      toolType: 'qoder-cli',
      provider: 'original',
      enabled: false,
    },
  });

  // Provider API keys (shared across tools)
  const providerKeys = ref<ProviderKeys>({});

  // Adapter instance
  let adapter: BackendAdapter | null = null;

  // Initialize storage
  const initStorage = async () => {
    if (!adapter) {
      adapter = await getAdapter();
    }
    return adapter.storage;
  };

  // Load configurations from storage
  const loadConfigurations = async () => {
    try {
      const storage = await initStorage();
      if (!storage) return;

      const savedConfigs = await storage.get<Record<AIToolType, AIToolConfig>>('ai_tool_configs');
      if (savedConfigs) {
        toolConfigs.value = savedConfigs;
      }

      const savedKeys = await storage.get<ProviderKeys>('provider_keys');
      if (savedKeys) {
        providerKeys.value = savedKeys;
      }
    } catch (error) {
      console.error('Failed to load AI tool configurations from storage. Settings will use defaults:', error);
    }
  };

  // Save configurations to storage
  const saveConfigurations = async () => {
    try {
      const storage = await initStorage();
      if (!storage) return;

      await storage.set('ai_tool_configs', toolConfigs.value);
      await storage.set('provider_keys', providerKeys.value);
      await storage.save();
    } catch (error) {
      console.error('Failed to save AI tool configurations to storage. Your changes may not persist:', error);
      throw error; // Re-throw to allow caller to handle
    }
  };

  // Update tool configuration
  const updateToolConfig = async (toolType: AIToolType, config: Partial<AIToolConfig>) => {
    toolConfigs.value[toolType] = {
      ...toolConfigs.value[toolType],
      ...config,
    };
    await saveConfigurations();
  };

  // Set provider API key (syncs to tool configs that use this provider)
  const setProviderKey = async (providerId: string, apiKey: string) => {
    providerKeys.value[providerId] = apiKey;

    // Sync to all tools using this provider
    for (const [toolType, config] of Object.entries(toolConfigs.value)) {
      if (config.provider === providerId) {
        toolConfigs.value[toolType as AIToolType].apiKey = apiKey;
      }
    }

    await saveConfigurations();
  };

  // Get provider key
  const getProviderKey = (providerId: string): string | undefined => {
    return providerKeys.value[providerId];
  };

  // Change tool provider (syncs API key if available)
  const changeToolProvider = async (toolType: AIToolType, providerId: string) => {
    const existingKey = providerKeys.value[providerId];
    
    await updateToolConfig(toolType, {
      provider: providerId,
      apiKey: existingKey,
    });
  };

  // Get available providers for a tool
  const getProvidersForTool = (toolType: AIToolType): ProviderPreset[] => {
    return Object.values(PROVIDER_PRESETS).filter(preset =>
      preset.supportsTools.includes(toolType)
    );
  };

  // Get tool display name
  const getToolDisplayName = (toolType: AIToolType): string => {
    const names: Record<AIToolType, string> = {
      'claude-code': 'Claude Code',
      'codex': 'OpenAI Codex',
      'gemini-cli': 'Google Gemini CLI',
      'opencode': 'OpenCode',
      'codebuddy': 'CodeBuddy',
      'qoder-cli': 'Qoder CLI',
    };
    return names[toolType];
  };

  return {
    toolConfigs,
    providerKeys,
    loadConfigurations,
    saveConfigurations,
    updateToolConfig,
    setProviderKey,
    getProviderKey,
    changeToolProvider,
    getProvidersForTool,
    getToolDisplayName,
  };
});
