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
        v-model:show="showConfigDialog"
        :config="editingConfig"
        @saved="(configData: any) => { 
          handleConfigSaved(configData, { value: editingConfig }, runConfigStore, () => { 
            editingConfig = null; 
            showConfigDialog = false; 
          })
        }"
      />
      <n-layout class="h-screen app-window">
        <!-- Custom Title Bar -->
        <div class="custom-titlebar" @mousedown="startDrag">
          <div class="titlebar-content">
            <!-- Window controls (macOS style on the left) -->
            <div class="window-controls">
              <button
                class="window-control-button close-btn"
                @click="closeWindow"
                title="关闭"
              >
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path
                    d="M1 1l8 8M9 1l-8 8"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
              <button
                class="window-control-button minimize-btn"
                @click="minimizeWindow"
                title="最小化"
              >
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <rect
                    x="1"
                    y="4.5"
                    width="8"
                    height="1"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <button
                class="window-control-button maximize-btn"
                @click="toggleMaximize"
                title="最大化"
              >
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <rect
                    x="1"
                    y="1"
                    width="8"
                    height="8"
                    stroke="currentColor"
                    stroke-width="1"
                    fill="none"
                  />
                </svg>
              </button>
            </div>

            <!-- Title only -->
            <div class="titlebar-center">
              <img
                :src="effectiveTheme === 'light' ? '/text.svg' : '/text.svg'"
                alt="Rebebuca"
                :class="
                  effectiveTheme === 'light'
                    ? 'text-logo-light'
                    : 'text-logo-dark'
                "
                class="title-logo"
              />
            </div>

            <!-- Right buttons -->
            <div class="titlebar-right">
              <n-dropdown
                :options="themeOptions"
                @select="handleThemeSelect"
                trigger="click"
              >
                <n-button
                  text
                  size="small"
                  class="titlebar-button"
                  :title="t('titlebar.toggleTheme')"
                >
                  <template #icon>
                    <component
                      :is="
                        effectiveTheme === 'light'
                          ? iconComponents.sun
                          : iconComponents.moon
                      "
                    />
                  </template>
                </n-button>
              </n-dropdown>
              <n-button
                text
                size="small"
                @click="toggleSidebar"
                class="titlebar-button"
                :title="t('titlebar.toggleSidebar')"
              >
                <template #icon>
                  <component :is="iconComponents.sidebar" />
                </template>
              </n-button>
              <n-button
                text
                size="small"
                @click="toggleHistoryPanel"
                class="titlebar-button"
                :title="t('titlebar.toggleHistory')"
              >
                <template #icon>
                  <component :is="iconComponents.historyPanel" />
                </template>
              </n-button>
            </div>
          </div>
        </div>

        <n-layout has-sider class="main-layout">
          <!-- Left sidebar - Run configurations -->
          <n-layout-sider
            v-show="sidebarVisible"
            bordered
            :width="280"
            class="sidebar-layout"
          >
            <n-space vertical class="h-full p-6">
              <!-- Logo and New Config Button -->
              <div class="config-header-container">
                <div class="config-header-content">
                  <!-- Logo and New Config Button in one row -->
                  <div class="header-row">
                    <!-- Logo -->
                    <img
                      :src="
                        effectiveTheme === 'light'
                          ? '/logo.svg'
                          : '/logo-dark.svg'
                      "
                      alt="Logo"
                      class="logo-image"
                    />
                    <!-- New Config Button -->
                    <n-button
                      type="default"
                      @click="
                        () =>
                          handleNewConfig(
                            { value: editingConfig },
                            { value: showConfigDialog }
                          )
                      "
                      id="new-config-button"
                    >
                      {{ t("sidebar.newConfig") }}
                    </n-button>
                  </div>
                </div>
              </div>
              <!-- Run configuration list -->
              <n-scrollbar class="flex-1">
                <n-list class="mt-6">
                  <n-list-item
                    v-for="config in runConfigs"
                    :key="config.id"
                    class="config-list-item"
                  >
                    <div class="config-item-content">
                      <!-- Icon and main content -->
                      <div class="config-main-row">
                        <!-- Program icon -->
                        <div class="config-icon">
                          <div class="program-icon">
                            {{ getProgramIcon(config.command) }}
                          </div>
                        </div>

                        <!-- Config info -->
                        <div class="config-info">
                          <div class="config-header">
                            <span class="config-name">{{ config.name }}</span>
                            <div class="config-actions">
                              <n-button
                                size="small"
                                text
                                @click="
                                  () =>
                                    handleRunConfig(
                                      config,
                                      runConfigStore,
                                      addTab
                                    )
                                "
                                class="action-button run-button"
                              >
                                <template #icon>
                                  <component :is="iconComponents.play" />
                                </template>
                              </n-button>
                              <n-button
                                size="small"
                                text
                                @click="
                                  () =>
                                    handleEditConfig(
                                      config,
                                      { value: editingConfig },
                                      { value: showConfigDialog }
                                    )
                                "
                                class="action-button edit-button"
                              >
                                <template #icon>
                                  <component :is="iconComponents.edit" />
                                </template>
                              </n-button>
                            </div>
                          </div>
                          <n-text depth="3" class="config-command">{{
                            config.command
                          }}</n-text>
                        </div>
                      </div>
                    </div>
                  </n-list-item>
                </n-list>
              </n-scrollbar>
            </n-space>
          </n-layout-sider>

          <!-- Main content -->
          <n-layout-content class="main-content">
            <!-- Console output area -->
            <div class="console-area">
              <!-- Welcome screen when no tabs are present -->
              <div
                v-if="consoleTabs.length === 0"
                class="welcome-screen-container"
              >
                <div class="welcome-screen">
                  <div class="welcome-logo-container">
                    <img
                      :src="
                        effectiveTheme === 'light'
                          ? '/logo.svg'
                          : '/logo-dark.svg'
                      "
                      alt="Rebebuca"
                      class="welcome-logo"
                    />
                  </div>
                  <h2 class="welcome-title">
                    {{ t("welcome.title") }}
                  </h2>
                  <p class="welcome-description">
                    {{ t("welcome.description") }}
                  </p>
                  <div class="welcome-features">
                    <div class="feature-card">
                      <h3 class="feature-title">
                        {{ t("welcome.quickStart.title") }}
                      </h3>
                      <p class="feature-description">
                        {{ t("welcome.quickStart.description") }}
                      </p>
                    </div>
                    <div class="feature-card">
                      <h3 class="feature-title">
                        {{ t("welcome.efficientExecution.title") }}
                      </h3>
                      <p class="feature-description">
                        {{ t("welcome.efficientExecution.description") }}
                      </p>
                    </div>
                    <div class="feature-card">
                      <h3 class="feature-title">
                        {{ t("welcome.configManagement.title") }}
                      </h3>
                      <p class="feature-description">
                        {{ t("welcome.configManagement.description") }}
                      </p>
                    </div>
                    <div class="feature-card">
                      <h3 class="feature-title">
                        {{ t("welcome.history.title") }}
                      </h3>
                      <p class="feature-description">
                        {{ t("welcome.history.description") }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tabs area -->
              <n-tabs
                v-else
                type="card"
                :closable="false"
                v-model:value="activeTabId"
                class="console-tabs"
              >
                <n-tab-pane
                  v-for="tab in consoleTabs"
                  :key="tab.id"
                  :name="tab.id"
                  class="tab-pane-full-height"
                >
                  <template #tab>
                    <div class="flex items-center gap-2 tab-header">
                      <component
                        :is="iconComponents.statusIndicator"
                        :style="{ color: getTabStatusColor(tab) }"
                      />
                      <span class="tab-name">{{ tab.name }}</span>
                      <n-button
                        size="tiny"
                        text
                        @click.stop="handleTabClose(tab.id)"
                        class="tab-close-button"
                      >
                        <template #icon>
                          <component :is="iconComponents.close" />
                        </template>
                      </n-button>
                    </div>
                  </template>

                  <div class="tab-content-wrapper">
                    <!-- Tab toolbar -->
                    <n-space class="mb-2 tab-toolbar" size="small">
                      <!-- 重放/运行按钮 -->
                      <n-button
                        size="small"
                        text
                        @click="handleRestartTab(tab)"
                      >
                        <template #icon>
                          <component :is="iconComponents.replay" />
                        </template>
                      </n-button>

                      <!-- 停止按钮 -->
                      <n-button size="small" text @click="handleStopTab(tab)">
                        <template #icon>
                          <component
                            :is="iconComponents.stop(tab.status === 'running')"
                          />
                        </template>
                      </n-button>

                      <!-- 下载/导出按钮 -->
                      <n-button size="small" text @click="handleExportTab(tab)">
                        <template #icon>
                          <component :is="iconComponents.export" />
                        </template>
                      </n-button>

                      <!-- 清空按钮 -->
                      <n-button
                        size="small"
                        text
                        @click="handleClearTab(tab, t)"
                      >
                        <template #icon>
                          <component :is="iconComponents.clear" />
                        </template>
                      </n-button>

                      <!-- 命令行内容显示 -->
                      <n-text depth="3" class="command-display">
                        {{ getTabCommand(tab, runConfigStore.getConfig) }}
                      </n-text>
                    </n-space>

                    <!-- Console output -->
                    <div class="console-output-container">
                      <n-scrollbar
                        class="console-scrollbar"
                        :ref="(el: any) => scrollbarRefs[tab.id] = el"
                      >
                        <pre
                          class="console-output"
                          v-html="convertAnsiToHtml(tab.output, ansiConverter)"
                        ></pre>
                      </n-scrollbar>
                    </div>
                  </div>
                </n-tab-pane>
              </n-tabs>
            </div>
          </n-layout-content>

          <!-- Right sidebar - Run history -->
          <n-layout-sider
            v-show="historyPanelVisible"
            bordered
            :width="280"
            class="sidebar-layout"
            placement="right"
          >
            <n-space vertical class="h-full p-6">
              <div class="history-header-container">
                <div class="history-header-content">
                  <div class="history-header-text">
                    <h3 class="history-title">{{ t("history.title") }}</h3>
                  </div>
                  <div class="history-actions">
                    <n-button size="small" text @click="handleOpenLogsFolder">
                      <template #icon>
                        <component :is="iconComponents.file" />
                      </template>
                    </n-button>
                    <n-button size="small" text @click="handleClearHistory">
                      <template #icon>
                        <component :is="iconComponents.clear" />
                      </template>
                    </n-button>
                  </div>
                </div>
              </div>

              <!-- Run history list -->
              <n-scrollbar class="flex-1">
                <div v-if="runHistory.length > 0" class="history-list">
                  <n-list class="history-items">
                    <n-list-item
                      v-for="(item, index) in runHistory"
                      :key="index"
                      class="history-list-item"
                      @click="handleViewHistory(item)"
                    >
                      <div class="history-item-content">
                        <!-- Icon and main content -->
                        <div class="history-main-row">
                          <!-- Program icon with status dot -->
                          <div class="history-icon">
                            <div class="program-icon">
                              {{ getProgramIcon(item.command) }}
                            </div>
                            <!-- Status dot in top-right corner -->
                            <div
                              class="status-dot"
                              :style="{
                                backgroundColor: getHistoryStatusColor(item),
                              }"
                            ></div>
                          </div>

                          <!-- History info -->
                          <div class="history-info">
                            <div class="history-header">
                              <div class="history-name-row">
                                <span class="history-name">{{
                                  item.name
                                }}</span>
                              </div>
                              <div class="history-actions" @click.stop>
                                <n-button
                                  size="small"
                                  text
                                  @click="handleReRunHistory(item)"
                                  class="action-button rerun-button"
                                >
                                  <template #icon>
                                    <component
                                      :is="iconComponents.replayHistory"
                                    />
                                  </template>
                                </n-button>
                                <n-button
                                  size="small"
                                  text
                                  @click="
                                    () =>
                                      removeHistoryItem(index, runConfigStore)
                                  "
                                  class="action-button delete-button"
                                >
                                  <template #icon>
                                    <component :is="iconComponents.delete" />
                                  </template>
                                </n-button>
                              </div>
                            </div>
                            <n-text depth="3" class="history-time">
                              {{ formatTime(item.timestamp) }}
                            </n-text>
                          </div>
                        </div>
                      </div>
                    </n-list-item>
                  </n-list>
                </div>
                <div v-else class="empty-history">
                  <div class="text-center py-12 text-gray-500">
                    {{ t("history.empty") }}
                  </div>
                </div>
              </n-scrollbar>
            </n-space>
          </n-layout-sider>
        </n-layout>
      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  inject,
  nextTick,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";
