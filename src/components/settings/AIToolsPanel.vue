<!--
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
 -->

<template>
  <div class="ai-tools-panel">
    <!-- AI Tools Tabs - Vertical Layout -->
    <div class="ai-tools-layout">
      <n-tabs 
        v-model:value="activeToolTab" 
        type="line" 
        size="small"
        placement="left"
        :tabs-padding="12"
        style="min-height: 400px;"
      >
        <n-tab-pane 
          v-for="toolType in availableTools" 
          :key="toolType"
          :name="toolType"
          :tab="AI_TOOL_METADATA[toolType].name"
        >
          <div class="tool-panel">
            <!-- Tool Header -->
            <div class="tool-header-section">
              <div class="tool-status">
                <n-spin v-if="checkingInstall[toolType]" :size="14" />
                <n-tag v-else-if="toolVersions[toolType]" type="success" size="small">
                  v{{ toolVersions[toolType] }}
                </n-tag>
                <n-tag v-else type="warning" size="small">
                  {{ t('aiTools.notInstalled') }}
                </n-tag>
                <n-button 
                  text 
                  size="tiny"
                  @click="checkSingleTool(toolType)"
                  :loading="checkingInstall[toolType]"
                  :title="t('aiTools.recheckInstall')"
                >
                  <template #icon>
                    <n-icon size="14">
                      <component :is="svgIcons.refresh" />
                    </n-icon>
                  </template>
                </n-button>
              </div>
            </div>

            <!-- Website Link -->
            <div class="tool-info">
              <span class="website-link" @click="openWebsite(toolType)">
                <n-icon size="12" style="margin-right: 4px; vertical-align: middle;">
                  <component :is="svgIcons.externalLink" />
                </n-icon>
                {{ AI_TOOL_METADATA[toolType].website }}
              </span>
            </div>

            <!-- Configuration Section -->
            <n-divider style="margin: 16px 0 12px 0;">
              {{ t('aiTools.configuration') }}
            </n-divider>
            
            <n-space vertical :size="12">
              <!-- Provider Selection -->
              <n-form-item :label="t('aiTools.provider')" :show-feedback="false" label-placement="left" label-width="100">
                <n-select
                  v-model:value="toolConfigsLocal[toolType].provider"
                  :options="getProviderOptions(toolType)"
                  size="small"
                  style="width: 200px;"
                  @update:value="saveToolConfig(toolType)"
                />
              </n-form-item>

              <!-- API Key Input (not for 'original' mode) -->
              <n-form-item 
                v-if="toolConfigsLocal[toolType].provider !== 'original'"
                :label="t('aiTools.apiKey')"
                :show-feedback="false"
                label-placement="left"
                label-width="100"
              >
                <n-input-group>
                  <n-input
                    v-model:value="toolConfigsLocal[toolType].apiKey"
                    type="password"
                    :placeholder="t('aiTools.apiKeyPlaceholder')"
                    show-password-on="click"
                    size="small"
                    style="width: 200px;"
                    @blur="saveToolConfig(toolType)"
                  />
                  <n-button
                    v-if="getKeyUrl(toolType)"
                    size="small"
                    @click="openGetKeyUrl(toolType)"
                  >
                    {{ t('aiTools.getKey') }}
                  </n-button>
                </n-input-group>
              </n-form-item>

              <!-- Custom Endpoint (for 'custom' provider) -->
              <n-form-item
                v-if="toolConfigsLocal[toolType].provider === 'custom'"
                :label="t('aiTools.customEndpoint')"
                :show-feedback="false"
                label-placement="left"
                label-width="100"
              >
                <n-input
                  v-model:value="toolConfigsLocal[toolType].customEndpoint"
                  :placeholder="t('aiTools.customEndpointPlaceholder')"
                  size="small"
                  style="width: 280px;"
                  @blur="saveToolConfig(toolType)"
                />
              </n-form-item>

              <!-- Original Mode Notice -->
              <n-alert
                v-if="toolConfigsLocal[toolType].provider === 'original'"
                type="info"
                :bordered="false"
                size="small"
              >
                {{ t('aiTools.originalModeNotice') }}
              </n-alert>

              <!-- Key Sync Notice -->
              <n-alert
                v-if="toolConfigsLocal[toolType].provider !== 'original'"
                type="default"
                :bordered="false"
                size="small"
              >
                {{ t('aiTools.keySyncNotice') }}
              </n-alert>
            </n-space>

            <!-- Installation Section (when not installed) -->
            <div v-if="!toolVersions[toolType]" class="install-section">
              <n-divider style="margin: 16px 0 12px 0;">
                {{ t('aiTools.installOptions') }}
              </n-divider>
              
              <!-- Install Methods Tabs -->
              <n-tabs 
                v-if="getAvailableInstallMethods(toolType).length > 1"
                v-model:value="selectedInstallMethod[toolType]"
                type="line"
                size="small"
                style="margin-bottom: 12px;"
              >
                <n-tab-pane
                  v-for="method in getAvailableInstallMethods(toolType)"
                  :key="method.id"
                  :name="method.id"
                  :tab="method.name"
                >
                  <div class="install-command">
                    <n-input-group>
                      <n-input
                        :value="method.command"
                        readonly
                        size="small"
                        style="font-family: monospace; font-size: 12px;"
                      />
                      <n-button size="small" @click="copyCommand(method.command)">
                        <template #icon>
                          <n-icon size="14">
                            <component :is="svgIcons.copy" />
                          </n-icon>
                        </template>
                      </n-button>
                      <n-button 
                        size="small" 
                        type="primary"
                        @click="runInstallCommand(toolType, method)"
                      >
                        {{ t('aiTools.install') }}
                      </n-button>
                    </n-input-group>
                  </div>
                </n-tab-pane>
              </n-tabs>

              <!-- Single Install Method (no tabs needed) -->
              <div v-else class="install-command">
                <div 
                  v-for="method in getAvailableInstallMethods(toolType)" 
                  :key="method.id"
                >
                  <div class="method-label">{{ method.name }}</div>
                  <n-input-group>
                    <n-input
                      :value="method.command"
                      readonly
                      size="small"
                      style="font-family: monospace; font-size: 12px;"
                    />
                    <n-button size="small" @click="copyCommand(method.command)">
                      <template #icon>
                        <n-icon size="14">
                          <component :is="svgIcons.copy" />
                        </n-icon>
                      </template>
                    </n-button>
                    <n-button 
                      size="small" 
                      type="primary"
                      @click="runInstallCommand(toolType, method)"
                    >
                      {{ t('aiTools.install') }}
                    </n-button>
                  </n-input-group>
                </div>
              </div>
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NSpace,
  NTabs,
  NTabPane,
  NTag,
  NButton,
  NIcon,
  NAlert,
  NInput,
  NInputGroup,
  NFormItem,
  NSelect,
  NDivider,
  NSpin,
  useMessage,
  useDialog,
} from 'naive-ui';
import { useAIToolsStore, AI_TOOL_METADATA, PROVIDER_PRESETS, type AIToolType, type AIToolConfig } from '../../stores/aiTools';
import { isTauri } from '../../adapters';
import { svgIcons } from '../../utils/icons';

