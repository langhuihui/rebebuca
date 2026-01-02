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
  <div class="dev-log-viewer">
    <n-tabs v-model:value="activeTab" type="line" animated>
      <!-- Frontend Console Logs -->
      <n-tab-pane name="console" :tab="t('devLog.consoleLogs')">
        <div class="log-toolbar">
          <n-space>
            <n-checkbox-group v-model:value="selectedLevels" size="small">
              <n-checkbox value="debug" label="Debug" />
              <n-checkbox value="info" label="Info" />
              <n-checkbox value="warn" label="Warn" />
              <n-checkbox value="error" label="Error" />
            </n-checkbox-group>
            <n-input
              v-model:value="searchText"
              :placeholder="t('devLog.search')"
              size="small"
              clearable
              style="width: 200px"
            />
          </n-space>
          <n-space>
            <n-button size="small" @click="refreshConsoleLogs">
              {{ t('devLog.refresh') }}
            </n-button>
            <n-button size="small" @click="exportConsoleLogs">
              {{ t('devLog.export') }}
            </n-button>
            <n-button size="small" type="error" @click="clearConsoleLogs">
              {{ t('devLog.clear') }}
            </n-button>
            <n-button size="small" :type="autoScroll ? 'primary' : 'default'" @click="toggleAutoScroll">
              {{ autoScroll ? t('devLog.autoScrollOn') : t('devLog.autoScrollOff') }}
            </n-button>
          </n-space>
        </div>
        <n-scrollbar ref="consoleScrollbarRef" style="max-height: 400px">
          <div class="log-entries">
            <div
              v-for="(entry, index) in filteredConsoleLogs"
              :key="index"
              :class="['log-entry', `log-${entry.level}`]"
            >
              <span class="log-time">{{ formatTime(entry.timestamp) }}</span>
              <span :class="['log-level', `level-${entry.level}`]">{{ entry.level.toUpperCase() }}</span>
              <span class="log-source">{{ entry.source }}</span>
              <span class="log-message">{{ entry.message }}</span>
            </div>
            <div v-if="filteredConsoleLogs.length === 0" class="no-logs">
              {{ t('devLog.noLogs') }}
            </div>
          </div>
        </n-scrollbar>
      </n-tab-pane>
      
      <!-- Tauri Backend Logs -->
      <n-tab-pane name="tauri" :tab="t('devLog.tauriLogs')">
        <div class="log-toolbar">
          <n-space>
            <n-select
              v-model:value="selectedLogFile"
              :options="logFileOptions"
              :placeholder="t('devLog.selectLogFile')"
              size="small"
              style="width: 300px"
              :loading="loadingLogFiles"
            />
          </n-space>
          <n-space>
            <n-button size="small" @click="refreshLogFiles">
              {{ t('devLog.refresh') }}
            </n-button>
            <n-button size="small" @click="openLogFolder">
              {{ t('devLog.openFolder') }}
            </n-button>
          </n-space>
        </div>
        <n-scrollbar style="max-height: 400px">
          <n-spin :show="loadingLogContent">
            <pre class="log-content">{{ logFileContent || t('devLog.selectFileToView') }}</pre>
          </n-spin>
        </n-scrollbar>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { NTabs, NTabPane, NSpace, NButton, NInput, NScrollbar, NCheckboxGroup, NCheckbox, NSelect, NSpin } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { 
  getFilteredLogs, 
  clearLogs, 
  exportLogsAsText,
  type LogLevel 
} from '../utils/devLogger';

const { t } = useI18n();

// State
const activeTab = ref('console');
const logVersion = ref(0); // Used to trigger re-computation
const selectedLevels = ref<LogLevel[]>(['info', 'warn', 'error']);
const searchText = ref('');
const consoleScrollbarRef = ref<InstanceType<typeof NScrollbar> | null>(null);
const autoScroll = ref(true);

// Tauri logs state
const logFiles = ref<any[]>([]);
const selectedLogFile = ref<string | null>(null);
const logFileContent = ref('');
const loadingLogFiles = ref(false);
const loadingLogContent = ref(false);

// Computed
const filteredConsoleLogs = computed(() => {
  // logVersion is used to trigger re-computation when logs are cleared
  void logVersion.value;
  return getFilteredLogs({
    level: selectedLevels.value.length > 0 ? selectedLevels.value : undefined,
    search: searchText.value || undefined,
  });
});