// Safe window functions that handle browser environment
import {
  NMessageProvider,
  NConfigProvider,
  NTabs,
  NTabPane,
  NLayout,
  NLayoutSider,
  NLayoutContent,
  NSpace,
  NButton,
  NScrollbar,
  NList,
  NListItem,
  NText,
  NDropdown,
  createDiscreteApi,
} from "naive-ui";
import { useRunConfigStore, type RunConfig } from "./stores/runConfig";
import RunConfigDialog from "./components/RunConfigDialog.vue";
import { useTheme } from "./composables/useTheme";
import { type UnlistenFn } from "@tauri-apps/api/event";
// 导入窗口控制函数
import {
  minimizeWindow,
  toggleMaximize,
  closeWindow,
  startDrag,
} from "./utils/windowControls";
// 导入图标组件
import { iconComponents } from "./utils/icons";
// 导入标签页工具函数
import {
  getTabStatusColor,
  getHistoryStatusColor,
  getTabCommand,
} from "./utils/tabUtils";
// 导入程序图标工具函数
import { getProgramIcon } from "./utils/programUtils";
// 导入 ANSI 工具函数
import { createAnsiConverter, convertAnsiToHtml } from "./utils/ansiUtils";
// 导入时间格式化工具函数
import { formatTime } from "./utils/timeUtils";
// 导入历史记录工具函数
import { removeHistoryItem } from "./utils/historyUtils";
// 导入标签页操作工具函数
import {
  scrollToBottom,
  handleExportTab,
  handleClearTab,
} from "./utils/tabOperations";
// 导入对话框工具函数
import {
  showClearHistoryDialog,
  showCloseTabDialog,
} from "./utils/dialogUtils";
// 导入主题工具函数
import { forceThemeOnFloatingComponents } from "./utils/themeUtils";
// 导入配置工具函数
import {
  handleConfigSaved,
  handleEditConfig,
  handleNewConfig,
  handleRunConfig,
} from "./utils/configUtils";