const { t } = useI18n();
const message = useMessage();
const dialog = useDialog();
const aiToolsStore = useAIToolsStore();

// Available AI tools
const availableTools: AIToolType[] = [
  'claude-code',
  'codex',
  'gemini-cli',
  'opencode',
  'codebuddy',
  'qoder-cli',
  'copilot-cli',
  'droid',
  'augment-cli',
];

// Active tool tab
const activeToolTab = ref<AIToolType>('claude-code');

// Selected install method for each tool
const selectedInstallMethod = ref<Record<string, string>>({});

// Tool versions (empty string means not installed)
const toolVersions = ref<Record<string, string>>({});

// Install check state
const checkingInstall = ref<Record<string, boolean>>({});

// Local tool configs for inline editing - initialize with defaults
const toolConfigsLocal = reactive<Record<AIToolType, Partial<AIToolConfig>>>({
  'claude-code': { provider: 'original', apiKey: '', customEndpoint: '' },
  'codex': { provider: 'original', apiKey: '', customEndpoint: '' },
  'gemini-cli': { provider: 'original', apiKey: '', customEndpoint: '' },
  'opencode': { provider: 'original', apiKey: '', customEndpoint: '' },
  'codebuddy': { provider: 'original', apiKey: '', customEndpoint: '' },
  'qoder-cli': { provider: 'original', apiKey: '', customEndpoint: '' },
  'copilot-cli': { provider: 'original', apiKey: '', customEndpoint: '' },
  'droid': { provider: 'original', apiKey: '', customEndpoint: '' },
  'augment-cli': { provider: 'original', apiKey: '', customEndpoint: '' },
});

// Current platform
const currentPlatform = ref<'macos' | 'linux' | 'windows'>('macos');

onMounted(async () => {
  await aiToolsStore.loadConfigurations();
  initLocalConfigs();
  await detectPlatform();
  await checkInstalledTools();
  initSelectedInstallMethods();
});

