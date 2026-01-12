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
  <div class="website-desktop">
    <n-config-provider
      :theme="darkTheme"
      :locale="locale"
      :date-locale="dateLocale"
    >
      <n-message-provider>
        <div class="website-app">
          <!-- Titlebar (macOS style) -->
          <header class="website-titlebar">
            <!-- Traffic light buttons (macOS) -->
            <div class="window-controls">
              <button
                class="window-control-button close-btn"
                title="关闭"
              ></button>
              <button
                class="window-control-button minimize-btn"
                title="最小化"
              ></button>
              <button
                class="window-control-button maximize-btn"
                title="最大化"
              ></button>
            </div>

            <!-- Left: Logo + Action buttons -->
            <div class="titlebar-left">
              <img src="/logo-dark.svg" alt="Rebebuca" class="titlebar-logo" />
              <div class="titlebar-actions">
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button
                      size="small"
                      quaternary
                      class="titlebar-action-btn"
                      @click="showAddFolderDialog = true"
                    >
                      <template #icon
                        ><n-icon :size="16"><folder-open-outline /></n-icon
                      ></template>
                    </n-button>
                  </template>
                  {{ t("task.addFolder") }}
                </n-tooltip>
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button
                      size="small"
                      quaternary
                      class="titlebar-action-btn"
                      @click="showTaskEditDialog = true"
                    >
                      <template #icon
                        ><n-icon :size="16"><add-outline /></n-icon
                      ></template>
                    </n-button>
                  </template>
                  {{ t("task.addTask") }}
                </n-tooltip>
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button
                      size="small"
                      quaternary
                      class="titlebar-action-btn"
                      @click="
                        openTab('ports', t('task.portManagement'), 'ports')
                      "
                    >
                      <template #icon
                        ><n-icon :size="16"><git-network-outline /></n-icon
                      ></template>
                    </n-button>
                  </template>
                  {{ t("task.portManagement") }}
                </n-tooltip>
              </div>
            </div>

            <!-- Center: App title -->
            <div class="titlebar-center">
              <img src="/text.svg" alt="Rebebuca" class="titlebar-text" />
            </div>

            <!-- Right: Version + buttons -->
            <div class="titlebar-right">
              <div class="version-group">
                <span class="version-text">{{ currentVersion }}</span>
              </div>
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button
                    text
                    size="small"
                    class="titlebar-btn"
                    @click="toggleLang"
                  >
                    <n-icon :size="16"><globe-outline /></n-icon>
                  </n-button>
                </template>
                {{ currentLang === "zh-CN" ? "English" : "中文" }}
              </n-tooltip>
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button
                    text
                    size="small"
                    class="titlebar-btn"
                    @click="
                      openTab('settings', t('settings.title'), 'settings')
                    "
                  >
                    <n-icon :size="16"><settings-outline /></n-icon>
                  </n-button>
                </template>
                {{ t("settings.title") }}
              </n-tooltip>
            </div>
          </header>

          <!-- Main Content -->
          <div class="website-main">
            <!-- Sidebar -->
            <aside class="website-sidebar">
              <div class="sidebar-header">
                <span class="sidebar-title">{{ t("task.title") }}</span>
              </div>

              <div class="task-list">
                <!-- Recent Section -->
                <div class="task-group">
                  <div class="group-header" @click="toggleGroup('recent')">
                    <n-icon class="group-icon">
                      <component
                        :is="
                          expandedGroups.recent
                            ? ChevronDownOutline
                            : ChevronForwardOutline
                        "
                      />
                    </n-icon>
                    <n-icon class="group-type-icon recent">
                      <component
                        :is="
                          recentSortMode === 'time'
                            ? TimeOutline
                            : BarChartOutline
                        "
                      />
                    </n-icon>
                    <span class="group-name">{{
                      recentSortMode === "time"
                        ? t("task.recent")
                        : t("task.frequent")
                    }}</span>
                    <span class="group-count">{{ recentTasks.length }}</span>
                    <n-tooltip trigger="hover" placement="top">
                      <template #trigger>
                        <n-button
                          size="tiny"
                          quaternary
                          class="sort-toggle-btn"
                          @click.stop="toggleSortMode"
                        >
                          <template #icon
                            ><n-icon :size="12"><sync-outline /></n-icon
                          ></template>
                        </n-button>
                      </template>
                      {{
                        recentSortMode === "time"
                          ? t("task.switchToFrequency")
                          : t("task.switchToTime")
                      }}
                    </n-tooltip>
                  </div>
                  <div v-if="expandedGroups.recent" class="group-tasks">
                    <div
                      v-for="task in recentTasks"
                      :key="task.id"
                      class="task-item"
                      :class="{ running: runningTaskId === task.id }"
                      @click="runDemoTask(task)"
                    >
                      <span class="task-icon">{{ task.icon }}</span>
                      <span class="task-name">{{ task.name }}</span>
                      <span v-if="task.folderHint" class="task-folder-hint">{{
                        task.folderHint
                      }}</span>
                      <n-icon
                        v-if="runningTaskId === task.id"
                        class="task-spinner"
                        ><sync-outline
                      /></n-icon>
                    </div>
                  </div>
                </div>

                <!-- Favorites Section -->
                <div class="task-group">
                  <div class="group-header" @click="toggleGroup('favorites')">
                    <n-icon class="group-icon">
                      <component
                        :is="
                          expandedGroups.favorites
                            ? ChevronDownOutline
                            : ChevronForwardOutline
                        "
                      />
                    </n-icon>
                    <n-icon class="group-type-icon star"
                      ><star-outline
                    /></n-icon>
                    <span class="group-name">{{ t("task.favorites") }}</span>
                    <span class="group-count">{{ favoriteTasks.length }}</span>
                  </div>
                  <div v-if="expandedGroups.favorites" class="group-tasks">
                    <div
                      v-for="task in favoriteTasks"
                      :key="task.id"
                      class="task-item"
                      :class="{ running: runningTaskId === task.id }"
                      @click="runDemoTask(task)"
                    >
                      <span class="task-icon">{{ task.icon }}</span>
                      <span class="task-name">{{ task.name }}</span>
                      <n-icon
                        v-if="runningTaskId === task.id"
                        class="task-spinner"
                        ><sync-outline
                      /></n-icon>
                    </div>
                  </div>
                </div>

                <!-- Folder Section -->
                <div class="task-group">
                  <div class="group-header" @click="toggleGroup('folder')">
                    <n-icon class="group-icon">
                      <component
                        :is="
                          expandedGroups.folder
                            ? ChevronDownOutline
                            : ChevronForwardOutline
                        "
                      />
                    </n-icon>
                    <n-icon class="group-type-icon folder"
                      ><folder-outline
                    /></n-icon>
                    <span class="group-name">~/projects/rebebuca</span>
                  </div>
                  <div v-if="expandedGroups.folder" class="group-tasks">
                    <div class="source-header" @click="toggleGroup('npm')">
                      <n-icon class="group-icon">
                        <component
                          :is="
                            expandedGroups.npm
                              ? ChevronDownOutline
                              : ChevronForwardOutline
                          "
                        />
                      </n-icon>
                      <span class="source-icon">📦</span>
                      <span class="source-name">package.json</span>
                      <span class="group-count">{{ npmTasks.length }}</span>
                    </div>
                    <div v-if="expandedGroups.npm" class="source-tasks">
                      <div
                        v-for="task in npmTasks"
                        :key="task.id"
                        class="task-item source-task"
                        :class="{ running: runningTaskId === task.id }"
                        @click="runDemoTask(task)"
                      >
                        <span class="task-icon">{{ task.icon }}</span>
                        <span class="task-name">{{ task.name }}</span>
                        <n-icon
                          v-if="runningTaskId === task.id"
                          class="task-spinner"
                          ><sync-outline
                        /></n-icon>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            <!-- Main Content Area -->
            <main class="website-content">
              <!-- Tabs bar -->
              <div v-if="tabs.length > 0" class="tabs-bar">
                <div
                  v-for="tab in tabs"
                  :key="tab.id"
                  class="tab-item"
                  :class="{
                    active: activeTab === tab.id,
                    running: tab.isRunning || tab.status === 'running',
                    success: tab.status === 'success',
                    error: tab.status === 'error',
                  }"
                  @click="activeTab = tab.id"
                >
                  <span class="tab-icon">
                    <n-icon :size="14">
                      <component :is="getTabIcon(tab)" />
                    </n-icon>
                  </span>
                  <span class="tab-name">{{ tab.name }}</span>
                  <span
                    v-if="activeTab === tab.id && tab.isTerminal"
                    class="tab-actions"
                  >
                    <span
                      v-if="tab.isRunning"
                      class="tab-action-btn"
                      :title="t('console.stop')"
                      @click.stop="stopTab(tab.id)"
                    >
                      <n-icon :size="12"><stop-outline /></n-icon>
                    </span>
                    <span
                      class="tab-action-btn"
                      :title="t('console.clear')"
                      @click.stop="handleClear"
                      >⌫</span
                    >
                  </span>
                  <span
                    class="tab-close"
                    title="Close"
                    @click.stop="closeTab(tab.id)"
                    >×</span
                  >
                </div>
                <div
                  class="add-tab-button"
                  :title="t('terminal.new')"
                  @click="openShellTab"
                >
                  <n-icon :size="14"><add-outline /></n-icon>
                </div>
              </div>

              <!-- Tab content or Welcome screen -->
              <template v-if="activeTab && currentTab">
                <div
                  v-if="currentTab.type === 'ports'"
                  class="tab-content ports-content"
                >
                  <WebsitePortsPanel />
                </div>
                <div
                  v-else-if="currentTab.type === 'settings'"
                  class="tab-content settings-content"
                >
                  <WebsiteSettingsPanel />
                </div>
                <div
                  v-else-if="currentTab.type === 'ssh'"
                  class="tab-content ssh-content"
                >
                  <WebsiteSshPanel />
                </div>
                <div v-else class="tab-content">
                  <div
                    :ref="(el) => setTerminalRef(activeTab!, el as HTMLDivElement)"
                    class="terminal-container"
                  ></div>
                </div>
              </template>

              <!-- Welcome screen -->
              <div v-else class="welcome-container">
                <div class="welcome-content">
                  <img
                    src="/logo-dark.svg"
                    alt="Rebebuca"
                    class="welcome-logo"
                  />
                  <h1 class="welcome-title">{{ t("website.hero.title") }}</h1>
                  <p class="welcome-subtitle">
                    {{ t("website.hero.subtitle") }}
                  </p>

                  <!-- Feature cards -->
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

                  <!-- Quick actions -->
                  <div class="welcome-actions">
                    <n-button
                      type="primary"
                      @click="
                        openTab(
                          'features',
                          t('website.tasks.viewFeatures'),
                          'features'
                        )
                      "
                    >
                      <template #icon
                        ><n-icon><terminal-outline /></n-icon
                      ></template>
                      {{ t("terminal.open") }}
                    </n-button>
                  </div>

                  <!-- Download Section -->
                  <div class="download-section">
                    <h2 class="download-title">
                      {{ t("website.download.title") }}
                    </h2>
                    <div class="download-buttons">
                      <a
                        :href="macosUrl || '#'"
                        target="_blank"
                        class="download-btn macos"
                      >
                        <n-icon :size="32"><logo-apple /></n-icon>
                        <div class="download-info">
                          <span class="download-platform">macOS</span>
                          <span class="download-arch"
                            >Apple Silicon / Intel</span
                          >
                        </div>
                      </a>
                      <a
                        :href="windowsUrl || '#'"
                        target="_blank"
                        class="download-btn windows"
                      >
                        <n-icon :size="32"><logo-windows /></n-icon>
                        <div class="download-info">
                          <span class="download-platform">Windows</span>
                          <span class="download-arch">x64</span>
                        </div>
                      </a>
                      <a href="#" target="_blank" class="download-btn linux">
                        <svg
                          class="linux-icon"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path
                            d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139z"
                          />
                        </svg>
                        <div class="download-info">
                          <span class="download-platform">Linux</span>
                          <span class="download-arch">AppImage / deb</span>
                        </div>
                      </a>
                    </div>
                    <p class="download-hint">
                      {{ t("website.download.note") }}
                    </p>
                    <div class="security-warning">
                      <p>⚠️ {{ t("website.download.securityWarning") }}</p>
                      <ul>
                        <li>
                          Windows: {{ t("website.download.windowsWarning") }}
                        </li>
                        <li>macOS: {{ t("website.download.macosWarning") }}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>

          <!-- Status Bar -->
          <footer class="website-statusbar">
            <div class="statusbar-left">
              <span class="status-item">
                <n-icon><code-slash-outline /></n-icon>
                Vue 3 + TypeScript + Tauri
              </span>
            </div>
            <div class="statusbar-center">
              <span class="status-item demo-notice">{{
                t("website.status.demoNotice")
              }}</span>
            </div>
            <div class="statusbar-right">
              <span class="status-item">GPL-3.0</span>
            </div>
          </footer>
        </div>

        <!-- Dialogs - Using actual components for UI consistency -->
        <AddFolderDialog
          v-model:show="showAddFolderDialog"
          :group-options="demoGroupOptions"
          @confirm="handleAddFolderConfirm"
        />

        <TaskEditDialog
          v-model:show="showTaskEditDialog"
          :is-edit-mode="false"
          :is-user-task="true"
          :task="editingTask"
          :group-id="selectedGroupId"
          :group-options="demoGroupOptions"
          @update:task="(task) => Object.assign(editingTask, task)"
          @update:group-id="(id) => selectedGroupId = id"
          @save="handleTaskSave"
        />

        <n-modal
          v-model:show="showAIDialog"
          preset="dialog"
          :title="t('task.aiGenerate')"
          style="width: 600px"
          :show-icon="false"
        >
          <div class="ai-dialog-content">
            <n-form-item :label="t('task.aiPrompt')">
              <n-input
                v-model:value="aiForm.prompt"
                type="textarea"
                :placeholder="t('task.aiPromptPlaceholder')"
                :autosize="{ minRows: 3, maxRows: 6 }"
              />
            </n-form-item>
            <div class="ai-actions">
              <n-button
                type="primary"
                :loading="aiForm.loading"
                :disabled="!aiForm.prompt"
                @click="handleAIGenerate"
              >
                {{ t("task.aiGenerateBtn") }}
              </n-button>
            </div>
            <div v-if="aiForm.result" class="ai-result">
              <n-divider>{{ t("task.aiResult") }}</n-divider>
              <div class="generated-task">
                <div class="result-item">
                  <span class="result-label">{{ t("task.name") }}:</span>
                  <span class="result-value">{{ aiForm.result.name }}</span>
                </div>
                <div class="result-item">
                  <span class="result-label">{{ t("task.command") }}:</span>
                  <span class="result-value monospace">{{
                    aiForm.result.command
                  }}</span>
                </div>
              </div>
              <div class="ai-result-actions">
                <n-button @click="handleAddGeneratedTask">{{
                  t("task.addToTasks")
                }}</n-button>
              </div>
            </div>
          </div>
        </n-modal>
      </n-message-provider>
    </n-config-provider>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from "vue";