// Get hljs from main.ts
const hljs = inject<any>("hljs");

// Check if running in Tauri environment
let _isTauri: boolean | null = null;

const isTauri = () => {
  // Cache the result to avoid repeated checks
  if (_isTauri !== null) {
    return _isTauri;
  }

  try {
    // Method 1: Check for Tauri globals
    if (typeof window !== "undefined") {
      if (
        (window as any).__TAURI__ ||
        (window as any).__TAURI_INTERNALS__ ||
        (window as any).__TAURI_METADATA__
      ) {
        _isTauri = true;
        return true;
      }
    }

    // Method 2: Check user agent
    if (
      typeof navigator !== "undefined" &&
      navigator.userAgent.includes("Tauri")
    ) {
      _isTauri = true;
      return true;
    }

    // Method 3: Check for webview environment (common in Tauri)
    if (
      typeof window !== "undefined" &&
      (window as any).chrome &&
      (window as any).chrome.runtime
    ) {
      _isTauri = true;
      return true;
    }

    _isTauri = false;
    return false;
  } catch (error) {
    _isTauri = false;
    return false;
  }
};

// Safe listen function that handles browser environment
const safeListen = async (event: string, handler: (event: any) => void) => {
  if (!isTauri()) {
    // Silent fallback in browser environment
    return () => {}; // Return empty unlisten function
  }

  try {
    const { listen } = await import("@tauri-apps/api/event");
    return await listen(event, handler);
  } catch (error) {
    console.error(`Failed to listen to '${event}':`, error);
    return () => {}; // Return empty unlisten function
  }
};

