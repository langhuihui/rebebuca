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
  <n-config-provider :theme="darkTheme" :hljs="hljs">
    <n-message-provider>
      <!-- Run configuration dialog -->
      <RunConfigDialog
        v-model:show="showConfigDialog"
        :config="editingConfig"
        @saved="handleConfigSaved"
      />
      <n-layout has-sider class="h-screen">
        <!-- Left sidebar - Run configurations -->
        <n-layout-sider
          bordered
          collapse-mode="width"
          :collapsed-width="64"
          :width="280"
          :collapsed="collapsed"
          show-trigger
          @collapse="collapsed = true"
          @expand="collapsed = false"
        >
          <n-space vertical class="h-full p-6">
            <!-- Logo and title area -->
            <div
              style="
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 20px;
                padding: 16px;
                background-color: rgba(255, 255, 255, 0.05);
                border-radius: 12px;
              "
            >
              <img
                src="/logo-dark.svg"
                alt="Logo"
                style="width: 32px; height: 32px"
              />
              <div style="flex: 1">
                <h3
                  style="
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: white;
                  "
                >
                  Rebebuca
                </h3>
                <p
                  style="
                    margin: 4px 0 0 0;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.6);
                  "
                >
                  管理你的运行配置
                </p>
              </div>
              <n-button size="small" text @click="handleNewConfig">
                <template #icon>
                  <n-icon size="20">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="16"></line>
                      <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                  </n-icon>
                </template>
              </n-button>
            </div>

            <!-- Run configuration list -->
            <n-scrollbar class="flex-1">
              <n-list class="mt-6">
                <n-list-item
                  v-for="config in runConfigs"
                  :key="config.id"
                  style="
                    margin-bottom: 16px;
                    padding: 12px;
                    border-radius: 8px;
                    background-color: rgba(255, 255, 255, 0.03);
                  "
                >
                  <div class="w-full">
                    <div
                      style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        width: 100%;
                        margin-bottom: 8px;
                      "
                    >
                      <span
                        style="
                          flex: 1;
                          margin-right: 20px;
                          font-size: 14px;
                          font-weight: 500;
                          overflow: hidden;
                          text-overflow: ellipsis;
                          white-space: nowrap;
                        "
                        >{{ config.name }}</span
                      >
                      <div style="display: flex; gap: 8px; flex-shrink: 0">
                        <n-button
                          size="small"
                          text
                          @click="handleRunConfig(config)"
                        >
                          <template #icon>
                            <n-icon size="18" color="#10b981">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                              </svg>
                            </n-icon>
                          </template>
                        </n-button>
                        <n-button
                          size="small"
                          text
                          @click="handleEditConfig(config)"
                        >
                          <template #icon>
                            <n-icon size="18">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <path
                                  d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                                ></path>
                                <path
                                  d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                                ></path>
                              </svg>
                            </n-icon>
                          </template>
                        </n-button>
                      </div>
                    </div>
                    <n-text depth="3" class="text-xs block">{{
                      config.command
                    }}</n-text>
                  </div>
                </n-list-item>
              </n-list>
            </n-scrollbar>
          </n-space>
        </n-layout-sider>

        <!-- Main content area -->
        <n-layout>
          <!-- Main content -->
          <n-layout-content class="p-6">
            <n-grid
              cols="1 s:1 m:3 l:3"
              responsive="screen"
              x-gap="16"
              y-gap="16"
            >
              <!-- Console output area -->
              <n-gi :span="2">
                <!-- Welcome screen when no tabs are present -->
                <div
                  v-if="consoleTabs.length === 0"
                  style="
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: rgba(0, 0, 0, 0.1);
                    border-radius: 12px;
                    border: 2px dashed rgba(255, 255, 255, 0.1);
                  "
                >
                  <div
                    style="text-align: center; max-width: 500px; padding: 40px"
                  >
                    <div style="margin-bottom: 24px">
                      <img
                        src="/logo-dark.svg"
                        alt="Rebebuca"
                        style="
                          width: 64px;
                          height: 64px;
                          opacity: 0.6;
                          margin-bottom: 16px;
                        "
                      />
                    </div>
                    <h2
                      style="
                        color: rgba(255, 255, 255, 0.8);
                        font-size: 24px;
                        font-weight: 600;
                        margin: 0 0 16px 0;
                      "
                    >
                      欢迎使用 Rebebuca
                    </h2>
                    <p
                      style="
                        color: rgba(255, 255, 255, 0.5);
                        font-size: 16px;
                        line-height: 1.6;
                        margin: 0 0 24px 0;
                      "
                    >
                      一个强大的运行配置管理工具，帮助你快速执行和管理各种命令和脚本。
                    </p>
                    <div
                      style="
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin-top: 32px;
                      "
                    >
                      <div
                        style="
                          text-align: left;
                          padding: 16px;
                          background-color: rgba(255, 255, 255, 0.03);
                          border-radius: 8px;
                        "
                      >
                        <h3
                          style="
                            color: rgba(255, 255, 255, 0.7);
                            font-size: 14px;
                            font-weight: 600;
                            margin: 0 0 8px 0;
                          "
                        >
                          🚀 快速开始
                        </h3>
                        <p
                          style="
                            color: rgba(255, 255, 255, 0.4);
                            font-size: 12px;
                            margin: 0;
                            line-height: 1.4;
                          "
                        >
                          点击左侧的"新建"按钮创建你的第一个运行配置
                        </p>
                      </div>
                      <div
                        style="
                          text-align: left;
                          padding: 16px;
                          background-color: rgba(255, 255, 255, 0.03);
                          border-radius: 8px;
                        "
                      >
                        <h3
                          style="
                            color: rgba(255, 255, 255, 0.7);
                            font-size: 14px;
                            font-weight: 600;
                            margin: 0 0 8px 0;
                          "
                        >
                          ⚡ 高效执行
                        </h3>
                        <p
                          style="
                            color: rgba(255, 255, 255, 0.4);
                            font-size: 12px;
                            margin: 0;
                            line-height: 1.4;
                          "
                        >
                          一键运行命令，实时查看输出结果
                        </p>
                      </div>
                      <div
                        style="
                          text-align: left;
                          padding: 16px;
                          background-color: rgba(255, 255, 255, 0.03);
                          border-radius: 8px;
                        "
                      >
                        <h3
                          style="
                            color: rgba(255, 255, 255, 0.7);
                            font-size: 14px;
                            font-weight: 600;
                            margin: 0 0 8px 0;
                          "
                        >
                          📝 配置管理
                        </h3>
                        <p
                          style="
                            color: rgba(255, 255, 255, 0.4);
                            font-size: 12px;
                            margin: 0;
                            line-height: 1.4;
                          "
                        >
                          支持工作目录、环境变量等高级配置
                        </p>
                      </div>
                      <div
                        style="
                          text-align: left;
                          padding: 16px;
                          background-color: rgba(255, 255, 255, 0.03);
                          border-radius: 8px;
                        "
                      >
                        <h3
                          style="
                            color: rgba(255, 255, 255, 0.7);
                            font-size: 14px;
                            font-weight: 600;
                            margin: 0 0 8px 0;
                          "
                        >
                          🕒 历史记录
                        </h3>
                        <p
                          style="
                            color: rgba(255, 255, 255, 0.4);
                            font-size: 12px;
                            margin: 0;
                            line-height: 1.4;
                          "
                        >
                          自动保存运行历史，方便重复执行
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Tabs area -->
                <n-tabs
                  v-else
                  type="card"
                  closable
                  @close="handleTabClose"
                  v-model:value="activeTabId"
                >
                  <n-tab-pane
                    v-for="tab in consoleTabs"
                    :key="tab.id"
                    :name="tab.id"
                  >
                    <template #tab>
                      <div class="flex items-center gap-1">
                        <n-icon size="12" :color="getTabStatusColor(tab)">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <circle cx="12" cy="12" r="6"></circle>
                          </svg>
                        </n-icon>
                        <span>{{ tab.name }}</span>
                      </div>
                    </template>
                    <!-- Tab toolbar -->
                    <n-space
                      class="mb-2"
                      size="small"
                      style="padding-left: 16px; margin-left: 0"
                    >
                      <!-- 重放/运行按钮 -->
                      <n-button
                        size="small"
                        text
                        @click="handleRestartTab(tab)"
                      >
                        <template #icon>
                          <n-icon>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <path
                                d="M19.8 16a9 9 0 1 1-7.8-13 9.75 9.75 0 0 1 6.74 2.74L21 8"
                              ></path>
                              <path d="M21 3v5h-5"></path>
                              <polygon
                                points="16 14 24 18 16 22 16 14"
                                stroke="#10b981"
                                fill="#10b981"
                              ></polygon>
                            </svg>
                          </n-icon>
                        </template>
                      </n-button>

                      <!-- 停止按钮 -->
                      <n-button size="small" text @click="handleStopTab(tab)">
                        <template #icon>
                          <n-icon>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              :fill="
                                tab.status === 'running' ? '#ef4444' : '#6b7280'
                              "
                            >
                              <rect
                                x="5"
                                y="5"
                                width="16"
                                height="16"
                                rx="1"
                              ></rect>
                            </svg>
                          </n-icon>
                        </template>
                      </n-button>

                      <!-- 下载/导出按钮 -->
                      <n-button size="small" text @click="handleExportTab(tab)">
                        <template #icon>
                          <n-icon>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <path d="M3 6h18"></path>
                              <path d="M3 12h18"></path>
                              <path d="M3 18h18"></path>
                              <path d="M12 15l3 3 3-3"></path>
                            </svg>
                          </n-icon>
                        </template>
                      </n-button>

                      <!-- 清空按钮 -->
                      <n-button size="small" text @click="handleClearTab(tab)">
                        <template #icon>
                          <n-icon>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <path d="M3 6h18"></path>
                              <path
                                d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
                              ></path>
                              <path
                                d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
                              ></path>
                            </svg>
                          </n-icon>
                        </template>
                      </n-button>
                    </n-space>

                    <!-- Console output -->
                    <div
                      style="
                        padding: 16px;
                        background-color: rgba(0, 0, 0, 0.3);
                        border-radius: 8px;
                        margin-top: 8px;
                      "
                    >
                      <n-scrollbar
                        style="max-height: 500px"
                        :ref="(el: any) => scrollbarRefs[tab.id] = el"
                      >
                        <pre
                          class="console-output"
                          v-html="convertAnsiToHtml(tab.output)"
                        ></pre>
                      </n-scrollbar>
                    </div>
                  </n-tab-pane>
                </n-tabs>
              </n-gi>

              <!-- Run history area -->
              <n-gi>
                <n-card size="small" style="padding: 0">
                  <template #header>
                    <div
                      style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        width: 100%;
                        padding: 8px 8px 4px 8px;
                      "
                    >
                      <span>运行历史</span>
                      <n-button size="small" text @click="handleClearHistory">
                        <template #icon>
                          <n-icon size="18">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <path d="M3 6h18"></path>
                              <path
                                d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
                              ></path>
                              <path
                                d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
                              ></path>
                            </svg>
                          </n-icon>
                        </template>
                      </n-button>
                    </div>
                  </template>
                  <div
                    v-if="runHistory.length > 0"
                    style="padding: 0 8px 8px 8px"
                  >
                    <n-list style="margin-top: 8px">
                      <n-list-item
                        v-for="(item, index) in runHistory"
                        :key="index"
                        style="
                          margin-bottom: 6px;
                          padding: 4px;
                          border-radius: 4px;
                          background-color: rgba(255, 255, 255, 0.02);
                          cursor: pointer;
                        "
                        @click="handleViewHistory(item)"
                      >
                        <div class="w-full">
                          <div
                            style="
                              display: flex;
                              justify-content: space-between;
                              align-items: center;
                              width: 100%;
                              margin-bottom: 6px;
                            "
                          >
                            <span
                              style="
                                flex: 1;
                                margin-right: 18px;
                                font-size: 13px;
                                font-weight: 500;
                                overflow: hidden;
                                text-overflow: ellipsis;
                                white-space: nowrap;
                              "
                              >{{ item.name }}</span
                            >
                            <div
                              style="display: flex; gap: 8px; flex-shrink: 0"
                              @click.stop
                            >
                              <n-button
                                size="small"
                                text
                                @click="handleReRunHistory(item)"
                              >
                                <template #icon>
                                  <n-icon size="16">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-width="2"
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                    >
                                      <path
                                        d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
                                      ></path>
                                      <path d="M3 3v5h5"></path>
                                    </svg>
                                  </n-icon>
                                </template>
                              </n-button>
                              <n-button
                                size="small"
                                text
                                @click="() => removeHistoryItem(index)"
                              >
                                <template #icon>
                                  <n-icon size="16">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-width="2"
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                    >
                                      <path d="M3 6h18"></path>
                                      <path
                                        d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
                                      ></path>
                                      <path
                                        d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
                                      ></path>
                                    </svg>
                                  </n-icon>
                                </template>
                              </n-button>
                            </div>
                          </div>
                          <n-text depth="3" class="text-xs block">
                            {{ formatTime(item.timestamp) }}
                          </n-text>
                        </div>
                      </n-list-item>
                    </n-list>
                  </div>
                  <div v-else style="padding: 16px">
                    <div class="text-center py-12 text-gray-500">
                      暂无运行历史
                    </div>
                  </div>
                </n-card>
              </n-gi>
            </n-grid>
          </n-layout-content>
        </n-layout>
      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject, nextTick } from "vue";