import {
  NConfigProvider,
  NMessageProvider,
  NButton,
  NIcon,
  NModal,
  NTooltip,
  NDivider,
  darkTheme,
  zhCN,
  dateZhCN,
  createDiscreteApi,
} from "naive-ui";
import {
  LogoApple,
  LogoWindows,
  CodeSlashOutline,
  ChevronDownOutline,
  ChevronForwardOutline,
  SyncOutline,
  FolderOpenOutline,
  AddOutline,
  GitNetworkOutline,
  StarOutline,
  FolderOutline,
  StopOutline,
  SettingsOutline,
  TimeOutline,
  BarChartOutline,
  ServerOutline,
  TerminalOutline,
  GlobeOutline,
} from "@vicons/ionicons5";
import { useI18n } from "vue-i18n";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

// Import extracted components
import {
  WebsitePortsPanel,
  WebsiteSshPanel,
  WebsiteSettingsPanel,
} from "../components/website";

// Import actual dialog components for UI consistency
import { AddFolderDialog, TaskEditDialog } from "../components/sidebar/dialogs";
import type { AddFolderFormData } from "../components/sidebar/dialogs/AddFolderDialog.vue";

// Import styles
import "../assets/styles/website.scss";

const { t, locale: i18nLocale } = useI18n();

// Use createDiscreteApi for message since we're outside n-message-provider context
const { message } = createDiscreteApi(["message"], {
  configProviderProps: { theme: darkTheme },
});