// Safe sendNotification function that handles browser environment
const safeSendNotification = async (options: {
  title: string;
  body: string;
}) => {
  if (!isTauri()) {
    // Silent fallback in browser environment
    return;
  }

  try {
    const { sendNotification } = await import(
      "@tauri-apps/plugin-notification"
    );
    await sendNotification(options);
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
};



// i18n
const { t } = useI18n();

// Theme
const { currentTheme, setThemeMode, effectiveTheme, themeMode, systemTheme } =
  useTheme();

// Environment detection is working correctly

// Create discrete API for dialog
const { dialog } = createDiscreteApi(["dialog"], {
  configProviderProps: {
    theme: currentTheme.value,
  },
});

// Initialize ANSI converter
let ansiConverter = createAnsiConverter(effectiveTheme.value === "light");

// Watch theme changes and recreate ANSI converter
watch(
  effectiveTheme,
  (newTheme) => {
    ansiConverter = createAnsiConverter(newTheme === "light");
    // Also force theme on floating components when theme changes
    forceThemeOnFloatingComponents(effectiveTheme.value, nextTick);
  },
  { immediate: false }
);

// State management
const runConfigStore = useRunConfigStore();
const sidebarVisible = ref(true);
const historyPanelVisible = ref(true);

// Toggle sidebar visibility
const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value;
};

