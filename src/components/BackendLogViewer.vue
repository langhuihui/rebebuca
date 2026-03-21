<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 -->

<template>
  <div class="backend-log-viewer">
    <n-alert v-if="!serverMode" type="info" class="backend-unavailable">
      {{ t('backendLog.unavailable') }}
    </n-alert>
    <template v-else>
      <div class="log-toolbar">
        <n-space>
          <n-button size="small" :loading="loading" @click="refresh">
            {{ t('backendLog.refresh') }}
          </n-button>
          <n-button size="small" :disabled="!logText" @click="exportLog">
            {{ t('backendLog.export') }}
          </n-button>
          <n-button size="small" type="error" :loading="clearing" @click="clear">
            {{ t('backendLog.clear') }}
          </n-button>
          <n-button
            size="small"
            :type="autoScroll ? 'primary' : 'default'"
            @click="toggleAutoScroll"
          >
            {{ autoScroll ? t('backendLog.autoScrollOn') : t('backendLog.autoScrollOff') }}
          </n-button>
        </n-space>
      </div>
      <n-scrollbar ref="scrollbarRef" class="log-scrollbar">
        <n-spin :show="loading">
          <pre class="log-content">{{ logText || t('backendLog.empty') }}</pre>
        </n-spin>
      </n-scrollbar>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue';
import { NSpace, NButton, NScrollbar, NSpin, NAlert, useMessage } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { isServer } from '../adapters';
import { getMcpHttpBase } from '../utils/mcpHttpBase';

const { t } = useI18n();
const message = useMessage();

const serverMode = isServer();

/** API returns string lines; tolerate legacy responses with structured objects. */
function normalizeBackendLogsToText(raw: unknown): string {
  if (!Array.isArray(raw)) return '';
  return raw
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'message' in item) {
        const e = item as {
          timestamp?: string;
          level?: string;
          source?: string;
          message: string;
        };
        const ts = e.timestamp ?? '';
        const lvl = String(e.level ?? 'info').toUpperCase();
        const src = e.source ?? 'backend';
        return `[${ts}] [${lvl}] [${src}] ${e.message}`;
      }
      return String(item);
    })
    .join('\n');
}

const logText = ref('');
const loading = ref(false);
const clearing = ref(false);
const scrollbarRef = ref<InstanceType<typeof NScrollbar> | null>(null);
const autoScroll = ref(true);

async function refresh() {
  if (!serverMode) return;
  loading.value = true;
  try {
    const base = getMcpHttpBase();
    const res = await fetch(`${base}/api/logs/backend?limit=500`);
    if (!res.ok) {
      throw new Error(`${res.status}`);
    }
    const data = (await res.json()) as { logs?: unknown[] };
    logText.value = normalizeBackendLogsToText(data.logs);
  } catch (e) {
    message.error(
      e instanceof Error ? e.message : t('backendLog.fetchFailed'),
    );
  } finally {
    loading.value = false;
  }
}

function exportLog() {
  if (!logText.value) return;
  const blob = new Blob([logText.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rebebuca-backend-${new Date().toISOString().slice(0, 10)}.log`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function clear() {
  if (!serverMode) return;
  clearing.value = true;
  try {
    const base = getMcpHttpBase();
    const res = await fetch(`${base}/api/logs/backend`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      throw new Error(`${res.status}`);
    }
    logText.value = '';
    message.success(t('backendLog.cleared'));
  } catch (e) {
    message.error(
      e instanceof Error ? e.message : t('backendLog.clearFailed'),
    );
  } finally {
    clearing.value = false;
  }
}

function scrollToBottom() {
  if (autoScroll.value && scrollbarRef.value) {
    nextTick(() => {
      scrollbarRef.value?.scrollTo({ top: 999999, behavior: 'smooth' });
    });
  }
}

function toggleAutoScroll() {
  autoScroll.value = !autoScroll.value;
  if (autoScroll.value) {
    scrollToBottom();
  }
}

watch(logText, () => {
  setTimeout(() => scrollToBottom(), 100);
});

onMounted(() => {
  if (serverMode) {
    void refresh();
  }
});
</script>

<style scoped lang="scss">
.backend-log-viewer {
  height: 100%;
  min-height: 360px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.backend-unavailable {
  margin-bottom: 8px;
}

.log-toolbar {
  margin-bottom: 12px;
  padding: 8px;
  background: var(--n-color-modal);
  border-radius: 4px;
  user-select: text;
  flex-shrink: 0;
}

.log-scrollbar {
  flex: 1;
  min-height: 0;
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
  user-select: text !important;
}
</style>