import {
  darkTheme,
  NMessageProvider,
  NConfigProvider,
  NTabs,
  NTabPane,
  NLayout,
  NLayoutSider,
  NLayoutContent,
  NSpace,
  NButton,
  NIcon,
  NScrollbar,
  NList,
  NListItem,
  NText,
  NGrid,
  NGi,
  NCard,
  createDiscreteApi,
} from "naive-ui";
import { useRunConfigStore, type RunConfig } from "./stores/runConfig";
import RunConfigDialog from "./components/RunConfigDialog.vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
// @ts-ignore - Tauri plugin types
import { sendNotification } from "@tauri-apps/plugin-notification";
import AnsiToHtml from "ansi-to-html";

// Get hljs from main.ts
const hljs = inject<any>("hljs");

// Create discrete API for dialog
const { dialog } = createDiscreteApi(["dialog"], {
  configProviderProps: {
    theme: darkTheme,
  },
});

// Create ANSI to HTML converter
const ansiConverter = new AnsiToHtml({
  fg: "#fff",
  bg: "#000",
  newline: true,
  escapeXML: true,
  stream: false,
});

// State management
const runConfigStore = useRunConfigStore();
const collapsed = ref(false);

// Computed properties
const runConfigs = computed(() => runConfigStore.configs);
const runHistory = computed(() => runConfigStore.history);

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