// Theme & Language
const currentLang = ref(localStorage.getItem("rebebuca-locale") || "zh-CN");
const locale = computed(() => (currentLang.value === "zh-CN" ? zhCN : null));
const dateLocale = computed(() =>
  currentLang.value === "zh-CN" ? dateZhCN : null
);

// Version & Download URLs
const currentVersion = ref("v0.4.6");
const macosUrl = ref("");
const windowsUrl = ref("");

const toggleLang = () => {
  const newLang = currentLang.value === "zh-CN" ? "en" : "zh-CN";
  currentLang.value = newLang;
  localStorage.setItem("rebebuca-locale", newLang);
  i18nLocale.value = newLang;
};

const fetchVersion = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("https://download.m7s.live/rb/latest.json", {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    currentVersion.value = `v${data.version}`;
    const version = data.version;
    macosUrl.value = `https://download.m7s.live/rb/v${version}/macos/Rebebuca.app.tar.gz`;
    windowsUrl.value = `https://download.m7s.live/rb/v${version}/nsis/Rebebuca_${version}_x64-setup.exe`;
  } catch (e) {
    console.error("Failed to fetch version:", e);
  }
};

// Tab state
interface TabItem {
  id: string;
  name: string;
  type:
    | "features"
    | "tech"
    | "monibuca"
    | "jessibuca"
    | "ports"
    | "settings"
    | "ssh"
    | "shell";
  isTerminal?: boolean;
  isRunning?: boolean;
  status?: "pending" | "running" | "success" | "error";
  terminal?: Terminal;
  fitAddon?: FitAddon;
}

