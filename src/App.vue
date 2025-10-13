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
                  {{ t("app.title") }}
                </h3>
                <p
                  style="
                    margin: 4px 0 0 0;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.6);
                  "
                >
                  {{ t("app.subtitle") }}
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
          <n-layout-content class="main-content">
            <n-grid
              cols="1 s:1 m:3 l:3"
              responsive="screen"
              x-gap="0"
              y-gap="0"
              class="content-grid"
            >
              <!-- Console output area -->
              <n-gi :span="2" class="console-area">
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
                      {{ t("welcome.title") }}
                    </h2>
                    <p
                      style="
                        color: rgba(255, 255, 255, 0.5);
                        font-size: 16px;
                        line-height: 1.6;
                        margin: 0 0 24px 0;
                      "
                    >
                      {{ t("welcome.description") }}
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
                          {{ t("welcome.quickStart.title") }}
                        </h3>
                        <p
                          style="
                            color: rgba(255, 255, 255, 0.4);
                            font-size: 12px;
                            margin: 0;
                            line-height: 1.4;
                          "
                        >
                          {{ t("welcome.quickStart.description") }}
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
                          {{ t("welcome.efficientExecution.title") }}
                        </h3>
                        <p
                          style="
                            color: rgba(255, 255, 255, 0.4);
                            font-size: 12px;
                            margin: 0;
                            line-height: 1.4;
                          "
                        >
                          {{ t("welcome.efficientExecution.description") }}
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
                          {{ t("welcome.configManagement.title") }}
                        </h3>
                        <p
                          style="
                            color: rgba(255, 255, 255, 0.4);
                            font-size: 12px;
                            margin: 0;
                            line-height: 1.4;
                          "
                        >
                          {{ t("welcome.configManagement.description") }}
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
                          {{ t("welcome.history.title") }}
                        </h3>
                        <p
                          style="
                            color: rgba(255, 255, 255, 0.4);
                            font-size: 12px;
                            margin: 0;
                            line-height: 1.4;
                          "
                        >
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
                      <div
                        class="flex items-center gap-2"
                        style="min-width: 80px"
                      >
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
                        <span style="flex: 1">{{ tab.name }}</span>
                        <n-button
                          size="tiny"
                          text
                          @click.stop="handleTabClose(tab.id)"
                          style="padding: 2px; margin: -2px"
                        >
                          <template #icon>
                            <n-icon size="14">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </n-icon>
                          </template>
                        </n-button>
                      </div>
                    </template>

                    <div class="tab-content-wrapper">
                      <!-- Tab toolbar -->
                      <n-space
                        class="mb-2"
                        size="small"
                        style="
                          padding-left: 16px;
                          margin-left: 0;
                          display: flex;
                          align-items: center;
                        "
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
                                  tab.status === 'running'
                                    ? '#ef4444'
                                    : '#6b7280'
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
                        <n-button
                          size="small"
                          text
                          @click="handleExportTab(tab)"
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
                                <path d="M3 6h18"></path>
                                <path d="M3 12h18"></path>
                                <path d="M3 18h18"></path>
                                <path d="M12 15l3 3 3-3"></path>
                              </svg>
                            </n-icon>
                          </template>
                        </n-button>

                        <!-- 清空按钮 -->
                        <n-button
                          size="small"
                          text
                          @click="handleClearTab(tab)"
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

                        <!-- 命令行内容显示 -->
                        <n-text
                          depth="3"
                          style="
                            font-family: 'Courier New', Courier, monospace;
                            font-size: 12px;
                            margin-left: 12px;
                            padding: 4px 8px;
                            background-color: rgba(255, 255, 255, 0.05);
                            border-radius: 4px;
                            flex: 1;
                            word-wrap: break-word;
                            word-break: break-all;
                            white-space: pre-wrap;
                            line-height: 1.4;
                          "
                        >
                          {{ getTabCommand(tab) }}
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
                            v-html="convertAnsiToHtml(tab.output)"
                          ></pre>
                        </n-scrollbar>
                      </div>
                    </div>
                  </n-tab-pane>
                </n-tabs>
              </n-gi>

              <!-- Run history area -->
              <n-gi>
                <n-card size="small" :bordered="false" style="padding: 0">
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
                      <span>{{ t("history.title") }}</span>
                      <div style="display: flex; gap: 4px">
                        <n-button
                          size="small"
                          text
                          @click="handleOpenLogsFolder"
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
                                  d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                                ></path>
                              </svg>
                            </n-icon>
                          </template>
                        </n-button>
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
                            <div
                              style="
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                flex: 1;
                                margin-right: 18px;
                                overflow: hidden;
                              "
                            >
                              <n-icon
                                size="10"
                                :color="getHistoryStatusColor(item)"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <circle cx="12" cy="12" r="6"></circle>
                                </svg>
                              </n-icon>
                              <span
                                style="
                                  font-size: 13px;
                                  font-weight: 500;
                                  overflow: hidden;
                                  text-overflow: ellipsis;
                                  white-space: nowrap;
                                "
                                >{{ item.name }}</span
                              >
                            </div>
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
                      {{ t("history.empty") }}
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
import { useI18n } from "vue-i18n";
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