// Toggle history panel visibility
const toggleHistoryPanel = () => {
  historyPanelVisible.value = !historyPanelVisible.value;
};

// Handle theme selection
const handleThemeSelect = (key: string) => {
  setThemeMode(key as "light" | "dark" | "system");

  // Force update the config provider class
  nextTick(() => {
    const configProvider = document.querySelector(".n-config-provider");
    if (configProvider) {
      // Remove existing theme classes
      configProvider.classList.remove(
        "n-config-provider--light",
        "n-config-provider--dark"
      );

      // Determine the effective theme
      let effectiveTheme = key;
      if (key === "system") {
        // When selecting system theme, use current system theme
        effectiveTheme = systemTheme.value;
      }

      // Add the correct theme class
      if (effectiveTheme === "light") {
        configProvider.classList.add("n-config-provider--light");
      } else {
        configProvider.classList.add("n-config-provider--dark");
      }
    }
  });
};

// Computed properties
const runConfigs = computed(() => runConfigStore.configs);
const runHistory = computed(() => runConfigStore.history);

// Theme options for dropdown
const themeOptions = computed(() => [
  {
    label: t("theme.light"),
    key: "light",
    icon: iconComponents.sun,
  },
  {
    label: t("theme.dark"),
    key: "dark",
    icon: iconComponents.moon,
  },
  {
    label: t("theme.system"),
    key: "system",
    icon: iconComponents.system,
  },
]);

// Tab management
interface Tab {
  id: string;
  name: string;
  output: string;
  configId?: string;
  processId?: string;
  historyId?: string;
  status: "idle" | "running" | "success" | "error";
  hasError: boolean; // Track if tab has received stderr output
}

const consoleTabs = ref<Tab[]>([]);
const activeTabId = ref<string | undefined>(undefined);
const scrollbarRefs = ref<Record<string, any>>({});
const tabClosingId = ref<string | null>(null); // Track tab being closed for confirmation

// Buffer for outputs received before tab is created
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

// Dialog state
const showConfigDialog = ref(false);
const editingConfig = ref<RunConfig | null>(null);

// Tab management methods
const addTab = (config: RunConfig, processId: string, historyId?: string) => {
  const tabId = `tab-${config.id}-${Date.now()}`;

  // Find all tabs with the same config ID and extract their numbers
  const sameConfigTabs = consoleTabs.value.filter(
    (tab) => tab.configId === config.id
  );

  let tabName = config.name;

  if (sameConfigTabs.length > 0) {
    // Extract all existing numbers from tab names
    const existingNumbers: number[] = [];
    sameConfigTabs.forEach((tab) => {
      const match = tab.name.match(/\((\d+)\)$/);
      if (match) {
        existingNumbers.push(parseInt(match[1], 10));
      }
    });

    // Find the max number and increment it, or start with 2 if no numbers exist
    const maxNumber =
      existingNumbers.length > 0 ? Math.max(...existingNumbers) : 1;
    tabName = `${config.name} (${maxNumber + 1})`;
  }

  const newTab: Tab = {
    id: tabId,
    name: tabName,
    output: `> ${t("console.preparing")}: ${config.command}\n`,
    configId: config.id,
    processId: processId,
    historyId: historyId,
    status: "running",
    hasError: false,
  };

  // Apply any buffered outputs for this process
  if (outputBuffer.value[processId]) {
    for (const buffered of outputBuffer.value[processId]) {
      if (buffered.outputType === "stderr") {
        newTab.output += `[ERROR] ${buffered.content}`;
        newTab.hasError = true;
      } else {
        newTab.output += buffered.content;
      }
    }
    // Clear the buffer
    delete outputBuffer.value[processId];
  }

  consoleTabs.value.push(newTab);
  activeTabId.value = tabId;
  return newTab;
};

// Find tab by process ID
const findTabByProcessId = (processId: string) => {
  return consoleTabs.value.find((tab) => tab.processId === processId);
};

