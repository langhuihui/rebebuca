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

import type { AIToolType, AIToolConfig } from '../stores/aiTools';

/**
 * AI Tool Launch Templates
 * 
 * These templates define how to launch each AI tool with appropriate
 * environment variables and configurations
 */

export interface AIToolLaunchConfig {
  // Base command to launch the tool
  command: string;
  
  // Command arguments (may include placeholders)
  args?: string[];
  
  // Environment variables to set (may include placeholders)
  env?: Record<string, string>;
  
  // Whether to use system terminal
  useSystemTerminal?: boolean;
}

/**
 * Get launch configuration for an AI tool
 * @param toolType - Type of AI tool
 * @param config - AI tool configuration
 * @param projectPath - Path to the project directory
 * @returns Launch configuration
 */
export function getAIToolLaunchConfig(
  toolType: AIToolType,
  config: AIToolConfig,
  projectPath?: string
): AIToolLaunchConfig {
  const { provider, apiKey, customEndpoint } = config;
  
  // Base configurations for each tool
  const baseConfigs: Record<AIToolType, AIToolLaunchConfig> = {
    'claude-code': {
      command: 'npx',
      args: ['@anthropic/claude-code'],
      useSystemTerminal: true,
    },
    'codex': {
      command: 'npx',
      args: ['openai-codex'],
      useSystemTerminal: true,
    },
    'gemini-cli': {
      command: 'npx',
      args: ['@google/gemini-cli'],
      useSystemTerminal: true,
    },
    'opencode': {
      command: 'npx',
      args: ['opencode'],
      useSystemTerminal: true,
    },
    'codebuddy': {
      command: 'npx',
      args: ['codebuddy'],
      useSystemTerminal: true,
    },
    'qoder-cli': {
      command: 'npx',
      args: ['qoder-cli'],
      useSystemTerminal: true,
    },
  };
  
  const launchConfig = { ...baseConfigs[toolType] };
  
  // Add project path if provided
  if (projectPath && launchConfig.args) {
    launchConfig.args.push(projectPath);
  }
  
  // Original mode - no custom configuration
  if (provider === 'original') {
    return launchConfig;
  }
  
  // Setup environment variables based on provider
  launchConfig.env = launchConfig.env || {};
  
  // For non-original modes, set API key and endpoint
  if (provider === 'custom' && customEndpoint) {
    launchConfig.env['API_ENDPOINT'] = customEndpoint;
  }
  
  if (apiKey) {
    // Set appropriate environment variable based on tool type
    switch (toolType) {
      case 'claude-code':
        launchConfig.env['ANTHROPIC_API_KEY'] = apiKey;
        break;
      case 'codex':
        launchConfig.env['OPENAI_API_KEY'] = apiKey;
        break;
      case 'gemini-cli':
        launchConfig.env['GEMINI_API_KEY'] = apiKey;
        break;
      case 'opencode':
      case 'codebuddy':
      case 'qoder-cli':
        launchConfig.env['API_KEY'] = apiKey;
        break;
    }
  }
  
  // For specific providers, set additional environment variables
  if (provider !== 'custom' && provider !== 'original') {
    // Map provider to their API base URLs
    const providerBaseUrls: Record<string, string> = {
      'glm': 'https://open.bigmodel.cn/api/paas/v4/',
      'kimi': 'https://api.moonshot.cn/v1',
      'doubao': 'https://ark.cn-beijing.volces.com/api/v3',
      'minimax': 'https://api.minimax.chat/v1',
      'deepseek': 'https://api.deepseek.com/v1',
    };
    
    if (providerBaseUrls[provider]) {
      launchConfig.env['API_BASE'] = providerBaseUrls[provider];
    }
  }
  
  return launchConfig;
}

/**
 * Get command with Python environment activation
 * @param command - Original command
 * @param pythonEnv - Python environment name (Conda/Anaconda)
 * @param platform - Platform ('windows', 'macos', 'linux') - should be detected from system
 * @returns Command with environment activation prepended
 */
export function wrapWithPythonEnv(command: string, pythonEnv: string, platform?: string): string {
  if (!platform) {
    console.warn('Platform not specified for Python environment wrapper, using generic approach');
    // Use generic conda/source activate that works on most systems
    return `conda activate ${pythonEnv} && ${command}`;
  }
  
  const isWindows = platform === 'windows';
  
  if (isWindows) {
    // On Windows, use conda activate
    return `conda activate ${pythonEnv} && ${command}`;
  } else {
    // On Unix-like systems
    return `source activate ${pythonEnv} && ${command}`;
  }
}

/**
 * Create a quick launch task for an AI tool
 * @param toolType - Type of AI tool
 * @param config - AI tool configuration
 * @param projectPath - Optional project path
 * @returns Task name and command
 */
export function createAIToolQuickLaunchTask(
  toolType: AIToolType,
  config: AIToolConfig,
  projectPath?: string
): { name: string; command: string; env?: Record<string, string>; useSystemTerminal: boolean } {
  const launchConfig = getAIToolLaunchConfig(toolType, config, projectPath);
  
  // Build command string
  let command = launchConfig.command;
  if (launchConfig.args && launchConfig.args.length > 0) {
    command += ' ' + launchConfig.args.join(' ');
  }
  
  // Tool display names
  const toolNames: Record<AIToolType, string> = {
    'claude-code': 'Claude Code',
    'codex': 'OpenAI Codex',
    'gemini-cli': 'Gemini CLI',
    'opencode': 'OpenCode',
    'codebuddy': 'CodeBuddy',
    'qoder-cli': 'Qoder CLI',
  };
  
  return {
    name: `Launch ${toolNames[toolType]}`,
    command,
    env: launchConfig.env,
    useSystemTerminal: launchConfig.useSystemTerminal || false,
  };
}
