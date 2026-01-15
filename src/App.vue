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
  <!-- In embedded mode, skip config-provider to avoid nesting issues with NModal teleport -->
  <component
    :is="props.embedded ? 'div' : NConfigProvider"
    :theme="currentTheme"
    :hljs="hljs"
  >
    <n-message-provider>
      <n-dialog-provider>
        <!-- About dialog -->
        <n-modal
          v-model:show="showAboutDialog"
          preset="card"
          :title="t('about.title')"
          style="width: 400px"
          class="about-modal"
          to="body"
        >
          <div class="about-content">
            <img src="/logo.svg" alt="Rebebuca" class="about-logo" />
            <h2 class="about-name">Rebebuca</h2>
            <div class="about-version">v{{ currentVersion }}</div>
            <p class="about-description">{{ t("about.description") }}</p>
            <div class="about-links">
              <n-button
                text
                tag="a"
                href="https://rebebuca.com"
                target="_blank"
                type="primary"
              >
                {{ t("about.website") }}
              </n-button>
            </div>
            <div class="about-copyright">
              {{ t("about.copyright") }}
            </div>
          </div>
        </n-modal>

        <!-- Server Directory Picker (for server mode) -->
        <ServerDirectoryPicker
          v-if="directoryPickerFsAdapter"
          v-model:show="isDirectoryPickerVisible"
          :title="directoryPickerOptions.title"
          :default-path="directoryPickerOptions.defaultPath"
          :fs-adapter="directoryPickerFsAdapter"
          @select="onDirectoryPickerSelect"
        />

        <n-layout
          class="h-screen app-window"
          :class="{ 'embedded-mode': props.embedded }"
        >
          <!-- Custom Title Bar (hidden in embedded mode) -->
          <TitleBar v-if="!props.embedded" :effective-theme="effectiveTheme" />

          <n-layout has-sider class="main-layout">
            <!-- Left sidebar - Task Explorer -->
            <TaskSidebar />

            <!-- Main content (hidden in mini mode) -->
            <n-layout-content v-if="!uiStore.miniMode" class="main-content">
              <!-- Console output area -->
              <ConsoleArea />
            </n-layout-content>
          </n-layout>

          <!-- Status Bar (hidden in embedded mode or mini mode) -->
          <StatusBar v-if="!props.embedded && !uiStore.miniMode" />

          <!-- Remote Notification Modal (hidden in embedded mode) -->
          <RemoteNotificationModal v-if="!props.embedded" />
        </n-layout>
      </n-dialog-provider>
    </n-message-provider>
  </component>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject } from "vue";
import { useI18n } from "vue-i18n";
import {
  NMessageProvider,
  NConfigProvider,
  NDialogProvider,
  NLayout,
  NLayoutContent,
  NModal,
  NButton,
} from "naive-ui";
import { useRunConfigStore } from "./stores/runConfig";
import { useUIStore } from "./stores/ui";
import { useAppStore } from "./stores/app";
import { useUpdaterStore } from "./stores/updater";
import { useFeatureFlagsStore } from "./stores/featureFlags";
import TitleBar from "./components/TitleBar.vue";
import TaskSidebar from "./components/TaskSidebar.vue";
import ConsoleArea from "./components/ConsoleArea.vue";
import StatusBar from "./components/StatusBar.vue";
import ServerDirectoryPicker from "./components/ServerDirectoryPicker.vue";
import RemoteNotificationModal from "./components/RemoteNotificationModal.vue";
import { useTheme } from "./composables/useTheme";
import { type UnlistenFn } from "@tauri-apps/api/event";
import { isWindows } from "./utils/platform";
import { initTrayService, cleanupTrayService } from "./services/trayService";
import { useNotificationStore } from "./stores/notification";
import { setErrorCallback } from "./utils/devLogger";
import { 
  registerDirectoryPicker, 
  unregisterDirectoryPicker, 
  onDirectorySelected,
  getDirectoryPickerFsAdapter,
  type DirectoryPickerOptions 
} from "./services/directoryPickerService";
// import { setupSystemTrayMenu } from "./utils/tray";