// Append output to tab with type distinction
const appendOutputToTab = (
  processId: string,
  content: string,
  outputType: "stdout" | "stderr" | "system"
) => {
  const tab = findTabByProcessId(processId);
  if (tab) {
    // Mark stderr output with special prefix
    if (outputType === "stderr") {
      tab.output += `[ERROR] ${content}`;
      tab.hasError = true;
    } else {
      tab.output += content;
    }
    // Auto scroll to bottom
    scrollToBottom(tab.id, scrollbarRefs.value);
  } else {
    // Tab doesn't exist yet - buffer the output
    if (!outputBuffer.value[processId]) {
      outputBuffer.value[processId] = [];
    }
    outputBuffer.value[processId].push({ content, outputType });
  }
};

// Update tab status
const updateTabStatus = (
  processId: string,
  status: "idle" | "running" | "success" | "error"
) => {
  const tab = findTabByProcessId(processId);
  if (tab) {
    tab.status = status;
  }
};

// Restart tab
const handleRestartTab = async (tab: Tab) => {
  if (tab.configId) {
    const config = runConfigStore.getConfig(tab.configId);
    if (config) {
      try {
        // Stop current process if running
        if (tab.processId) {
          try {
            await runConfigStore.stopCurrentRun(tab.processId);
          } catch (error) {
            console.log("No process to stop or stop failed:", error);
          }
        }

        // Clear the current tab output and reset status
        tab.output = `> ${t("console.restarting")}\n`;
        tab.status = "running";
        tab.hasError = false;

        // Execute command and get new process ID and history ID
        const { processId, historyId } = await runConfigStore.executeCommand(
          config
        );

        // Clear any buffered output for the old process ID
        if (tab.processId && outputBuffer.value[tab.processId]) {
          delete outputBuffer.value[tab.processId];
        }

        // Update the current tab with new process ID and history ID
        tab.processId = processId;
        tab.historyId = historyId;
      } catch (error) {
        console.error("Failed to restart command:", error);
        tab.output += `> ${t("console.restartFailed")}: ${error}\n`;
        tab.status = "error";
        tab.hasError = true;
      }
    }
  }
};

// Stop tab
const handleStopTab = async (tab: Tab) => {
  if (tab.processId) {
    try {
      await runConfigStore.stopCurrentRun(tab.processId);
      tab.output += `> ${t("console.stopping")}\n`;

      // Update history with output when manually stopped
      if (tab.historyId) {
        await runConfigStore.updateHistory(tab.historyId, {
          status: "success",
          output: tab.output,
        });
      }
    } catch (error) {
      tab.output += `> ${t("console.stopFailed")}: ${error}\n`;
      tab.status = "error";

      // Update history with error output
      if (tab.historyId) {
        await runConfigStore.updateHistory(tab.historyId, {
          status: "error",
          output: tab.output,
        });
      }
    }
  }
};

const handleTabClose = (tabId: string) => {
  // If this tab is already being closed, prevent duplicate dialogs
  if (tabClosingId.value === tabId) {
    return;
  }

  const index = consoleTabs.value.findIndex((tab) => tab.id === tabId);
  if (index !== -1) {
    const tab = consoleTabs.value[index];

    // Function to actually close the tab
    const closeTab = async () => {
      // If process is running, stop it first
      if (tab.processId && tab.status === "running") {
        try {
          await runConfigStore.stopCurrentRun(tab.processId);

          // Update history with stopped status
          if (tab.historyId) {
            await runConfigStore.updateHistory(tab.historyId, {
              status: "success",
              output: tab.output + `\n> ${t("console.stopping")}\n`,
            });
          }
        } catch (error) {
          console.error("Failed to stop process:", error);
        }
      }

      // Close the tab
      const currentIndex = consoleTabs.value.findIndex((t) => t.id === tabId);
      if (currentIndex !== -1) {
        consoleTabs.value.splice(currentIndex, 1);
        if (activeTabId.value === tabId) {
          activeTabId.value =
            consoleTabs.value.length > 0 ? consoleTabs.value[0].id : undefined;
        }
      }

      // Reset closing flag
      tabClosingId.value = null;
    };

    // Only show confirmation if process is still running
    if (tab.status === "running") {
      // Mark this tab as being closed
      tabClosingId.value = tabId;

      // Show confirmation dialog
      showCloseTabDialog(dialog, t, closeTab, () => {
        tabClosingId.value = null;
      });
    } else {
      // Directly close if not running
      closeTab();
    }
  }
};