const tabs = ref<TabItem[]>([]);
const activeTab = ref<string | null>(null);
const terminalRefs = ref<Record<string, HTMLDivElement>>({});

const currentTab = computed(() =>
  tabs.value.find((t) => t.id === activeTab.value)
);

// Groups expand state
const expandedGroups = reactive({
  recent: true,
  favorites: true,
  folder: true,
  npm: true,
});

const recentSortMode = ref<"time" | "frequency">("time");

const toggleGroup = (group: keyof typeof expandedGroups) => {
  expandedGroups[group] = !expandedGroups[group];
};

const toggleSortMode = () => {
  recentSortMode.value = recentSortMode.value === "time" ? "frequency" : "time";
};

// Demo Tasks
interface DemoTask {
  id: string;
  name: string;
  icon: string;
  action?: string;
  folderHint?: string;
}

const recentTasks = computed<DemoTask[]>(() => [
  {
    id: "npm-dev",
    name: "dev",
    icon: "▶️",
    action: "run",
    folderHint: "rebebuca",
  },
  {
    id: "npm-build",
    name: "build",
    icon: "📦",
    action: "run",
    folderHint: "rebebuca",
  },
  {
    id: "npm-tauri",
    name: "tauri dev",
    icon: "🦀",
    action: "run",
    folderHint: "rebebuca",
  },
]);

