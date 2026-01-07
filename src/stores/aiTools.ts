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
 * - copilot-cli: GitHub Copilot CLI
 * - droid: Droid AI assistant
 * - augment-cli: Augment Code CLI (Auggie)
 * - cursor-cli: Cursor CLI (cursor-agent)
 */
export type AIToolType = 'claude-code' | 'codex' | 'gemini-cli' | 'opencode' | 'codebuddy' | 'qoder-cli' | 'copilot-cli' | 'droid' | 'augment-cli' | 'cursor-cli';

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
    supportsTools: ['claude-code', 'codex', 'gemini-cli', 'opencode', 'codebuddy', 'qoder-cli', 'copilot-cli', 'droid', 'augment-cli', 'cursor-cli'],
  },
  glm: {
    id: 'glm',
    name: 'GLM (智谱AI)',
    getKeyUrl: 'https://open.bigmodel.cn/',
    supportsTools: ['claude-code', 'codex', 'gemini-cli', 'copilot-cli', 'droid'],
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi (月之暗面)',
    getKeyUrl: 'https://platform.moonshot.cn/',
    supportsTools: ['claude-code', 'codex', 'gemini-cli', 'copilot-cli', 'droid'],
  },
  doubao: {
    id: 'doubao',
    name: 'Doubao (豆包)',
    getKeyUrl: 'https://console.volcengine.com/',
    supportsTools: ['claude-code', 'codex', 'gemini-cli', 'copilot-cli', 'droid'],
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    getKeyUrl: 'https://www.minimaxi.com/',
    supportsTools: ['claude-code', 'codex', 'gemini-cli', 'copilot-cli', 'droid'],
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    getKeyUrl: 'https://platform.deepseek.com/',
    supportsTools: ['claude-code', 'codex', 'gemini-cli', 'copilot-cli', 'droid'],
  },
  aigocode: {
    id: 'aigocode',
    name: 'AIgoCode',
    supportsTools: ['claude-code', 'codex', 'gemini-cli', 'copilot-cli', 'droid'],
  },
  aicodemirror: {
    id: 'aicodemirror',
    name: 'AiCodeMirror',
    supportsTools: ['claude-code', 'codex', 'gemini-cli', 'copilot-cli', 'droid'],
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    supportsTools: ['claude-code', 'codex', 'gemini-cli', 'opencode', 'codebuddy', 'qoder-cli', 'copilot-cli', 'droid', 'augment-cli'],
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

// AI Tool installation info
export interface AIToolInstallInfo {
  name: string;
  website: string;
  installMethods: {
    id: string;
    name: string;
    command: string;
    platform?: 'macos' | 'linux' | 'windows' | 'all';
  }[];
  versionCommand: string;
  launchCommand: string;
}

// AI Tool metadata with installation info
export const AI_TOOL_METADATA: Record<AIToolType, AIToolInstallInfo> = {
  'claude-code': {
    name: 'Claude Code',
    website: 'https://github.com/anthropics/claude-code',
    installMethods: [
      { id: 'npm', name: 'NPM', command: 'npm install -g @anthropic-ai/claude-code', platform: 'all' },
    ],
    versionCommand: 'claude --version',
    launchCommand: 'claude',
  },
  'codex': {
    name: 'OpenAI Codex',
    website: 'https://github.com/openai/codex',
    installMethods: [
      { id: 'npm', name: 'NPM', command: 'npm install -g @openai/codex', platform: 'all' },
    ],
    versionCommand: 'codex --version',
    launchCommand: 'codex',
  },
  'gemini-cli': {
    name: 'Google Gemini CLI',
    website: 'https://github.com/google-gemini/gemini-cli',
    installMethods: [
      { id: 'npm', name: 'NPM', command: 'npm install -g @google/gemini-cli', platform: 'all' },
    ],
    versionCommand: 'gemini --version',
    launchCommand: 'gemini',
  },
  'opencode': {
    name: 'OpenCode',
    website: 'https://github.com/opencode-ai/opencode',
    installMethods: [
      { id: 'npm', name: 'NPM', command: 'npm install -g opencode', platform: 'all' },
    ],
    versionCommand: 'opencode --version',
    launchCommand: 'opencode',
  },
  'codebuddy': {
    name: 'CodeBuddy',
    website: 'https://copilot.tencent.com/docs/cli/installation',
    installMethods: [
      { id: 'npm', name: 'NPM', command: 'npm install -g @tencent-ai/codebuddy-code', platform: 'all' },
      { id: 'brew', name: 'Homebrew', command: 'brew tap Tencent-CodeBuddy/tap && brew install codebuddy-code', platform: 'macos' },
      { id: 'brew-linux', name: 'Homebrew', command: 'brew tap Tencent-CodeBuddy/tap && brew install codebuddy-code', platform: 'linux' },
      { id: 'script', name: 'Install Script', command: 'curl -fsSL https://copilot.tencent.com/cli/install.sh | bash', platform: 'macos' },
      { id: 'script-linux', name: 'Install Script', command: 'curl -fsSL https://copilot.tencent.com/cli/install.sh | bash', platform: 'linux' },
    ],
    versionCommand: 'codebuddy --version',
    launchCommand: 'codebuddy',
  },
  'qoder-cli': {
    name: 'Qoder CLI',
    website: 'https://github.com/qodo-ai/qoder',
    installMethods: [
      { id: 'npm', name: 'NPM', command: 'npm install -g qoder-cli', platform: 'all' },
    ],
    versionCommand: 'qoder --version',
    launchCommand: 'qoder',
  },
  'copilot-cli': {
    name: 'GitHub Copilot CLI',
    website: 'https://github.com/github/copilot-cli',
    installMethods: [
      { id: 'npm', name: 'NPM', command: 'npm install -g @github/copilot', platform: 'all' },
      { id: 'brew', name: 'Homebrew', command: 'brew install copilot-cli', platform: 'macos' },
      { id: 'winget', name: 'WinGet', command: 'winget install GitHub.Copilot', platform: 'windows' },
      { id: 'script', name: 'Install Script', command: 'curl -fsSL https://gh.io/copilot-install | bash', platform: 'macos' },
    ],
    versionCommand: 'copilot --version',
    launchCommand: 'copilot',
  },
  'droid': {
    name: 'Droid (Factory AI)',
    website: 'https://factory.ai/product/cli',
    installMethods: [
      { id: 'script-mac', name: 'Install Script (macOS/Linux)', command: 'curl -fsSL https://app.factory.ai/cli | sh', platform: 'macos' },
      { id: 'script-linux', name: 'Install Script (Linux)', command: 'curl -fsSL https://app.factory.ai/cli | sh', platform: 'linux' },
    ],
    versionCommand: 'droid --version',
    launchCommand: 'droid',
  },
  'augment-cli': {
    name: 'Augment CLI (Auggie)',
    website: 'https://www.augmentcode.com/product/CLI',
    installMethods: [
      { id: 'npm', name: 'NPM', command: 'npm install -g @augmentcode/auggie', platform: 'all' },
    ],
    versionCommand: 'auggie --version',
    launchCommand: 'auggie',
  },
  'cursor-cli': {
    name: 'Cursor CLI',
    website: 'https://cursor.com/cn/cli',
    installMethods: [
      { id: 'script-macos', name: 'Install Script', command: 'curl https://cursor.com/install -fsS | bash', platform: 'macos' },
      { id: 'script-linux', name: 'Install Script', command: 'curl https://cursor.com/install -fsS | bash', platform: 'linux' },
      { id: 'website-win', name: 'Website', command: 'echo "Please visit https://cursor.com/cn/cli"', platform: 'windows' },
    ],
    versionCommand: 'cursor-agent --version',
    launchCommand: 'cursor-agent',
  },
};

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
    'copilot-cli': {
      toolType: 'copilot-cli',
      provider: 'original',
      enabled: false,
    },
    'droid': {
      toolType: 'droid',
      provider: 'original',
      enabled: false,
    },
    'augment-cli': {
      toolType: 'augment-cli',
      provider: 'original',
      enabled: false,
    },
    'cursor-cli': {
      toolType: 'cursor-cli',
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
      'copilot-cli': 'GitHub Copilot CLI',
      'droid': 'Droid',
      'augment-cli': 'Augment CLI (Auggie)',
      'cursor-cli': 'Cursor CLI',
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
