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
    <n-alert type="info" :bordered="false" style="margin-bottom: 16px;">
      {{ t('aiTools.description') }}
    </n-alert>

    <n-space vertical :size="24">
      <!-- AI Tool Configuration Cards -->
      <div v-for="toolType in availableTools" :key="toolType" class="tool-card">
        <n-card :title="aiToolsStore.getToolDisplayName(toolType)" size="small">
          <template #header-extra>
            <n-switch
              v-model:value="aiToolsStore.toolConfigs[toolType].enabled"
              @update:value="() => aiToolsStore.saveConfigurations()"
            />
          </template>

          <n-space vertical :size="12" v-if="aiToolsStore.toolConfigs[toolType].enabled">
            <!-- Provider Selection -->
            <n-form-item :label="t('aiTools.provider')">
              <n-select
                v-model:value="aiToolsStore.toolConfigs[toolType].provider"
                :options="getProviderOptions(toolType)"
                @update:value="(value) => handleProviderChange(toolType, value)"
              />
            </n-form-item>

            <!-- API Key Input (not for 'original' mode) -->
            <n-form-item 
              v-if="aiToolsStore.toolConfigs[toolType].provider !== 'original'"
              :label="t('aiTools.apiKey')"
            >
              <n-input-group>
                <n-input
                  v-model:value="localApiKeys[toolType]"
                  type="password"
                  :placeholder="t('aiTools.apiKeyPlaceholder')"
                  show-password-on="click"
                  @blur="() => handleApiKeyBlur(toolType)"
                />
                <n-button
                  v-if="getKeyUrl(toolType)"
                  @click="openGetKeyUrl(toolType)"
                  :title="t('aiTools.getKey')"
                >
                  {{ t('aiTools.getKey') }}
                </n-button>
              </n-input-group>
            </n-form-item>

            <!-- Custom Endpoint (for 'custom' provider) -->
            <n-form-item
              v-if="aiToolsStore.toolConfigs[toolType].provider === 'custom'"
              :label="t('aiTools.customEndpoint')"
            >
              <n-input
                v-model:value="aiToolsStore.toolConfigs[toolType].customEndpoint"
                :placeholder="t('aiTools.customEndpointPlaceholder')"
                @blur="() => aiToolsStore.saveConfigurations()"
              />
            </n-form-item>

            <!-- Original Mode Notice -->
            <n-alert
              v-if="aiToolsStore.toolConfigs[toolType].provider === 'original'"
              type="info"
              :bordered="false"
              size="small"
            >
              {{ t('aiTools.originalModeNotice') }}
            </n-alert>
          </n-space>
        </n-card>
      </div>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NSpace,
  NCard,
  NSwitch,
  NFormItem,
  NSelect,
  NInput,
  NInputGroup,
  NButton,
  NAlert,
} from 'naive-ui';
import { useAIToolsStore, PROVIDER_PRESETS, type AIToolType } from '../../stores/aiTools';
import { isTauri } from '../../adapters';

const { t } = useI18n();
const aiToolsStore = useAIToolsStore();

// Available AI tools
const availableTools: AIToolType[] = [
  'claude-code',
  'codex',
  'gemini-cli',
  'opencode',
  'codebuddy',
  'qoder-cli',
];

// Local API key values (for editing before saving)
const localApiKeys = ref<Record<string, string>>({});

onMounted(async () => {
  await aiToolsStore.loadConfigurations();
  
  // Initialize local API keys
  for (const toolType of availableTools) {
    localApiKeys.value[toolType] = aiToolsStore.toolConfigs[toolType].apiKey || '';
  }
});

// Get provider options for a specific tool
const getProviderOptions = (toolType: AIToolType) => {
  return aiToolsStore.getProvidersForTool(toolType).map(preset => ({
    label: preset.name,
    value: preset.id,
  }));
};

// Handle provider change
const handleProviderChange = async (toolType: AIToolType, providerId: string) => {
  await aiToolsStore.changeToolProvider(toolType, providerId);
  
  // Update local API key
  localApiKeys.value[toolType] = aiToolsStore.toolConfigs[toolType].apiKey || '';
};

// Handle API key blur (save)
const handleApiKeyBlur = async (toolType: AIToolType) => {
  const apiKey = localApiKeys.value[toolType];
  const config = aiToolsStore.toolConfigs[toolType];
  
  if (apiKey !== config.apiKey) {
    // Update provider key (will sync to other tools)
    await aiToolsStore.setProviderKey(config.provider, apiKey);
    
    // Update local keys for all tools using this provider
    for (const tt of availableTools) {
      if (aiToolsStore.toolConfigs[tt].provider === config.provider) {
        localApiKeys.value[tt] = apiKey;
      }
    }
  }
};

// Get "Get Key" URL for current provider
const getKeyUrl = (toolType: AIToolType): string | undefined => {
  const config = aiToolsStore.toolConfigs[toolType];
  const preset = PROVIDER_PRESETS[config.provider];
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

.tool-card {
  width: 100%;
}
</style>