const favoriteTasks = computed<DemoTask[]>(() => [
  {
    id: "info",
    name: t("website.tasks.viewFeatures"),
    icon: "✨",
    action: "features",
  },
  { id: "tech", name: t("website.tasks.viewTech"), icon: "⚙️", action: "tech" },
  { id: "monibuca", name: "Monibuca", icon: "🎬", action: "monibuca" },
  { id: "jessibuca", name: "Jessibuca", icon: "📺", action: "jessibuca" },
]);

const npmTasks = ref<DemoTask[]>([
  { id: "npm-dev-2", name: "dev", icon: "▶️", action: "run" },
  { id: "npm-build-2", name: "build", icon: "📦", action: "run" },
  { id: "npm-preview", name: "preview", icon: "👁️", action: "run" },
  { id: "npm-lint", name: "lint", icon: "🔍", action: "run" },
  { id: "npm-tauri-2", name: "tauri dev", icon: "🦀", action: "run" },
]);

const runningTaskId = ref<string | null>(null);

// Dialog states
const showAddFolderDialog = ref(false);
const showTaskEditDialog = ref(false);
const showAIDialog = ref(false);

// Demo group options for dialogs
const demoGroupOptions = computed(() => [
  { label: 'Default', value: 'default' },
  { label: 'Docker', value: 'docker' },
]);