// View history in a new tab
const handleViewHistory = (history: any) => {
  // First, check if there's a running tab for this configuration
  const runningTab = consoleTabs.value.find(
    (tab) => tab.configId === history.configId && tab.status === "running"
  );

  // If there's a running tab for this config, focus it instead of creating new one
  if (runningTab) {
    activeTabId.value = runningTab.id;
    return;
  }

  // Check if a tab for this history already exists
  const existingTab = consoleTabs.value.find(
    (tab) => tab.historyId === history.id
  );

  // If tab exists, just focus it
  if (existingTab) {
    activeTabId.value = existingTab.id;
    return;
  }

  // Otherwise, create a new tab
  const tabId = `history-${history.id}-${Date.now()}`;
  const hasErrorOutput = history.output && history.output.includes("[ERROR]");
  const newTab: Tab = {
    id: tabId,
    name: `${history.name} (${t("tab.history")})`,
    output:
      history.output ||
      `> ${t("history.historyRecord")}\n> ${t("history.config")}: ${
        history.name
      }\n> ${t("history.command")}: ${history.command}\n> ${t(
        "history.time"
      )}: ${formatTime(history.timestamp)}\n\n${t("console.noOutput")}\n`,
    configId: history.configId, // Add configId so restart works
    historyId: history.id, // Store historyId to find existing tabs
    status:
      history.status === "success"
        ? "success"
        : history.status === "error"
        ? "error"
        : "idle",
    hasError: hasErrorOutput || history.status === "error",
  };

  consoleTabs.value.push(newTab);
  activeTabId.value = tabId;
};

// Re-run from history
const handleReRunHistory = async (history: any) => {
  const config = runConfigs.value.find((c) => c.id === history.configId);
  if (config) {
    await handleRunConfig(config, runConfigStore, addTab);
  } else {
    const currentTab = consoleTabs.value.find(
      (tab) => tab.id === activeTabId.value
    );
    if (currentTab) {
      currentTab.output += `> ${t("history.configNotFound")}\n`;
    }
  }
};

const handleClearHistory = () => {
  showClearHistoryDialog(
    dialog,
    t,
    runConfigStore,
    forceThemeOnFloatingComponents,
    effectiveTheme.value,
    nextTick
  );
};

const handleOpenLogsFolder = async () => {
  try {
    await runConfigStore.openLogsFolder();
  } catch (error) {
    console.error("Failed to open logs folder:", error);
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
  // Suppress ResizeObserver errors
  suppressResizeObserverError();

  // Add global error handler for ResizeObserver
  window.addEventListener("error", resizeObserverErrorHandler);

  // Listen for process output
  unlistenOutput = await safeListen("process-output", async (event) => {
    const { process_id, content, output_type } = event.payload;
    appendOutputToTab(process_id, content, output_type);

    // Send system notification for stderr
    if (output_type === "stderr") {
      const tab = findTabByProcessId(process_id);
      if (tab) {
        try {
          safeSendNotification({
            title: `${t("error.title")}: ${tab.name}`,
            body: content.trim().substring(0, 100), // Limit notification content
          });
        } catch (error) {
          console.error("Failed to send notification:", error);
        }
      }
    }
  });

  // Listen for process started
  unlistenStarted = await safeListen("process-started", (event: any) => {
    const { process_id } = event.payload;
    updateTabStatus(process_id, "running");
  });

  // Listen for process stopped
  unlistenStopped = await safeListen("process-stopped", async (event: any) => {
    const { process_id, status } = event.payload;
    const tabStatus = status === "stopped" ? "success" : "error";
    updateTabStatus(process_id, tabStatus);

    // Find the tab and update history with output
    const tab = findTabByProcessId(process_id);
    if (tab && tab.historyId) {
      await runConfigStore.updateHistory(tab.historyId, {
        status: tabStatus,
        output: tab.output,
      });
    }
  });

  // Force theme on floating components after initialization
  forceThemeOnFloatingComponents(effectiveTheme.value, nextTick);
});

// Clean up event listeners on unmount
onUnmounted(() => {
  // Remove ResizeObserver error handler
  window.removeEventListener("error", resizeObserverErrorHandler);

  if (unlistenOutput) unlistenOutput();
  if (unlistenStarted) unlistenStarted();
  if (unlistenStopped) unlistenStopped();
});
</script>
