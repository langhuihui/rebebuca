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
  <n-config-provider :theme="currentTheme" :hljs="hljs" :key="themeMode">
    <n-message-provider>
      <!-- Run configuration dialog -->
      <RunConfigDialog
        v-model:show="uiStore.configDialogVisible"
        :config="uiStore.editingConfig"
        @saved="(configData: any) => { 
          handleConfigSaved(configData, { value: uiStore.editingConfig }, runConfigStore, () => { 
            uiStore.closeConfigDialog();
          })
        }"
      />
      <n-layout class="h-screen app-window">
        <!-- Custom Title Bar -->
        <TitleBar :effective-theme="effectiveTheme" />

        <n-layout has-sider class="main-layout">
          <!-- Left sidebar - Run configurations -->
          <ConfigSidebar />

          <!-- Main content -->
          <n-layout-content class="main-content">
            <!-- Console output area -->
            <ConsoleArea />
          </n-layout-content>

          <!-- Right sidebar - Run history -->
          <HistorySidebar />
        </n-layout>
      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject } from "vue";
import { useI18n } from "vue-i18n";
import {
  NMessageProvider,
  NConfigProvider,
  NLayout,
  NLayoutContent,
} from "naive-ui";
import { useRunConfigStore } from "./stores/runConfig";
import { useUIStore } from "./stores/ui";
import { useAppStore } from "./stores/app";
import RunConfigDialog from "./components/RunConfigDialog.vue";
import TitleBar from "./components/TitleBar.vue";
import ConfigSidebar from "./components/ConfigSidebar.vue";
import ConsoleArea from "./components/ConsoleArea.vue";
import HistorySidebar from "./components/HistorySidebar.vue";
import { useTheme } from "./composables/useTheme";
import { type UnlistenFn } from "@tauri-apps/api/event";
import { handleConfigSaved } from "./utils/configUtils";
import { isWindows } from "./utils/platform";

// Get hljs from main.ts
const hljs = inject<any>("hljs");

// i18n
const { t } = useI18n();

// Theme
const { currentTheme, effectiveTheme, themeMode } = useTheme();

// Store management
const runConfigStore = useRunConfigStore();
const uiStore = useUIStore();
const appStore = useAppStore();

// Process stats interface
interface ProcessStats {
  process_id: string;
  cpu_usage: number;
  memory_usage: number;
  memory_usage_mb: string;
}

// Buffer for outputs received before history item is created
const outputBuffer = ref<
  Record<
    string,
    Array<{ content: string; outputType: "stdout" | "stderr" | "system" }>
  >
>({});

// Tauri event listeners
let unlistenOutput: UnlistenFn | null = null;
let unlistenStarted: UnlistenFn | null = null;
let unlistenStopped: UnlistenFn | null = null;

// Process monitoring
let processStatsInterval: number | null = null;

// Find history item by process ID
const findHistoryByProcessId = (processId: string) => {
  return runConfigStore.history.find((item) => item.processId === processId);
};

// Append output to history item with type distinction
const appendOutputToHistory = (
  processId: string,
  content: string,
  outputType: "stdout" | "stderr" | "system"
) => {
  const historyItem = findHistoryByProcessId(processId);
  if (historyItem) {
    // Mark stderr output with special prefix
    if (outputType === "stderr") {
      historyItem.output += `[ERROR] ${content}`;
    } else {
      historyItem.output += content;
    }

    // Update the history item in store
    runConfigStore.updateHistory(historyItem.id, {
      output: historyItem.output,
      status: historyItem.status,
    });

    // Auto scroll to bottom if this is the selected item
    if (uiStore.selectedHistoryItem?.id === historyItem.id) {
      // Scroll logic can be handled in the component
    }
  } else {
    // History item doesn't exist yet - buffer the output
    if (!outputBuffer.value[processId]) {
      outputBuffer.value[processId] = [];
    }
    outputBuffer.value[processId].push({ content, outputType });
  }
};

// Update history item status
const updateHistoryStatus = (
  processId: string,
  status: "running" | "success" | "error"
) => {
  const historyItem = findHistoryByProcessId(processId);
  if (historyItem) {
    historyItem.status = status;
    runConfigStore.updateHistory(historyItem.id, {
      status: status,
      output: historyItem.output,
    });
  }
};

