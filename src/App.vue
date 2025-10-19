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
      <n-dialog-provider>
        <!-- Run configuration dialog -->
        <RunConfigDialog
          v-model:show="uiStore.configDialogVisible"
          :config="uiStore.editingConfig"
          @saved="onConfigSaved"
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
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import {
  NMessageProvider,
  NConfigProvider,
  NDialogProvider,
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
import { isWindows } from "./utils/platform";
import { handleConfigSaved } from "./utils/configUtils";
import { setupSystemTrayMenu } from "./utils/tray";

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
const { editingConfig } = storeToRefs(uiStore);

// Config saved handler
const onConfigSaved = async (configData: any) => {
  await handleConfigSaved(configData, editingConfig, runConfigStore, () => {
    uiStore.closeConfigDialog();
  });
};

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

// Cache for finished processes to avoid repeated stats calls
const finishedProcesses = new Set<string>();

// Find history item by process ID (supports both UUID and system PID)
const findHistoryByProcessId = (processId: string) => {
  console.log(`[FRONTEND] findHistoryByProcessId called with: ${processId}`);
  console.log(`[FRONTEND] Available history items:`, runConfigStore.history.map(h => ({ id: h.id, processId: h.processId, pid: h.pid, internalId: h.internalId })));
  
  // First try to find by processId (system PID)
  let result = runConfigStore.history.find((item) => item.processId === processId);
  
  // If not found and processId looks like a UUID, try to find by internalId
  if (!result && processId.includes('-')) {
    result = runConfigStore.history.find((item) => item.internalId === processId);
  }
  
  console.log(`[FRONTEND] findHistoryByProcessId result:`, result ? result.id : 'not found');
  return result;
};

// Append output to history item with type distinction
const appendOutputToHistory = (
  processId: string,
  content: string,
  outputType: "stdout" | "stderr" | "system"
) => {
  const historyItem = findHistoryByProcessId(processId);
  if (historyItem) {
    console.log(`[FRONTEND] Appending ${outputType} to history item ${historyItem.id}: ${content.substring(0, 50)}...`);
    
    // Only update output for running processes
    if (historyItem.status === 'running') {
      // Mark stderr output with special prefix
      let newContent = content;
      if (outputType === "stderr") {
        newContent = `[ERROR] ${content}`;
      }

      // Update the history item in store with new output
      const updatedOutput = (historyItem.output || '') + newContent;
      runConfigStore.updateHistory(historyItem.id, {
        output: updatedOutput,
        status: historyItem.status,
      });

      // Force update the selected history item if it's the same
      if (uiStore.selectedHistoryItem?.id === historyItem.id) {
        // Update the selected item directly to trigger reactivity
        uiStore.selectedHistoryItem.output = updatedOutput;
      }
    }
  } else {
    // History item doesn't exist yet - buffer the output
    console.log(`[FRONTEND] History item not found for PID ${processId}, buffering ${outputType} output`);
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

// Process buffered output when history item is created
const processBufferedOutput = (processId: string) => {
  const historyItem = findHistoryByProcessId(processId);
  if (historyItem && outputBuffer.value[processId]) {
    const bufferedOutputs = outputBuffer.value[processId];
    let totalOutput = historyItem.output || '';
    
    for (const bufferedOutput of bufferedOutputs) {
      let content = bufferedOutput.content;
      if (bufferedOutput.outputType === "stderr") {
        content = `[ERROR] ${content}`;
      }
      totalOutput += content;
    }
    
    // Update the history item with all buffered output
    runConfigStore.updateHistory(historyItem.id, {
      output: totalOutput,
      status: historyItem.status,
    });
    
    // Force update the selected history item if it's the same
    if (uiStore.selectedHistoryItem?.id === historyItem.id) {
      uiStore.selectedHistoryItem.output = totalOutput;
    }
    
    // Clear the buffer
    delete outputBuffer.value[processId];
  }
};

// Update process statistics for running processes
const updateProcessStats = async () => {
  const runningProcesses = runConfigStore.history.filter(
    (item) => item.status === "running" && item.processId && !finishedProcesses.has(item.processId)
  );

  if (runningProcesses.length > 0) {
    console.log(`Updating stats for ${runningProcesses.length} running processes`);
  }

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
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // If process is not found or finished, mark it as finished to avoid further calls
        if (errorMessage.includes("not found") || 
            errorMessage.includes("finished") || 
            errorMessage.includes("Process not found - it has finished")) {
          console.log(`Process ${item.processId} has finished, marking as finished and updating status`);
          finishedProcesses.add(item.processId);
          
          // Update the status to avoid further stats calls
          runConfigStore.updateHistory(item.id, {
            status: "success"
          });
          // Don't log this as a warning since it's expected behavior
        } else {
          // Only log as warning if it's an unexpected error
          console.warn(`Failed to get stats for process ${item.processId}:`, errorMessage);
        }
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
      console.log(`[FRONTEND] Received ${output_type} output - PID: ${process_id}, Content: ${content.substring(0, 100)}...`);
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
      const { internal_id, system_pid } = event.payload;
      console.log(`[FRONTEND] Process started - Internal UUID: ${internal_id}, System PID: ${system_pid}`);
      
      // Find history item by the internal_id (UUID)
      const historyItem = findHistoryByProcessId(internal_id);
      
      if (historyItem && system_pid) {
        const systemPidStr = system_pid.toString();
        
        // Update the history item with the system PID
        runConfigStore.updateHistory(historyItem.id, {
          processId: systemPidStr, // 使用系统PID作为processId
          pid: systemPidStr // 显示的系统PID
        });
        
        updateHistoryStatus(systemPidStr, "running");
        
        // Process any buffered output for this process
        processBufferedOutput(systemPidStr);
      } else {
        console.warn(`[FRONTEND] History item not found for internal UUID ${internal_id} or no system PID available`);
      }
    }
  );

  // Listen for process stopped
  unlistenStopped = await appStore.safeListen(
    "process-stopped",
    async (event: any) => {
      const { internal_id, system_pid, status } = event.payload;
      console.log(`[FRONTEND] Process stopped - Internal UUID: ${internal_id}, System PID: ${system_pid}, Status: ${status}`);
      
      // For kill_process, internal_id is actually the system PID
      // We need to find the history item by system PID
      let processId = system_pid ? system_pid.toString() : internal_id;
      
      // If internal_id is a number (system PID), use it directly
      if (!isNaN(Number(internal_id))) {
        processId = internal_id;
      }
      
      // Map Tauri ProcessStatus to our history status
      let historyStatus: "running" | "success" | "error";
      if (status === "stopped") {
        historyStatus = "success";
      } else if (status === "error") {
        historyStatus = "error";
      } else {
        historyStatus = "success"; // Default to success for any other status
      }
      
      // Mark process as finished to avoid further stats calls
      finishedProcesses.add(processId);
      
      // Update history status immediately
      updateHistoryStatus(processId, historyStatus);
      
      console.log(`Process ${processId} status updated to: ${historyStatus}`);
    }
  );

  // Start process monitoring
  startProcessMonitoring();

  // Initialize system tray context menu
  setupSystemTrayMenu(runConfigStore);
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