// Watch for store changes and sync to local
watch(() => aiToolsStore.toolConfigs, () => {
  initLocalConfigs();
}, { deep: true });

// Watch for tab changes and auto-check installation status
watch(activeToolTab, (newTool) => {
  // Auto-check if not already checked or checking
  if (!toolVersions.value[newTool] && !checkingInstall.value[newTool]) {
    checkSingleTool(newTool);
  }
});

// Initialize local configs from store
const initLocalConfigs = () => {
  for (const toolType of availableTools) {
    const config = aiToolsStore.toolConfigs[toolType];
    // Handle case where config might be undefined (e.g., older stored data)
    if (config) {
      toolConfigsLocal[toolType] = {
        provider: config.provider || 'original',
        apiKey: config.apiKey || '',
        customEndpoint: config.customEndpoint || '',
      };
    } else {
      // Use default values if config is undefined
      toolConfigsLocal[toolType] = {
        provider: 'original',
        apiKey: '',
        customEndpoint: '',
      };
    }
  }
};

// Initialize selected install methods
const initSelectedInstallMethods = () => {
  for (const toolType of availableTools) {
    const methods = getAvailableInstallMethods(toolType);
    if (methods.length > 0) {
      selectedInstallMethod.value[toolType] = methods[0].id;
    }
  }
};

// Detect current platform
const detectPlatform = async () => {
  if (isTauri()) {
    try {
      const os = await import('@tauri-apps/plugin-os');
      const platform = os.platform();
      if (platform === 'macos') {
        currentPlatform.value = 'macos';
      } else if (platform === 'windows') {
        currentPlatform.value = 'windows';
      } else {
        currentPlatform.value = 'linux';
      }
    } catch {
      currentPlatform.value = 'macos';
    }
  } else {
    // Web mode - detect from user agent
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) {
      currentPlatform.value = 'windows';
    } else if (ua.includes('mac')) {
      currentPlatform.value = 'macos';
    } else {
      currentPlatform.value = 'linux';
    }
  }
};

// Get install methods available for current platform
const getAvailableInstallMethods = (toolType: AIToolType) => {
  const methods = AI_TOOL_METADATA[toolType].installMethods;
  return methods.filter(m => m.platform === 'all' || m.platform === currentPlatform.value);
};

// Check which tools are installed
const checkInstalledTools = async () => {
  if (!isTauri()) return;
  
  // Check all tools in parallel
  const checkPromises = availableTools.map(toolType => checkSingleTool(toolType));
  await Promise.allSettled(checkPromises);
};

// Check if a single tool is installed
const checkSingleTool = async (toolType: AIToolType) => {
  if (!isTauri()) return;
  
  checkingInstall.value[toolType] = true;
  
  try {
    const metadata = AI_TOOL_METADATA[toolType];
    const shell = await import('@tauri-apps/plugin-shell');
    
    // Use login shell to get proper PATH including user-installed tools
    // This ensures tools installed in ~/.local/bin, ~/.opencode/bin etc are found
    const launchCmd = metadata.launchCommand;
    const whichCommand = shell.Command.create('exec-zsh', ['-c', `source ~/.zshrc 2>/dev/null; which ${launchCmd} || command -v ${launchCmd}`]);
    const whichOutput = await whichCommand.execute();
    
    if (whichOutput.code !== 0 || !whichOutput.stdout.trim()) {
      // Command not found in PATH
      toolVersions.value[toolType] = '';
      return;
    }
    
    // Command exists, now try to get version
    const command = shell.Command.create('exec-zsh', ['-c', `source ~/.zshrc 2>/dev/null; ${metadata.versionCommand}`]);
    const output = await command.execute();
    
    if (output.code === 0) {
      const outputText = output.stdout || output.stderr || '';
      // Extract version number from output (handles various formats)
      const versionMatch = outputText.match(/v?(\d+\.\d+\.?\d*(?:-[\w.]+)?)/i);
      if (versionMatch) {
        toolVersions.value[toolType] = versionMatch[1];
      } else {
        // Tool is installed but version format is unknown
        toolVersions.value[toolType] = 'installed';
      }
    } else {
      // Version command failed but tool might still be installed
      toolVersions.value[toolType] = '';
    }
  } catch (error) {
    // Tool not installed or command failed
    console.error(`Failed to check ${toolType}:`, error);
    toolVersions.value[toolType] = '';
  } finally {
    checkingInstall.value[toolType] = false;
  }
};