// Update process statistics for running processes
const updateProcessStats = async () => {
  const runningProcesses = runConfigStore.history.filter(
    (item) => item.status === "running" && item.processId
  );

  for (const item of runningProcesses) {
    if (item.processId) {
      try {
        const stats = (await runConfigStore.getProcessStats(
          item.processId
        )) as ProcessStats | null;
        if (stats) {
          item.cpuUsage = `${stats.cpu_usage.toFixed(1)}%`;
          item.memoryUsage = stats.memory_usage_mb;

          // Update the history item in store
          runConfigStore.updateHistory(item.id, {
            cpuUsage: item.cpuUsage,
            memoryUsage: item.memoryUsage,
          });
        }
      } catch (error) {
        console.error("Failed to update process stats:", error);
      }
    }
  }
};

// Start process monitoring
const startProcessMonitoring = () => {
  if (processStatsInterval) {
    clearInterval(processStatsInterval);
  }

  processStatsInterval = setInterval(updateProcessStats, 2000); // Update every 2 seconds
};

// Stop process monitoring
const stopProcessMonitoring = () => {
  if (processStatsInterval) {
    clearInterval(processStatsInterval);
    processStatsInterval = null;
  }
};

// Suppress ResizeObserver loop errors
const resizeObserverErrorHandler = (e: ErrorEvent) => {
  if (e.message && e.message.includes("ResizeObserver loop")) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
  }
};

// Also suppress unhandled error events for ResizeObserver
const suppressResizeObserverError = () => {
  const debounce = (callback: Function, delay: number) => {
    let tid: number;
    return function (...args: any[]) {
      const ctx = self;
      tid && clearTimeout(tid);
      tid = window.setTimeout(() => {
        callback.apply(ctx, args);
      }, delay);
    };
  };

  const _ = (window as any).ResizeObserver;
  (window as any).ResizeObserver = class ResizeObserver extends _ {
    constructor(callback: ResizeObserverCallback) {
      callback = debounce(callback, 20);
      super(callback);
    }
  };
};

// Setup Tauri event listeners on mount
onMounted(async () => {
  // Check platform for window controls styling
  uiStore.setWindowsPlatform(await isWindows());

  // Suppress ResizeObserver errors
  suppressResizeObserverError();

  // Add global error handler for ResizeObserver
  window.addEventListener("error", resizeObserverErrorHandler);

  // Listen for process output
  unlistenOutput = await appStore.safeListen(
    "process-output",
    async (event) => {
      const { process_id, content, output_type } = event.payload;
      appendOutputToHistory(process_id, content, output_type);

      // Send system notification for stderr
      if (output_type === "stderr") {
        const historyItem = findHistoryByProcessId(process_id);
        if (historyItem) {
          try {
            await appStore.safeSendNotification({
              title: `${t("error.title")}: ${historyItem.name}`,
              body: content.trim().substring(0, 100), // Limit notification content
            });
          } catch (error) {
            console.error("Failed to send notification:", error);
          }
        }
      }
    }
  );

  // Listen for process started
  unlistenStarted = await appStore.safeListen(
    "process-started",
    (event: any) => {
      const { process_id } = event.payload;
      updateHistoryStatus(process_id, "running");
    }
  );

  // Listen for process stopped
  unlistenStopped = await appStore.safeListen(
    "process-stopped",
    async (event: any) => {
      const { process_id, status } = event.payload;
      const historyStatus = status === "stopped" ? "success" : "error";
      updateHistoryStatus(process_id, historyStatus);

      // Find the history item and update it
      const historyItem = findHistoryByProcessId(process_id);
      if (historyItem) {
        await runConfigStore.updateHistory(historyItem.id, {
          status: historyStatus,
          output: historyItem.output,
        });
      }
    }
  );

  // Start process monitoring
  startProcessMonitoring();
});

// Clean up event listeners on unmount
onUnmounted(() => {
  // Remove ResizeObserver error handler
  window.removeEventListener("error", resizeObserverErrorHandler);

  if (unlistenOutput) unlistenOutput();
  if (unlistenStarted) unlistenStarted();
  if (unlistenStopped) unlistenStopped();

  // Stop process monitoring
  stopProcessMonitoring();
});
</script>