// For TaskEditDialog
const selectedGroupId = ref('default');
const editingTask = reactive({
  id: '',
  name: '',
  command: '',
  cwd: '',
  group: 'none' as 'build' | 'test' | 'clean' | 'none',
  type: 'shell' as 'shell' | 'process' | 'macro',
  sourceFile: '',
  useSystemTerminal: false,
  systemTerminalId: null as string | null,
  shellPath: null as string | null,
  envStr: '',
  pythonEnv: '',
  runAsAdmin: false,
  executionMode: undefined as 'serial' | 'parallel' | undefined,
  dependsOn: undefined as string[] | undefined,
  subTasks: undefined as string[] | undefined,
  useSsh: false,
  sshConfigId: null as string | null,
});
const aiForm = reactive({
  prompt: "",
  loading: false,
  result: null as { name: string; command: string } | null,
});

// Tab functions
const openTab = async (id: string, name: string, type: TabItem["type"]) => {
  const existingTab = tabs.value.find((t) => t.id === id);
  if (existingTab) {
    activeTab.value = id;
    return;
  }

  const isTerminalType = !["ports", "settings", "ssh"].includes(type);
  const newTab: TabItem = {
    id,
    name,
    type,
    isTerminal: isTerminalType,
    isRunning: isTerminalType,
    status: isTerminalType ? "running" : undefined,
  };
  tabs.value.push(newTab);
  activeTab.value = id;

  await nextTick();
  if (newTab.isTerminal) {
    initializeTerminal(newTab);
  }
};

const openShellTab = () => {
  const shellId = `shell-${Date.now()}`;
  openTab(shellId, t("terminal.title"), "shell");
};

const closeTab = (id: string) => {
  const tab = tabs.value.find((t) => t.id === id);
  if (tab?.terminal) {
    tab.terminal.dispose();
  }
  const index = tabs.value.findIndex((t) => t.id === id);
  if (index !== -1) {
    tabs.value.splice(index, 1);
    if (activeTab.value === id) {
      activeTab.value =
        tabs.value.length > 0 ? tabs.value[tabs.value.length - 1].id : null;
    }
  }
};

