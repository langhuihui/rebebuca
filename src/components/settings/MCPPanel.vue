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
    <n-alert type="default" style="margin-bottom: 16px;" :show-icon="false">
      {{ t('settings.mcpSamePortNote') }}
    </n-alert>

    <n-form label-placement="left" label-width="auto" class="compact-settings-form">
      <n-form-item :label="t('settings.mcpServerStatus')">
        <n-space align="center">
          <n-tag :type="mcpServerRunning ? 'success' : 'warning'" size="small">
            {{ mcpServerRunning ? t('settings.mcpRunning') : t('settings.mcpNotRunning') }}
          </n-tag>
          <span v-if="mcpServerRunning && mcpOrigin" class="mcp-port-info">
            {{ t('settings.mcpBaseUrl') }}: {{ mcpOrigin }}
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

    <div class="tab-content">
      <n-form label-placement="left" label-width="auto" class="compact-settings-form">
        <n-form-item v-if="mcpServerRunning" :label="t('settings.mcpAIEndpoints')">
          <n-space vertical style="width: 100%;">
            <div class="endpoint-item">
              <span class="endpoint-label">{{ t('settings.mcpSSE') }}:</span>
              <n-tag size="small" class="endpoint-url">{{ mcpOrigin }}/mcp/ai/sse</n-tag>
            </div>
            <div class="endpoint-item">
              <span class="endpoint-label">{{ t('settings.mcpHTTP') }}:</span>
              <n-tag size="small" class="endpoint-url">{{ mcpOrigin }}/mcp/ai</n-tag>
            </div>
          </n-space>
        </n-form-item>

        <n-form-item v-if="mcpServerRunning" :label="t('settings.mcpAITools')">
          <n-space>
            <n-tag v-for="tool in aiTools" :key="tool" size="small" type="success">
              {{ tool }}
            </n-tag>
          </n-space>
        </n-form-item>
      </n-form>

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

    <n-divider title-placement="left">{{ t('settings.mcpHealthEndpoint') }}</n-divider>
    <div class="endpoint-item">
      <span class="endpoint-label">{{ t('settings.mcpHealth') }}:</span>
      <n-tag size="small" class="endpoint-url">{{ mcpOrigin }}/health</n-tag>
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
  NIcon,
  NCode,
  useMessage,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { svgIcons } from '../../utils/icons';
import { getMcpHttpBase } from '../../utils/mcpHttpBase';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';

hljs.registerLanguage('json', json);

const { t } = useI18n();
const message = useMessage();

/** Node 后端 HTTP 源（开发时与 Vite 页面端口不同） */
const mcpOrigin = computed(() => getMcpHttpBase());

const mcpServerRunning = ref(false);
const checkingStatus = ref(false);
const aiTools = ref<string[]>([]);

const aiConfigJson = computed(() =>
  JSON.stringify(
    {
      mcpServers: {
        'rebebuca-ai': {
          url: `${getMcpHttpBase()}/mcp/ai/sse`,
          disabled: false,
        },
      },
    },
    null,
    2,
  ),
);

const checkMcpServerStatus = async () => {
  checkingStatus.value = true;
  const base = getMcpHttpBase();
  try {
    const infoRes = await fetch(`${base}/api/mcp/info`);
    if (!infoRes.ok) {
      mcpServerRunning.value = false;
      aiTools.value = [];
      return;
    }
    const info = await infoRes.json();
    if (!info.mcpRunning) {
      mcpServerRunning.value = false;
      aiTools.value = [];
      return;
    }
    const response = await fetch(`${base}/health`);
    mcpServerRunning.value = response.ok;
    if (response.ok) {
      await fetchAIToolsList();
    } else {
      aiTools.value = [];
    }
  } catch {
    mcpServerRunning.value = false;
    aiTools.value = [];
  } finally {
    checkingStatus.value = false;
  }
};

const fetchAIToolsList = async () => {
  const base = getMcpHttpBase();
  try {
    const response = await fetch(`${base}/mcp/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
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
