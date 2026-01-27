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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 -->

<template>
  <div class="mcp-panel">
    <n-alert type="info" style="margin-bottom: 16px;">
      {{ t('settings.mcpDescription') }}
    </n-alert>

    <n-form label-placement="left" label-width="auto" class="compact-settings-form">
      <!-- Server Status -->
      <n-form-item :label="t('settings.mcpServerStatus')">
        <n-space align="center">
          <n-tag :type="mcpServerRunning ? 'success' : 'warning'" size="small">
            {{ mcpServerRunning ? t('settings.mcpRunning') : t('settings.mcpNotRunning') }}
          </n-tag>
          <span v-if="mcpServerRunning" class="mcp-port-info">
            {{ t('settings.mcpPort') }}: {{ mcpServerPort }}
          </span>
          <n-button
            size="small"
            quaternary
            @click="checkMcpServerStatus"
            :loading="checkingStatus"
          >
            {{ t('settings.refresh') }}
          </n-button>
        </n-space>
      </n-form-item>
    </n-form>

    <!-- Tab Navigation -->
    <n-tabs v-model:value="activeTab" type="line" animated class="mcp-tabs">
      <n-tab-pane name="debug" tab="debug">
        <template #tab>
          <n-icon><component :is="svgIcons.tool" /></n-icon>
          <span style="margin-left: 6px;">{{ t('settings.mcpDebugTools') }}</span>
        </template>

        <div class="tab-content">
          <n-form label-placement="left" label-width="auto" class="compact-settings-form">
            <!-- Debug Endpoints -->
            <n-form-item v-if="mcpServerRunning" :label="t('settings.mcpDebugEndpoints')">
              <n-space vertical style="width: 100%;">
                <div class="endpoint-item">
                  <span class="endpoint-label">{{ t('settings.mcpSSE') }}:</span>
                  <n-tag size="small" class="endpoint-url">http://127.0.0.1:{{ mcpServerPort }}/mcp/debug/sse</n-tag>
                </div>
                <div class="endpoint-item">
                  <span class="endpoint-label">{{ t('settings.mcpHTTP') }}:</span>
                  <n-tag size="small" class="endpoint-url">http://127.0.0.1:{{ mcpServerPort }}/mcp/debug</n-tag>
                </div>
              </n-space>
            </n-form-item>

            <!-- Debug Tools List -->
            <n-form-item v-if="mcpServerRunning" :label="t('settings.mcpDebugTools')">
              <n-space>
                <n-tag v-for="tool in debugTools" :key="tool" size="small" type="info">
                  {{ tool }}
                </n-tag>
              </n-space>
            </n-form-item>
          </n-form>

          <!-- Debug Configuration JSON -->
          <n-divider title-placement="left">{{ t('settings.mcpDebugConfigJson') }}</n-divider>

          <n-alert type="default" style="margin-bottom: 12px;">
            {{ t('settings.mcpConfigHint') }}
          </n-alert>

          <div class="config-json-container">
            <div class="config-json-header">
              <span class="config-json-title">mcp-debug-config.json</span>
              <n-button size="small" quaternary @click="copyDebugConfig">
                <template #icon>
                  <n-icon><component :is="svgIcons.copy" /></n-icon>
                </template>
                {{ t('settings.mcpCopyConfig') }}
              </n-button>
            </div>
            <n-code :code="debugConfigJson" language="json" :hljs="hljs" />
          </div>
        </div>
      </n-tab-pane>

      <n-tab-pane name="ai" tab="ai">
        <template #tab>
          <n-icon><component :is="svgIcons.robot" /></n-icon>
          <span style="margin-left: 6px;">{{ t('settings.mcpAITools') }}</span>
        </template>

        <div class="tab-content">
          <n-form label-placement="left" label-width="auto" class="compact-settings-form">
            <!-- AI Endpoints -->
            <n-form-item v-if="mcpServerRunning" :label="t('settings.mcpAIEndpoints')">
              <n-space vertical style="width: 100%;">
                <div class="endpoint-item">
                  <span class="endpoint-label">{{ t('settings.mcpSSE') }}:</span>
                  <n-tag size="small" class="endpoint-url">http://127.0.0.1:{{ mcpServerPort }}/mcp/ai/sse</n-tag>
                </div>
                <div class="endpoint-item">
                  <span class="endpoint-label">{{ t('settings.mcpHTTP') }}:</span>
                  <n-tag size="small" class="endpoint-url">http://127.0.0.1:{{ mcpServerPort }}/mcp/ai</n-tag>
                </div>
              </n-space>
            </n-form-item>

            <!-- AI Tools List -->
            <n-form-item v-if="mcpServerRunning" :label="t('settings.mcpAITools')">
              <n-space>
                <n-tag v-for="tool in aiTools" :key="tool" size="small" type="success">
                  {{ tool }}
                </n-tag>
              </n-space>
            </n-form-item>
          </n-form>

          <!-- AI Configuration JSON -->
          <n-divider title-placement="left">{{ t('settings.mcpAIConfigJson') }}</n-divider>

          <n-alert type="default" style="margin-bottom: 12px;">
            {{ t('settings.mcpConfigHint') }}
          </n-alert>

          <div class="config-json-container">
            <div class="config-json-header">
              <span class="config-json-title">mcp-ai-config.json</span>
              <n-button size="small" quaternary @click="copyAIConfig">
                <template #icon>
                  <n-icon><component :is="svgIcons.copy" /></n-icon>
                </template>
                {{ t('settings.mcpCopyConfig') }}
              </n-button>
            </div>
            <n-code :code="aiConfigJson" language="json" :hljs="hljs" />
          </div>
        </div>
      </n-tab-pane>
    </n-tabs>

    <!-- Health Endpoint -->
    <n-divider title-placement="left">{{ t('settings.mcpHealthEndpoint') }}</n-divider>
    <div class="endpoint-item">
      <span class="endpoint-label">{{ t('settings.mcpHealth') }}:</span>
      <n-tag size="small" class="endpoint-url">http://127.0.0.1:{{ mcpServerPort }}/health</n-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  NForm,
  NFormItem,
  NSpace,
  NAlert,
  NDivider,
  NButton,
  NTag,
  NTabs,
  NTabPane,
  NIcon,
  NCode,
  useMessage,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { isTauri } from '../../adapters';