const logFileOptions = computed(() => {
  return logFiles.value.map(file => ({
    label: `${file.name} (${formatFileSize(file.size)}) - ${file.modified}`,
    value: file.name,
  }));
});

// Methods
function formatTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${ms}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function refreshConsoleLogs() {
  logVersion.value++;
}

function clearConsoleLogs() {
  clearLogs();
  logVersion.value++;
}

function exportConsoleLogs() {
  const content = exportLogsAsText();
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rebebuca-console-${new Date().toISOString().slice(0, 10)}.log`;
  a.click();
  URL.revokeObjectURL(url);
}

async function refreshLogFiles() {
  loadingLogFiles.value = true;
  try {
    const files = await invoke<any[]>('list_app_log_files');
    logFiles.value = files;
    if (files.length > 0 && !selectedLogFile.value) {
      selectedLogFile.value = files[0].name;
    }
  } catch (error) {
    console.error('Failed to list log files:', error);
  } finally {
    loadingLogFiles.value = false;
  }
}

async function loadLogFileContent(filename: string) {
  loadingLogContent.value = true;
  try {
    const content = await invoke<string>('read_app_log_file', { filename });
    logFileContent.value = content;
  } catch (error) {
    console.error('Failed to read log file:', error);
    logFileContent.value = `Error: ${error}`;
  } finally {
    loadingLogContent.value = false;
  }
}

async function openLogFolder() {
  try {
    await invoke('open_app_log_folder');
  } catch (error) {
    console.error('Failed to open log folder:', error);
  }
}

// Watch for log file selection
watch(selectedLogFile, (newFile) => {
  if (newFile) {
    loadLogFileContent(newFile);
  }
});

// Auto-scroll to bottom when new logs arrive
function scrollToBottom() {
  if (autoScroll.value && consoleScrollbarRef.value) {
    nextTick(() => {
      consoleScrollbarRef.value?.scrollTo({ top: 999999, behavior: 'smooth' });
    });
  }
}

function toggleAutoScroll() {
  autoScroll.value = !autoScroll.value;
  if (autoScroll.value) {
    scrollToBottom();
  }
}

// Watch for new logs and auto-scroll
watch(filteredConsoleLogs, () => {
  scrollToBottom();
}, { deep: true });

// Initialize
onMounted(() => {
  refreshConsoleLogs();
  refreshLogFiles();
  // Initial scroll to bottom
  nextTick(() => {
    scrollToBottom();
  });
});
</script>

<style scoped lang="scss">
.dev-log-viewer {
  .log-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding: 8px;
    background: var(--n-color-modal);
    border-radius: 4px;
  }
  
  .log-entries {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 12px;
  }
  
  .log-entry {
    padding: 4px 8px;
    border-bottom: 1px solid var(--n-border-color);
    display: flex;
    gap: 8px;
    
    &.log-debug {
      opacity: 0.7;
    }
    
    &.log-warn {
      background: rgba(250, 173, 20, 0.1);
    }
    
    &.log-error {
      background: rgba(255, 77, 79, 0.1);
    }
    
    .log-time {
      color: var(--n-text-color-3);
      flex-shrink: 0;
    }
    
    .log-level {
      flex-shrink: 0;
      width: 50px;
      font-weight: bold;
      
      &.level-debug {
        color: #8c8c8c;
      }
      
      &.level-info {
        color: #1890ff;
      }
      
      &.level-warn {
        color: #faad14;
      }
      
      &.level-error {
        color: #ff4d4f;
      }
    }
    
    .log-source {
      flex-shrink: 0;
      color: var(--n-text-color-3);
      padding: 0 4px;
      background: var(--n-color-modal);
      border-radius: 2px;
      font-size: 10px;
    }
    
    .log-message {
      flex: 1;
      word-break: break-all;
      white-space: pre-wrap;
    }
  }
  
  .no-logs {
    padding: 20px;
    text-align: center;
    color: var(--n-text-color-3);
  }
  
  .log-content {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    padding: 12px;
    background: var(--n-color-modal);
    border-radius: 4px;
    min-height: 200px;
    margin: 0;
  }
}
</style>