const stopTab = (id: string) => {
  const tab = tabs.value.find((t) => t.id === id);
  if (tab) {
    tab.isRunning = false;
    tab.status = "success";
    tab.terminal?.writeln(
      "\r\n\x1b[32m[Process completed with exit code 0]\x1b[0m"
    );
  }
};

const getTabIcon = (tab: TabItem) => {
  if (tab.type === "ports") return GitNetworkOutline;
  if (tab.type === "settings") return SettingsOutline;
  if (tab.type === "ssh") return ServerOutline;
  if (tab.isRunning || tab.status === "running") return SyncOutline;
  return TerminalOutline;
};

const setTerminalRef = (tabId: string, el: HTMLDivElement | null) => {
  if (el) terminalRefs.value[tabId] = el;
};

// Terminal initialization
const initializeTerminal = (tab: TabItem) => {
  const container = terminalRefs.value[tab.id];
  if (!container) return;

  const terminal = new Terminal({
    theme: {
      background: "#0d0d0f",
      foreground: "#c0c0c0",
      cursor: "#00d084",
      cursorAccent: "#0d0d0f",
      selectionBackground: "rgba(0, 208, 132, 0.3)",
    },
    fontFamily: '"SF Mono", Monaco, Menlo, "Courier New", monospace',
    fontSize: 13,
    lineHeight: 1.4,
    cursorBlink: true,
    cursorStyle: "block",
    scrollback: 1000,
    allowTransparency: true,
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(container);
  fitAddon.fit();

  tab.terminal = terminal;
  tab.fitAddon = fitAddon;

  // Type content based on tab type
  const content = getTabContent(tab.type);
  if (content) {
    typeTerminalContent(terminal, content, () => {
      tab.isRunning = false;
      tab.status = "success";
    });
  }
};

const getTabContent = (type: string): string[] | null => {
  const contents: Record<string, string[]> = {
    features: [
      "$ rebebuca --features",
      "",
      `Rebebuca - ${t("website.hero.subtitle")}`,
      "",
      `${t("website.features.quickLaunch.title")}`,
      `  ${t("website.features.quickLaunch.desc")}`,
      "",
      `${t("website.features.realtime.title")}`,
      `  ${t("website.features.realtime.desc")}`,
      "",
      "[Done] Process exited with code 0",
    ],
    tech: [
      "$ rebebuca --tech-stack",
      "",
      "Tech Stack:",
      "  Frontend: Vue 3.5 + TypeScript 5.6 + Vite 7.x + Naive UI",
      "  Backend: Tauri 2.0 (Rust) + tokio + portable-pty",
      "",
      "[Done] Process exited with code 0",
    ],
    monibuca: [
      "$ open https://monibuca.com",
      "",
      `Monibuca - ${t("website.monibuca.title")}`,
      `${t("website.monibuca.desc")}`,
      "",
      "[Done] Process exited with code 0",
    ],
    jessibuca: [
      "$ open https://jessibuca.com",
      "",
      `Jessibuca - ${t("website.jessibuca.title")}`,
      `${t("website.jessibuca.desc")}`,
      "",
      "[Done] Process exited with code 0",
    ],
    shell: [
      "$ echo 'Welcome to Rebebuca Demo'",
      "Welcome to Rebebuca Demo",
      "",
    ],
  };
  return contents[type] || null;
};

const typeTerminalContent = async (
  terminal: Terminal,
  lines: string[],
  onComplete?: () => void
) => {
  for (const line of lines) {
    if (line.startsWith("$")) {
      terminal.write("\x1b[36m");
      await typeText(terminal, line, 30);
      terminal.write("\x1b[0m");
    } else if (line.startsWith("[Done]")) {
      terminal.write("\x1b[32m");
      await typeText(terminal, line, 20);
      terminal.write("\x1b[0m");
    } else {
      await typeText(terminal, line, 15);
    }
    terminal.write("\r\n");
    await new Promise((r) => setTimeout(r, 50));
  }
  onComplete?.();
};

const typeText = async (terminal: Terminal, text: string, speed: number) => {
  for (const char of text) {
    terminal.write(char);
    await new Promise((r) => setTimeout(r, speed));
  }
};

// Task handlers
const runDemoTask = async (task: DemoTask) => {
  if (runningTaskId.value) {
    message.warning(t("website.demo.taskRunning"));
    return;
  }
  runningTaskId.value = task.id;
  await new Promise((r) => setTimeout(r, 500));

  if (task.action === "features") {
    await openTab("features", t("website.tasks.viewFeatures"), "features");
  } else if (task.action === "tech") {
    await openTab("tech", t("website.tasks.viewTech"), "tech");
  } else if (task.action === "monibuca") {
    await openTab("monibuca", "Monibuca", "monibuca");
  } else if (task.action === "jessibuca") {
    await openTab("jessibuca", "Jessibuca", "jessibuca");
  } else if (task.action === "run") {
    await new Promise((r) => setTimeout(r, 1000));
    message.success(`${task.name} ${t("website.demo.completed")}`);
  }
  runningTaskId.value = null;
};

// Dialog handlers - New implementations using actual dialog components
const handleAddFolderConfirm = (data: AddFolderFormData) => {
  // In demo mode, just show success message
  if (data.isImportMode) {
    message.success(t("website.demo.folderImported") || `Folder "${data.sourceFolder}" scanned for tasks`);
  } else {
    message.success(t("website.demo.folderAdded"));
  }
  showAddFolderDialog.value = false;
};

const handleTaskSave = (
  _task: typeof editingTask,
  _groupId: string,
  newGroupName: string
) => {
  // In demo mode, just show success message
  const groupInfo = newGroupName ? ` to group "${newGroupName}"` : '';
  message.success(t("website.demo.taskAdded") + groupInfo);
  showTaskEditDialog.value = false;
  
  // Reset form for next use
  Object.assign(editingTask, {
    id: '',
    name: '',
    command: '',
    cwd: '',
    type: 'shell',
    envStr: '',
    pythonEnv: '',
    runAsAdmin: false,
    useSystemTerminal: false,
    systemTerminalId: null,
    shellPath: null,
    executionMode: undefined,
    dependsOn: undefined,
    subTasks: undefined,
    useSsh: false,
    sshConfigId: null,
  });
  selectedGroupId.value = 'default';
};

const handleAIGenerate = async () => {
  if (!aiForm.prompt) {
    message.warning(t("website.demo.aiPromptRequired"));
    return;
  }
  aiForm.loading = true;
  await new Promise((r) => setTimeout(r, 1500));
  aiForm.result = { name: "Generated Task", command: "node server.js" };
  aiForm.loading = false;
  message.success(t("website.demo.aiGenerated"));
};

const handleAddGeneratedTask = () => {
  message.success(t("website.demo.taskAdded"));
  showAIDialog.value = false;
  aiForm.prompt = "";
  aiForm.result = null;
};

const handleClear = () => {
  message.info(t("console.clear"));
};

onMounted(() => {
  fetchVersion();
  i18nLocale.value = currentLang.value;
});
</script>

<style scoped>
.website-desktop {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: linear-gradient(
    135deg,
    #0f0c29 0%,
    #302b63 40%,
    #24243e 70%,
    #0f0c29 100%
  );
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
  position: relative;
  overflow: hidden;
}

.website-desktop::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(
      ellipse at 20% 20%,
      rgba(120, 100, 255, 0.15) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 80% 80%,
      rgba(36, 200, 219, 0.12) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 50% 50%,
      rgba(189, 52, 254, 0.08) 0%,
      transparent 60%
    );
  pointer-events: none;
}

@keyframes gradientShift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
</style>
