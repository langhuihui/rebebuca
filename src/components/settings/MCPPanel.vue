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
      
      <!-- Server Endpoints -->
      <n-form-item v-if="mcpServerRunning" :label="t('settings.mcpEndpoints')">
        <n-space vertical style="width: 100%;">
          <div class="endpoint-item">
            <span class="endpoint-label">SSE:</span>
            <n-tag size="small" class="endpoint-url">http://127.0.0.1:{{ mcpServerPort }}/mcp/sse</n-tag>
          </div>
          <div class="endpoint-item">
            <span class="endpoint-label">HTTP:</span>
            <n-tag size="small" class="endpoint-url">http://127.0.0.1:{{ mcpServerPort }}/mcp</n-tag>
          </div>
          <div class="endpoint-item">
            <span class="endpoint-label">Health:</span>
            <n-tag size="small" class="endpoint-url">http://127.0.0.1:{{ mcpServerPort }}/health</n-tag>
          </div>
        </n-space>
      </n-form-item>
      
      <!-- Available Tools -->
      <n-form-item v-if="mcpServerRunning" :label="t('settings.mcpTools')">
        <n-space>
          <n-tag v-for="tool in mcpTools" :key="tool" size="small" type="info">
            {{ tool }}
          </n-tag>
        </n-space>
      </n-form-item>
    </n-form>
    
    <!-- Configuration JSON -->
    <n-divider title-placement="left">{{ t('settings.mcpConfigJson') }}</n-divider>
    
    <n-alert type="default" style="margin-bottom: 12px;">
      {{ t('settings.mcpConfigHint') }}
    </n-alert>
    
    <div class="config-json-container">
      <div class="config-json-header">
        <span class="config-json-title">mcp-config.json</span>
        <n-button size="small" quaternary @click="copyConfig">
          <template #icon>
            <n-icon><component :is="svgIcons.copy" /></n-icon>
          </template>
          {{ t('settings.mcpCopyConfig') }}
        </n-button>
      </div>
      <n-code :code="configJson" language="json" :hljs="hljs" />
    </div>
    
    <!-- Claude Desktop Configuration -->
    <n-divider title-placement="left">Claude Desktop</n-divider>
    
    <n-alert type="default" style="margin-bottom: 12px;">
      {{ t('settings.mcpClaudeHint') }}
    </n-alert>
    
    <div class="config-json-container">
      <div class="config-json-header">
        <span class="config-json-title">claude_desktop_config.json</span>
        <n-button size="small" quaternary @click="copyClaudeConfig">
          <template #icon>
            <n-icon><component :is="svgIcons.copy" /></n-icon>
          </template>
          {{ t('settings.mcpCopyConfig') }}
        </n-button>
      </div>
      <n-code :code="claudeConfigJson" language="json" :hljs="hljs" />
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

// MCP tools list
const mcpTools = ref<string[]>([]);

// Configuration JSON
const configJson = computed(() => {
  return JSON.stringify({
    mcpServers: {
      "rebebuca": {
        url: `http://127.0.0.1:${mcpServerPort.value}/mcp/sse`
      }
    }
  }, null, 2);
});

// Claude Desktop configuration JSON
const claudeConfigJson = computed(() => {
  return JSON.stringify({
    mcpServers: {
      "rebebuca": {
        url: `http://127.0.0.1:${mcpServerPort.value}/mcp/sse`,
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
        
        // Fetch tools list from health endpoint
        await fetchToolsList();
      } catch (error) {
        console.log('[MCP Panel] MCP server not running:', error);
        mcpServerRunning.value = false;
        mcpTools.value = [];
      }
    } else {
      // In web mode, try to fetch health endpoint directly
      try {
        const response = await fetch(`http://127.0.0.1:${mcpServerPort.value}/health`);
        if (response.ok) {
          const data = await response.json();
          mcpServerRunning.value = true;
          mcpTools.value = Array(data.tools).fill('').map((_, i) => `tool-${i + 1}`);
        } else {
          mcpServerRunning.value = false;
          mcpTools.value = [];
        }
      } catch {
        mcpServerRunning.value = false;
        mcpTools.value = [];
      }
    }
  } finally {
    checkingStatus.value = false;
  }
};

const fetchToolsList = async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${mcpServerPort.value}/mcp`, {
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
        mcpTools.value = data.result.tools.map((tool: { name: string }) => tool.name);
      }
    }
  } catch (error) {
    console.error('[MCP Panel] Failed to fetch tools list:', error);
    mcpTools.value = [];
  }
};

const copyConfig = async () => {
  try {
    await navigator.clipboard.writeText(configJson.value);
    message.success(t('settings.mcpCopySuccess'));
  } catch (error) {
    console.error('Failed to copy config:', error);
    message.error(t('settings.mcpCopyFailed'));
  }
};

const copyClaudeConfig = async () => {
  try {
    await navigator.clipboard.writeText(claudeConfigJson.value);
    message.success(t('settings.mcpCopySuccess'));
  } catch (error) {
    console.error('Failed to copy Claude config:', error);
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