// Tauri event listeners
let unlistenOutput: UnlistenFn | null = null;
let unlistenStarted: UnlistenFn | null = null;
let unlistenStopped: UnlistenFn | null = null;

// Dialog state
const showConfigDialog = ref(false);
const editingConfig = ref<RunConfig | null>(null);

// Helper methods
const formatTime = (timestamp: Date | number) => {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString();
};

const getTabStatusColor = (tab: Tab) => {
  // If tab has error output, always show red
  if (tab.hasError) {
    return "#ef4444"; // Red
  }

  switch (tab.status) {
    case "running":
      return "#10b981"; // Green
    case "success":
      return "#3b82f6"; // Blue
    case "error":
      return "#ef4444"; // Red
    default:
      return "#6b7280"; // Gray
  }
};

// Fix removeHistory method call
const removeHistoryItem = async (index: number) => {
  await runConfigStore.removeHistory(index);
};

// Convert ANSI codes to HTML
const convertAnsiToHtml = (text: string) => {
  return ansiConverter.toHtml(text);
};

// Scroll to bottom of console
const scrollToBottom = async (tabId: string) => {
  await nextTick();
  const scrollbar = scrollbarRefs.value[tabId];
  if (scrollbar && scrollbar.scrollTo) {
    scrollbar.scrollTo({ top: 999999, behavior: "smooth" });
  }
};

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
    output: `> 准备运行: ${config.command}\n`,
    configId: config.id,
    processId: processId,
    historyId: historyId,
    status: "running",
    hasError: false,
  };

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
    scrollToBottom(tab.id);
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
        tab.output = "> 重新运行...\n";
        tab.status = "running";
        tab.hasError = false;

        // Execute command and get new process ID and history ID
        const { processId, historyId } = await runConfigStore.executeCommand(
          config
        );

        // Update the current tab with new process ID and history ID
        tab.processId = processId;
        tab.historyId = historyId;
      } catch (error) {
        console.error("Failed to restart command:", error);
        tab.output += `> 重启失败: ${error}\n`;
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
      tab.output += `> 正在停止进程...\n`;

      // Update history with output when manually stopped
      if (tab.historyId) {
        await runConfigStore.updateHistory(tab.historyId, {
          status: "success",
          output: tab.output,
        });
      }
    } catch (error) {
      tab.output += `> 停止进程失败: ${error}\n`;
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

// Export tab output
const handleExportTab = (tab: Tab) => {
  const blob = new Blob([tab.output], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${tab.name}-output.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Clear tab output
const handleClearTab = (tab: Tab) => {
  tab.output = "> 控制台已清空\n";
};

const handleTabClose = (tabId: string) => {
  const index = consoleTabs.value.findIndex((tab) => tab.id === tabId);
  if (index !== -1) {
    consoleTabs.value.splice(index, 1);
    if (activeTabId.value === tabId) {
      activeTabId.value =
        consoleTabs.value.length > 0 ? consoleTabs.value[0].id : undefined;
    }
  }
};

// Configuration dialog related methods
const handleConfigSaved = async (configData: any) => {
  try {
    if (editingConfig.value) {
      await runConfigStore.updateConfig(editingConfig.value.id, configData);
    } else {
      await runConfigStore.addConfig(configData);
    }
    editingConfig.value = null;
    showConfigDialog.value = false;
  } catch (error) {
    console.error("Failed to save config:", error);
  }
};

// Edit configuration
const handleEditConfig = (config: RunConfig) => {
  editingConfig.value = { ...config };
  showConfigDialog.value = true;
};

// Create new configuration
const handleNewConfig = () => {
  editingConfig.value = null;
  showConfigDialog.value = true;
};

// Run configuration
const handleRunConfig = async (config: RunConfig) => {
  try {
    // Execute command and get process ID and history ID
    const { processId, historyId } = await runConfigStore.executeCommand(
      config
    );

    // Add tab with process ID and history ID
    addTab(config, processId, historyId);
  } catch (error) {
    console.error("Failed to execute command:", error);
  }
};

// View history in a new tab
const handleViewHistory = (history: any) => {
  const tabId = `history-${history.id}-${Date.now()}`;
  const hasErrorOutput = history.output && history.output.includes("[ERROR]");
  const newTab: Tab = {
    id: tabId,
    name: `${history.name} (历史)`,
    output:
      history.output ||
      `> 历史记录\n> 配置: ${history.name}\n> 命令: ${
        history.command
      }\n> 时间: ${formatTime(history.timestamp)}\n\n暂无输出记录\n`,
    configId: history.configId, // Add configId so restart works
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
    await handleRunConfig(config);
  } else {
    const currentTab = consoleTabs.value.find(
      (tab) => tab.id === activeTabId.value
    );
    if (currentTab) {
      currentTab.output += "> 找不到对应的运行配置\n";
    }
  }
};

const handleClearHistory = () => {
  dialog.warning({
    title: "确认清空",
    content: "确定要清空所有运行历史吗？此操作不可撤销。",
    positiveText: "确定",
    negativeText: "取消",
    onPositiveClick: async () => {
      await runConfigStore.clearHistory();
    },
  });
};

// Suppress ResizeObserver loop errors
const resizeObserverErrorHandler = (e: ErrorEvent) => {
  if (
    e.message ===
    "ResizeObserver loop completed with undelivered notifications."
  ) {
    e.stopImmediatePropagation();
    return;
  }
};

// Setup Tauri event listeners on mount
onMounted(async () => {
  // Add global error handler for ResizeObserver
  window.addEventListener("error", resizeObserverErrorHandler);

  // Listen for process output
  unlistenOutput = await listen<{
    process_id: string;
    output_type: "stdout" | "stderr" | "system";
    content: string;
  }>("process-output", async (event) => {
    const { process_id, content, output_type } = event.payload;
    appendOutputToTab(process_id, content, output_type);

    // Send system notification for stderr
    if (output_type === "stderr") {
      const tab = findTabByProcessId(process_id);
      if (tab) {
        try {
          sendNotification({
            title: `错误: ${tab.name}`,
            body: content.trim().substring(0, 100), // Limit notification content
          });
        } catch (error) {
          console.error("Failed to send notification:", error);
        }
      }
    }
  });

  // Listen for process started
  unlistenStarted = await listen<{
    process_id: string;
    config_name: string;
    pid: number | null;
    status: string;
  }>("process-started", (event) => {
    const { process_id } = event.payload;
    updateTabStatus(process_id, "running");
  });

  // Listen for process stopped
  unlistenStopped = await listen<{
    process_id: string;
    config_name: string;
    pid: number | null;
    status: string;
  }>("process-stopped", async (event) => {
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

<style scoped>
.h-screen {
  height: 100vh;
}
.flex-1 {
  flex: 1;
}
.ml-2 {
  margin-left: 0.5rem;
}

.console-output {
  margin: 0;
  padding: 12px;
  font-family: "Courier New", Courier, monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #ffffff;
  background-color: transparent;
}

/* ANSI color support */
.console-output :deep(.ansi-color) {
  display: inline;
}
</style>