// Props for embedded mode (website demo)
interface Props {
  embedded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  embedded: false,
});

// Get hljs from main.ts
const hljs = inject<any>("hljs");

// i18n
const { t } = useI18n();

// Theme
const { currentTheme, effectiveTheme } = useTheme();

// Store management
const runConfigStore = useRunConfigStore();
const uiStore = useUIStore();
const appStore = useAppStore();
const updaterStore = useUpdaterStore();
const featureFlagsStore = useFeatureFlagsStore();
const notificationStore = useNotificationStore();

// About dialog state
const showAboutDialog = ref(false);
const currentVersion = ref("");

// Directory picker state (for server mode)
const isDirectoryPickerVisible = ref(false);
const directoryPickerOptions = ref<DirectoryPickerOptions>({});
const directoryPickerFsAdapter = ref<{ readDir: (path: string) => Promise<any[]> } | null>(null);

// Handle directory picker selection
const onDirectoryPickerSelect = (path: string | null) => {
  isDirectoryPickerVisible.value = false;
  onDirectorySelected(path);
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
let unlistenPtyExit: UnlistenFn | null = null;
let unlistenSshOutput: UnlistenFn | null = null;
let unlistenSshProcessStarted: UnlistenFn | null = null;
let unlistenSshProcessFinished: UnlistenFn | null = null;
let unlistenSshError: UnlistenFn | null = null;

// Process monitoring
let processStatsInterval: number | null = null;

// Cache for finished processes to avoid repeated stats calls
const finishedProcesses = new Set<string>();

// Cache for processes that are currently being checked to avoid duplicate calls
const checkingProcesses = new Set<string>();

// Cache for processes that have failed stats checks (to implement retry logic)
const failedStatsChecks = new Map<string, number>();

// Find history item by process ID (supports both UUID and system PID)
const findHistoryByProcessId = (processId: string) => {
  console.log(`[FRONTEND] findHistoryByProcessId called with: ${processId}`);
  console.log(
    `[FRONTEND] Available history items:`,
    runConfigStore.history.map((h) => ({
      id: h.id,
      pid: h.pid,
      internalId: h.internalId,
    }))
  );

  // First try to find by pid (system PID)
  let result = runConfigStore.history.find((item) => item.pid === processId);

  // If not found and processId looks like a UUID, try to find by internalId
  if (!result && processId.includes("-")) {
    result = runConfigStore.history.find(
      (item) => item.internalId === processId
    );
  }

  console.log(
    `[FRONTEND] findHistoryByProcessId result:`,
    result ? result.id : "not found"
  );
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
    console.log(
      `[FRONTEND] Appending ${outputType} to history item ${
        historyItem.id
      }: ${content.substring(0, 50)}...`
    );

    // Only update output for running processes
    if (historyItem.status === "running") {
      // Note: [ERROR] prefix is already added by Rust backend for stderr
      // Update the history item in store with new output
      const updatedOutput = (historyItem.output || "") + content;
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
    console.log(
      `[FRONTEND] History item not found for PID ${processId}, buffering ${outputType} output`
    );
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

    // Calculate final duration when process finishes
    let updateData: any = {
      status: status,
      output: historyItem.output,
    };

    if (status !== "running" && historyItem.startTime) {
      const endTime = Date.now();
      const duration = endTime - historyItem.startTime;
      updateData.duration = duration;
      console.log(
        `[FRONTEND] Process ${processId} finished, duration: ${duration}ms (${Math.floor(
          duration / 1000
        )}s)`
      );
    }

    runConfigStore.updateHistory(historyItem.id, updateData);
  }
};

// Process buffered output when history item is created
const processBufferedOutput = (processId: string) => {
  const historyItem = findHistoryByProcessId(processId);
  if (historyItem && outputBuffer.value[processId]) {
    const bufferedOutputs = outputBuffer.value[processId];
    let totalOutput = historyItem.output || "";

    for (const bufferedOutput of bufferedOutputs) {
      // Note: [ERROR] prefix is already added by Rust backend for stderr
      totalOutput += bufferedOutput.content;
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
    (item) =>
      item.status === "running" && item.pid && !finishedProcesses.has(item.pid)
  );

  if (runningProcesses.length > 0) {
    console.log(
      `[FRONTEND] Updating stats for ${runningProcesses.length} running processes:`,
      runningProcesses.map((p) => ({ id: p.id, pid: p.pid, name: p.name }))
    );
  }

  for (const item of runningProcesses) {
    if (item.pid && !checkingProcesses.has(item.pid)) {
      // Check if this process has failed too many times
      const failureCount = failedStatsChecks.get(item.pid) || 0;
      if (failureCount >= 5) {
        // Skip processes that have failed too many times
        console.log(
          `Skipping process ${item.pid} - too many failed stats checks (${failureCount})`
        );
        continue;
      }

      checkingProcesses.add(item.pid);

      try {
        console.log(
          `[FRONTEND] Attempting to get stats for process ${
            item.pid
          } (attempt ${failureCount + 1})`
        );
        const stats = (await runConfigStore.getProcessStats(
          item.pid
        )) as ProcessStats | null;

        console.log(`[FRONTEND] Stats result for process ${item.pid}:`, stats);

        if (stats) {
          item.cpuUsage = `${stats.cpu_usage.toFixed(1)}%`;
          item.memoryUsage = stats.memory_usage_mb;

          console.log(
            `[FRONTEND] Successfully updated stats for process ${item.pid}: CPU=${item.cpuUsage}, Memory=${item.memoryUsage}`
          );

          // Update the history item in store
          runConfigStore.updateHistory(item.id, {
            cpuUsage: item.cpuUsage,
            memoryUsage: item.memoryUsage,
          });

          // Clear failure count on success
          failedStatsChecks.delete(item.pid);
        } else {
          // If stats is null, don't immediately mark as finished
          // The process might still be starting up or temporarily unavailable
          console.log(
            `[FRONTEND] Process ${item.pid} stats returned null, but not marking as finished yet`
          );
          // Don't mark as finished immediately - let the process-stopped event handle it
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Only mark as finished if we get a specific "finished" error
        if (
          errorMessage.includes("Process not found - it has finished") ||
          errorMessage.includes("Process has finished")
        ) {
          console.log(
            `Process ${item.pid} has finished, marking as finished and updating status`
          );
          finishedProcesses.add(item.pid);
          failedStatsChecks.delete(item.pid);

          // Update the status to avoid further stats calls
          runConfigStore.updateHistory(item.id, {
            status: "success",
          });
          // Don't log this as a warning since it's expected behavior
        } else {
          // For other errors, increment failure count
          const newFailureCount = failureCount + 1;
          failedStatsChecks.set(item.pid, newFailureCount);

          console.log(
            `Process ${item.pid} stats temporarily unavailable (attempt ${newFailureCount}/5): ${errorMessage}`
          );
          // Don't mark as finished - the process might still be running
        }
      } finally {
        // Always remove from checking set
        checkingProcesses.delete(item.pid);
      }
    }
  }
};

// Clean up finished processes cache periodically
const cleanupFinishedProcesses = () => {
  // Remove processes that are no longer in the history or have been marked as finished
  const currentPids = new Set(
    runConfigStore.history.map((h) => h.pid).filter(Boolean)
  );
  const toRemove = Array.from(finishedProcesses).filter(
    (pid) => !currentPids.has(pid)
  );
  toRemove.forEach((pid) => finishedProcesses.delete(pid));

  // Also clean up checking processes cache
  const toRemoveChecking = Array.from(checkingProcesses).filter(
    (pid) => !currentPids.has(pid)
  );
  toRemoveChecking.forEach((pid) => checkingProcesses.delete(pid));

  // Clean up failed stats checks cache
  const toRemoveFailed = Array.from(failedStatsChecks.keys()).filter(
    (pid) => !currentPids.has(pid)
  );
  toRemoveFailed.forEach((pid) => failedStatsChecks.delete(pid));

  if (
    toRemove.length > 0 ||
    toRemoveChecking.length > 0 ||
    toRemoveFailed.length > 0
  ) {
    console.log(
      `Cleaned up ${toRemove.length} finished processes, ${toRemoveChecking.length} checking processes, and ${toRemoveFailed.length} failed stats checks from cache`
    );
  }
};

// Start process monitoring
const startProcessMonitoring = () => {
  if (processStatsInterval) {
    clearInterval(processStatsInterval);
  }

  // Update stats every 3 seconds for running processes (reduced frequency to avoid race conditions)
  processStatsInterval = setInterval(updateProcessStats, 3000);

  // Clean up finished processes cache every 30 seconds
  setInterval(cleanupFinishedProcesses, 30000);
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

  // Register directory picker for server mode
  registerDirectoryPicker((options: DirectoryPickerOptions) => {
    // Get the latest fsAdapter
    directoryPickerFsAdapter.value = getDirectoryPickerFsAdapter();
    directoryPickerOptions.value = options;
    isDirectoryPickerVisible.value = true;
  });

  // Get current version
  currentVersion.value = await updaterStore.getCurrentVersion();

  // Initialize feature flags
  await featureFlagsStore.initialize();

  // Set up error callback for DevLogger to route errors to notification store
  setErrorCallback((level, message, source) => {
    // Filter out known benign errors
    if (message.includes('ResizeObserver loop')) {
      return; // This is a known browser issue, not a real error
    }
    
    if (level === 'error') {
      notificationStore.addError('Frontend Error', message, source);
    } else if (level === 'warn') {
      notificationStore.addWarning('Frontend Warning', message, source);
    }
  });

  // Listen for show-about-dialog event from Rust menu
  await appStore.safeListen("show-about-dialog", () => {
    showAboutDialog.value = true;
  });

  // Check for what's new dialog (after update)
  await updaterStore.checkWhatsNew();

  // Listen for process output
  unlistenOutput = await appStore.safeListen(
    "process-output",
    async (event) => {
      const { process_id, content, output_type } = event.payload;
      console.log(
        `[FRONTEND] Received ${output_type} output - PID: ${process_id}, Content: ${content.substring(
          0,
          100
        )}...`
      );
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
      console.log(
        `[FRONTEND] Process started - Internal UUID: ${internal_id}, System PID: ${system_pid}`
      );

      // Find history item by the internal_id (UUID)
      const historyItem = findHistoryByProcessId(internal_id);

      if (historyItem) {
        // Use system_pid if available, otherwise use internal_id
        const processId = system_pid ? system_pid.toString() : internal_id;

        console.log(
          `[FRONTEND] Process started - updating history item ${historyItem.id} with process ID: ${processId} (system_pid: ${system_pid}, internal_id: ${internal_id})`
        );
        console.log(`[FRONTEND] History item before update:`, {
          id: historyItem.id,
          pid: historyItem.pid,
          internalId: historyItem.internalId,
          status: historyItem.status,
        });

        // Update the history item with the process ID (system PID or internal ID)
        runConfigStore.updateHistory(historyItem.id, {
          pid: processId, // 使用系统PID（如果存在）或内部ID作为pid
        });

        console.log(`[FRONTEND] History item after update:`, {
          id: historyItem.id,
          pid: historyItem.pid,
          internalId: historyItem.internalId,
          status: historyItem.status,
        });

        updateHistoryStatus(processId, "running");

        // Process any buffered output for this process
        processBufferedOutput(processId);
      } else {
        console.warn(
          `[FRONTEND] History item not found for internal UUID ${internal_id}`
        );
        console.warn(
          `[FRONTEND] Available history items:`,
          runConfigStore.history.map((h) => ({
            id: h.id,
            pid: h.pid,
            internalId: h.internalId,
            status: h.status,
          }))
        );
      }
    }
  );

  // Listen for process stopped
  unlistenStopped = await appStore.safeListen(
    "process-stopped",
    async (event: any) => {
      const { internal_id, system_pid, status } = event.payload;
      console.log(
        `[FRONTEND] Process stopped - Internal UUID: ${internal_id}, System PID: ${system_pid}, Status: ${status}`
      );

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

      // Also mark by internal_id if it's different from processId
      if (internal_id && internal_id !== processId) {
        finishedProcesses.add(internal_id);
      }

      // Remove from checking processes if it was being checked
      checkingProcesses.delete(processId);
      if (internal_id && internal_id !== processId) {
        checkingProcesses.delete(internal_id);
      }

      // Remove from failed stats checks cache
      failedStatsChecks.delete(processId);
      if (internal_id && internal_id !== processId) {
        failedStatsChecks.delete(internal_id);
      }

      // Update history status immediately
      updateHistoryStatus(processId, historyStatus);

      console.log(`Process ${processId} status updated to: ${historyStatus}`);
    }
  );

  // Listen for PTY exit events (for terminal-based task execution)
  unlistenPtyExit = await appStore.safeListen(
    "pty-exit",
    async (event: any) => {
      const { pty_id, exit_code } = event.payload;
      console.log(
        `[FRONTEND] PTY exit event - PTY ID: ${pty_id}, Exit Code: ${exit_code}`
      );

      // Find history item by ptyId
      const historyItem = runConfigStore.history.find(
        (item) => item.ptyId === pty_id
      );

      if (historyItem) {
        // Determine status based on exit code
        const historyStatus: "running" | "success" | "error" =
          exit_code === 0 || exit_code === null ? "success" : "error";

        // Calculate duration
        const endTime = Date.now();
        const duration = historyItem.startTime
          ? endTime - historyItem.startTime
          : 0;

        console.log(
          `[FRONTEND] PTY ${pty_id} finished, duration: ${duration}ms, status: ${historyStatus}`
        );

        // Update history
        runConfigStore.updateHistory(historyItem.id, {
          status: historyStatus,
          duration: duration,
        });
        
        // Notify taskManager that task has exited (for SSH tasks)
        if (historyItem.configId) {
          try {
            const { useTaskManagerStore } = await import('./stores/taskManager');
            const taskManager = useTaskManagerStore();
            taskManager.onTaskExit(historyItem.ptyId || historyItem.configId);
          } catch (error) {
            console.error('[App] Failed to notify taskManager:', error);
          }
        }

        // Update selected history item if it's the same
        if (uiStore.selectedHistoryItem?.id === historyItem.id) {
          uiStore.selectedHistoryItem.status = historyStatus;
          uiStore.selectedHistoryItem.duration = duration;
        }
      } else {
        console.log(`[FRONTEND] No history item found for PTY ${pty_id}`);
      }
    }
  );

  // Listen for SSH output events
  unlistenSshOutput = await appStore.safeListen(
    "ssh-output",
    async (event: any) => {
      const { taskId, type, content } = event.payload;
      console.log(`[FRONTEND] SSH output - Task ID: ${taskId}, Type: ${type}`);
      
      // Find history item by task ID (ptyId is the exec_id for SSH tasks)
      const historyItem = runConfigStore.history.find(
        (item) => item.configId === taskId || item.ptyId === taskId
      );

      if (historyItem) {
        // Map SSH output type to history output type
        const outputType = type === 'stdout' ? 'stdout' : type === 'stderr' ? 'stderr' : 'system';
        appendOutputToHistory(historyItem.ptyId || taskId, content, outputType);
      } else {
        // Buffer output if history item doesn't exist yet
        if (!outputBuffer.value[taskId]) {
          outputBuffer.value[taskId] = [];
        }
        outputBuffer.value[taskId].push({ content, outputType: type });
      }
    }
  );

  unlistenSshProcessStarted = await appStore.safeListen(
    "ssh-process-started",
    async (event: any) => {
      const { taskId, pid } = event.payload;
      console.log(`[FRONTEND] SSH process started - Task ID: ${taskId}, PID: ${pid}`);
      
      const historyItem = runConfigStore.history.find(
        (item) => item.configId === taskId || item.ptyId === taskId
      );

      if (historyItem) {
        runConfigStore.updateHistory(historyItem.id, {
          pid,
          ptyId: taskId, // Use taskId as ptyId for SSH tasks
        });
      }
    }
  );

  unlistenSshProcessFinished = await appStore.safeListen(
    "ssh-process-finished",
    async (event: any) => {
      const { taskId, exitCode } = event.payload;
      console.log(`[FRONTEND] SSH process finished - Task ID: ${taskId}, Exit Code: ${exitCode}`);
      
      const historyItem = runConfigStore.history.find(
        (item) => item.configId === taskId || item.ptyId === taskId
      );

      if (historyItem) {
        const historyStatus: "running" | "success" | "error" =
          exitCode === 0 || exitCode === null ? "success" : "error";

        const endTime = Date.now();
        const duration = historyItem.startTime
          ? endTime - historyItem.startTime
          : 0;

        runConfigStore.updateHistory(historyItem.id, {
          status: historyStatus,
          duration: duration,
        });

        // Update selected history item if it's the same
        if (uiStore.selectedHistoryItem?.id === historyItem.id) {
          uiStore.selectedHistoryItem.status = historyStatus;
          uiStore.selectedHistoryItem.duration = duration;
        }

        // Notify taskManager that task has exited
        if (historyItem.configId) {
          try {
            const { useTaskManagerStore } = await import('./stores/taskManager');
            const taskManager = useTaskManagerStore();
            taskManager.onTaskExit(taskId);
          } catch (error) {
            console.error('[App] Failed to notify taskManager:', error);
          }
        }
      }
    }
  );

  unlistenSshError = await appStore.safeListen(
    "ssh-error",
    async (event: any) => {
      const { taskId, message } = event.payload;
      console.error(`[FRONTEND] SSH error - Task ID: ${taskId}, Message: ${message}`);
      
      const historyItem = runConfigStore.history.find(
        (item) => item.configId === taskId || item.ptyId === taskId
      );

      if (historyItem) {
        runConfigStore.updateHistory(historyItem.id, {
          status: "error",
          output: (historyItem.output || "") + `[SSH ERROR] ${message}\n`,
        });
      }
    }
  );

  // Start process monitoring
  startProcessMonitoring();

  // Initialize tray menu service for dynamic tray menu updates
  await initTrayService();

  // Initialize system tray context menu
  // Note: Tray is now created in Rust backend for better stability on macOS
  // Uncomment the line below if you want dynamic tray menus managed by frontend
  // setupSystemTrayMenu(runConfigStore);
});

// Clean up event listeners on unmount
onUnmounted(() => {
  // Remove ResizeObserver error handler
  window.removeEventListener("error", resizeObserverErrorHandler);

  // Unregister directory picker
  unregisterDirectoryPicker();

  if (unlistenOutput) unlistenOutput();
  if (unlistenStarted) unlistenStarted();
  if (unlistenStopped) unlistenStopped();
  if (unlistenPtyExit) unlistenPtyExit();
  if (unlistenSshOutput) unlistenSshOutput();
  if (unlistenSshProcessStarted) unlistenSshProcessStarted();
  if (unlistenSshProcessFinished) unlistenSshProcessFinished();
  if (unlistenSshError) unlistenSshError();

  // Stop process monitoring
  stopProcessMonitoring();

  // Cleanup tray service
  cleanupTrayService();
});
</script>

<style scoped>
/* About Dialog */
.about-modal :deep(.n-card-header) {
  padding: 12px 20px;
}

.about-modal :deep(.n-card__content) {
  padding: 20px;
}

.about-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.about-logo {
  width: 64px;
  height: 64px;
  margin-bottom: 12px;
}

.about-name {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--n-text-color-1);
}

.about-version {
  font-size: 13px;
  color: var(--n-text-color-3);
  margin-bottom: 12px;
}

.about-description {
  font-size: 13px;
  color: var(--n-text-color-2);
  margin: 0 0 16px 0;
  line-height: 1.6;
}

.about-links {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.about-copyright {
  font-size: 11px;
  color: var(--n-text-color-3);
}
</style>