import { svgIcons } from '../../utils/icons';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';

hljs.registerLanguage('json', json);

const { t } = useI18n();
const message = useMessage();

// MCP Server status
const mcpServerRunning = ref(false);
const mcpServerPort = ref(3001);
const checkingStatus = ref(false);

// Tab selection
const activeTab = ref('debug');

// MCP tools lists
const debugTools = ref<string[]>([]);
const aiTools = ref<string[]>([]);

// Configuration JSON for debug
const debugConfigJson = computed(() => {
  return JSON.stringify({
    mcpServers: {
      "rebebuca-debug": {
        url: `http://127.0.0.1:${mcpServerPort.value}/mcp/debug/sse`,
        disabled: false
      }
    }
  }, null, 2);
});

// Configuration JSON for AI
const aiConfigJson = computed(() => {
  return JSON.stringify({
    mcpServers: {
      "rebebuca-ai": {
        url: `http://127.0.0.1:${mcpServerPort.value}/mcp/ai/sse`,
        disabled: false
      }
    }
  }, null, 2);
});

const checkMcpServerStatus = async () => {
  checkingStatus.value = true;

  try {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        const port = await invoke<number>('mcp_get_server_port');
        mcpServerRunning.value = true;
        mcpServerPort.value = port;

        // Fetch debug and AI tools list
        await fetchDebugToolsList();
        await fetchAIToolsList();
      } catch (error) {
        console.log('[MCP Panel] MCP server not running:', error);
        mcpServerRunning.value = false;
        debugTools.value = [];
        aiTools.value = [];
      }
      } else {
        // In web mode, try to fetch health endpoint directly
        try {
          const response = await fetch(`http://127.0.0.1:${mcpServerPort.value}/health`);
          mcpServerRunning.value = response.ok;
        } catch {
          mcpServerRunning.value = false;
        }
      }
  } finally {
    checkingStatus.value = false;
  }
};

const fetchDebugToolsList = async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${mcpServerPort.value}/mcp/debug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.result?.tools) {
        debugTools.value = data.result.tools.map((tool: { name: string }) => tool.name);
      }
    }
  } catch (error) {
    console.error('[MCP Panel] Failed to fetch debug tools list:', error);
    debugTools.value = [];
  }
};

const fetchAIToolsList = async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${mcpServerPort.value}/mcp/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.result?.tools) {
        aiTools.value = data.result.tools.map((tool: { name: string }) => tool.name);
      }
    }
  } catch (error) {
    console.error('[MCP Panel] Failed to fetch AI tools list:', error);
    aiTools.value = [];
  }
};

const copyDebugConfig = async () => {
  try {
    await navigator.clipboard.writeText(debugConfigJson.value);
    message.success(t('settings.mcpCopySuccess'));
  } catch (error) {
    console.error('Failed to copy debug config:', error);
    message.error(t('settings.mcpCopyFailed'));
  }
};

const copyAIConfig = async () => {
  try {
    await navigator.clipboard.writeText(aiConfigJson.value);
    message.success(t('settings.mcpCopySuccess'));
  } catch (error) {
    console.error('Failed to copy AI config:', error);
    message.error(t('settings.mcpCopyFailed'));
  }
};

onMounted(() => {
  checkMcpServerStatus();
});
</script>

<style scoped lang="scss">
.mcp-panel {
  padding: 8px 0;
}

.compact-settings-form {
  :deep(.n-form-item) {
    margin-bottom: 12px;

    .n-form-item-label {
      padding-right: 12px;
    }
  }
}

.mcp-port-info {
  font-size: 13px;
  color: var(--n-text-color-2);
}

.endpoint-item {
  display: flex;
  align-items: center;
  gap: 8px;

  .endpoint-label {
    font-size: 12px;
    color: var(--n-text-color-3);
    min-width: 50px;
  }

  .endpoint-url {
    font-family: monospace;
    font-size: 12px;
  }
}

.mcp-tabs {
  margin-top: 16px;

  :deep(.n-tabs-nav) {
    padding: 0 8px;
  }

  :deep(.n-tabs-tab) {
    .n-icon {
      margin-right: 4px;
    }
  }
}

.tab-content {
  padding: 16px 0;
}

.config-json-container {
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 16px;

  .config-json-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--n-color-embedded);
    border-bottom: 1px solid var(--n-border-color);

    .config-json-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--n-text-color-2);
    }
  }

  :deep(.n-code) {
    margin: 0;
    border-radius: 0;

    code {
      padding: 12px !important;
      font-size: 13px;
    }
  }
}
</style>