// Open website
const openWebsite = async (toolType: AIToolType) => {
  const url = AI_TOOL_METADATA[toolType].website;
  if (isTauri()) {
    const opener = await import('@tauri-apps/plugin-opener');
    await opener.openUrl(url);
  } else {
    window.open(url, '_blank');
  }
};

// Copy command to clipboard
const copyCommand = async (command: string) => {
  try {
    await navigator.clipboard.writeText(command);
    message.success(t('common.copied'));
  } catch {
    message.error(t('common.copyFailed'));
  }
};

// Run install command
const runInstallCommand = async (toolType: AIToolType, method: { command: string }) => {
  if (!isTauri()) {
    message.info(t('aiTools.copyAndRunManually'));
    await copyCommand(method.command);
    return;
  }

  let installCommand = method.command;
  
  // Helper function to execute the install command
  const executeInstallCommand = async () => {
    try {
      const shell = await import('@tauri-apps/plugin-shell');
      const command = shell.Command.create('exec-sh', ['-c', installCommand]);
      
      message.loading(t('aiTools.installing'));
      const output = await command.execute();
      
      if (output.code === 0) {
        message.success(t('aiTools.installSuccess'));
        // Recheck the specific tool's installation status
        await checkSingleTool(toolType);
      } else {
        message.error(t('aiTools.installFailed') + ': ' + output.stderr);
      }
    } catch (error) {
      message.error(t('aiTools.installFailed'));
      console.error('Install failed:', error);
    }
  };
  
  // Check if we should ask for sudo (non-Windows platforms with global npm install)
  if (currentPlatform.value !== 'windows' && installCommand.includes('npm install -g')) {
    return new Promise<void>((resolve) => {
      dialog.warning({
        title: t('aiTools.sudoPromptTitle'),
        content: t('aiTools.sudoPromptMessage'),
        positiveText: t('aiTools.useSudo'),
        negativeText: t('aiTools.withoutSudo'),
        autoFocus: false,
        onPositiveClick: async () => {
          installCommand = `sudo ${installCommand}`;
          await executeInstallCommand();
          resolve();
        },
        onNegativeClick: async () => {
          await executeInstallCommand();
          resolve();
        },
        onClose: () => {
          resolve();
        },
      });
    });
  }
  
  await executeInstallCommand();
};

// Get provider options for a tool
const getProviderOptions = (toolType: AIToolType) => {
  return aiToolsStore.getProvidersForTool(toolType).map(preset => ({
    label: preset.name,
    value: preset.id,
  }));
};

// Save tool configuration (inline)
const saveToolConfig = async (toolType: AIToolType) => {
  const localConfig = toolConfigsLocal[toolType];
  
  await aiToolsStore.updateToolConfig(toolType, {
    provider: localConfig.provider,
    apiKey: localConfig.apiKey,
    customEndpoint: localConfig.customEndpoint,
    enabled: true, // Auto-enable when configured
  });
  
  // Sync API key to provider
  if (localConfig.provider !== 'original' && localConfig.apiKey) {
    await aiToolsStore.setProviderKey(localConfig.provider!, localConfig.apiKey);
  }
};

// Get "Get Key" URL for current provider
const getKeyUrl = (toolType: AIToolType): string | undefined => {
  const config = toolConfigsLocal[toolType];
  if (!config) return undefined;
  const preset = PROVIDER_PRESETS[config.provider!];
  return preset?.getKeyUrl;
};

// Open "Get Key" URL
const openGetKeyUrl = async (toolType: AIToolType) => {
  const url = getKeyUrl(toolType);
  if (url) {
    if (isTauri()) {
      const opener = await import('@tauri-apps/plugin-opener');
      await opener.openUrl(url);
    } else {
      window.open(url, '_blank');
    }
  }
};
</script>

<style scoped>
.ai-tools-panel {
  padding: 16px;
}

.ai-tools-layout {
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  overflow: hidden;
}

.ai-tools-layout :deep(.n-tabs-nav) {
  background-color: var(--n-color-modal);
  min-width: 160px;
}

.ai-tools-layout :deep(.n-tabs-pane-wrapper) {
  padding: 0;
}

.tool-panel {
  padding: 16px;
}

.tool-header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tool-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-info {
  margin-bottom: 8px;
}

.website-link {
  color: var(--n-text-color-3);
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}

.website-link:hover {
  color: var(--n-primary-color);
}

.install-section {
  margin-top: 8px;
}

.install-command {
  margin-top: 8px;
}

.method-label {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-bottom: 4px;
}

.installed-section {
  margin-top: 8px;
}
</style>