// i18n
const { t } = useI18n();

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

const getHistoryStatusColor = (historyItem: any) => {
  // Check if output contains [ERROR] prefix
  const hasErrorOutput =
    historyItem.output && historyItem.output.includes("[ERROR]");

  if (hasErrorOutput || historyItem.status === "error") {
    return "#ef4444"; // Red
  }

  switch (historyItem.status) {
    case "running":
      return "#10b981"; // Green
    case "success":
      return "#3b82f6"; // Blue
    default:
      return "#6b7280"; // Gray
  }
};

// Get tab command display
const getTabCommand = (tab: Tab) => {
  if (tab.configId) {
    const config = runConfigStore.getConfig(tab.configId);
    if (config) {
      const args =
        config.arguments && config.arguments.length > 0
          ? " " +
            config.arguments
              .map((arg: string) => {
                // Quote arguments that contain spaces
                return arg.includes(" ") ? `"${arg}"` : arg;
              })
              .join(" ")
          : "";
      return `${config.command}${args}`;
    }
  }
  return "";
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
    scrollToBottom(tab.id);
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
  tab.output = `> ${t("console.cleared")}\n`;
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
      dialog.warning({
        title: t("tab.confirmClose"),
        content: t("tab.confirmCloseMessage"),
        positiveText: t("tab.confirm"),
        negativeText: t("tab.cancel"),
        onPositiveClick: closeTab,
        onNegativeClick: () => {
          // Reset closing flag when user cancels
          tabClosingId.value = null;
        },
        onClose: () => {
          // Reset closing flag when dialog is closed
          tabClosingId.value = null;
        },
      });
    } else {
      // Directly close if not running
      closeTab();
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
    await handleRunConfig(config);
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
  dialog.warning({
    title: t("history.confirmClear"),
    content: t("history.confirmClearMessage"),
    positiveText: t("history.confirm"),
    negativeText: t("history.cancel"),
    onPositiveClick: async () => {
      await runConfigStore.clearHistory();
    },
  });
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

/* Main content layout */
.main-content {
  height: 100vh;
  overflow: hidden;
  padding: 0;
}

.content-grid {
  height: 100%;
  overflow: hidden;
}

/* Console area full height */
.console-area {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.09);
}

/* Console tabs full height */
.console-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Tab pane full height */
.tab-pane-full-height {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-content-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.console-output-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  margin-top: 8px;
  overflow: hidden;
  min-height: 0;
}

.console-scrollbar {
  flex: 1;
  height: 100%;
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

/* Override Naive UI tab pane styles */
:deep(.n-tabs) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

:deep(.n-tabs-nav-scroll-content) {
  flex-shrink: 0;
}

:deep(.n-tabs-pane-wrapper) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.n-tab-pane) {
  display: flex !important;
  flex-direction: column;
  height: 100%;
}
</style>
