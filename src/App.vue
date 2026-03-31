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

        <!-- Settings (modal — keeps workspace visible) -->
        <n-modal
          v-model:show="settingsModalVisible"
          preset="card"
          :title="settingsModalTitle"
          :style="{ width: 'min(960px, 94vw)' }"
          class="settings-app-modal"
          :mask-closable="true"
          :auto-focus="false"
          to="body"
        >
          <div class="settings-modal-body">
            <SettingsPanel v-model:active-tab="settingsActiveTab" />
          </div>
        </n-modal>

        <n-modal
          v-model:show="historyModalVisible"
          preset="card"
          :title="t('task.runHistory')"
          :style="{ width: 'min(720px, 94vw)' }"
          display-directive="show"
          to="body"
        >
          <div class="management-panel management-panel--modal">
            <div class="history-toolbar">
              <n-input
                v-model:value="historySearch"
                clearable
                size="small"
                :placeholder="t('task.historySearchPlaceholder')"
                class="history-search"
              />
              <n-select
                v-model:value="historyStatusFilter"
                :options="historyStatusOptions"
                size="small"
                class="history-status-filter"
              />
            </div>
            <div v-if="filteredHistory.length === 0" class="empty-hint">
              {{
                runConfigStore.history.length === 0
                  ? t("history.empty")
                  : t("task.historyNoMatches")
              }}
            </div>
            <div v-else class="history-list">
              <div
                v-for="item in filteredHistory"
                :key="item.id"
                class="history-item"
                :class="{ 'history-item--active': uiStore.selectedHistoryItem?.id === item.id }"
                @click="selectHistoryItem(item)"
              >
                <div class="history-main">
                  <div class="history-name">{{ item.name }}</div>
                  <div class="history-command">{{ item.command }}</div>
                </div>
                <div class="history-meta">
                  <span class="status-tag" :class="`status-${item.status}`">{{ item.status }}</span>
                  <span>{{ formatTimestamp(item.timestamp) }}</span>
                  <span v-if="item.duration">{{
                    t("task.durationSec", { sec: Math.floor(item.duration / 1000) })
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </n-modal>

        <n-modal
          v-model:show="overviewModalVisible"
          preset="card"
          :title="t('task.overview')"
          :style="{ width: 'min(640px, 94vw)' }"
          display-directive="show"
          to="body"
        >
          <div class="management-panel management-panel--modal">
            <div class="overview-cards">
              <div class="overview-card">
                <div class="overview-label">{{ t("task.totalTasks") }}</div>
                <div class="overview-value">{{ taskStats.total }}</div>
              </div>
              <div class="overview-card">
                <div class="overview-label">{{ t("task.statusRunning") }}</div>
                <div class="overview-value">{{ taskStats.running }}</div>
              </div>
              <div class="overview-card">
                <div class="overview-label">{{ t("task.statusSuccess") }}</div>
                <div class="overview-value">{{ taskStats.success }}</div>
              </div>
              <div class="overview-card">
                <div class="overview-label">{{ t("task.statusError") }}</div>
                <div class="overview-value">{{ taskStats.error }}</div>
              </div>
            </div>
            <div class="recent-failed-block">
              <div class="recent-failed-header">
                <div class="panel-title-sm">{{ t("task.recentFailedTasks") }}</div>
                <n-button size="small" quaternary @click="jumpToHistoryWithFailed">
                  {{ t("task.viewFailedInHistory") }}
                </n-button>
              </div>
              <div v-if="recentFailedTasks.length === 0" class="empty-hint">{{ t("task.noFailedTasks") }}</div>
              <div v-else class="failed-list">
                <div v-for="item in recentFailedTasks" :key="`failed-${item.id}`" class="failed-item">
                  <span class="failed-name">{{ item.name }}</span>
                  <span class="failed-time">{{ formatTimestamp(item.timestamp) }}</span>
                </div>
              </div>
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

        <!-- Server File Picker (for server mode) -->
        <ServerFilePicker
          v-if="filePickerFsAdapter"
          v-model:show="isFilePickerVisible"
          :title="filePickerOptions.title"
          :default-path="filePickerOptions.defaultPath"
          :filters="filePickerOptions.filters"
          :fs-adapter="filePickerFsAdapter"
          @select="onFilePickerSelect"
        />

        <!-- Notifications: right drawer so workspace stays visible -->
        <n-drawer
          v-if="!props.embedded"
          v-model:show="notificationsDrawerVisible"
          :width="notificationsDrawerWidth"
          placement="right"
          display-directive="show"
          :trap-focus="false"
        >
          <n-drawer-content
            :title="t('notifications.title')"
            closable
            :native-scrollbar="false"
            class="app-notifications-drawer"
          >
            <div class="notifications-drawer-panel-wrap">
              <NotificationsPanel v-if="notificationsDrawerVisible" />
            </div>
          </n-drawer-content>
        </n-drawer>

        <n-layout
          class="h-screen app-window"
          :class="{ 'embedded-mode': props.embedded }"
        >
          <n-layout class="main-layout">
            <n-layout class="workspace-layout">
              <div v-if="!props.embedded" class="app-header">
                <div class="app-header-left">
                  <div class="app-header-brand">
                    <img src="/logo.svg" alt="" class="app-header-logo" width="26" height="26" />
                    <span class="app-title">Rebebuca</span>
                  </div>
                  <n-space :size="6" align="center" class="task-subnav" :wrap="false">
                    <n-tooltip :disabled="!compactHeader" placement="bottom">
                      <template #trigger>
                        <n-button size="small" quaternary @click="historyModalVisible = true">
                          <template #icon><n-icon><component :is="HistoryIcon" /></n-icon></template>
                          <span v-if="!compactHeader">{{ t("task.runHistory") }}</span>
                        </n-button>
                      </template>
                      {{ t("task.runHistory") }}
                    </n-tooltip>
                    <n-tooltip :disabled="!compactHeader" placement="bottom">
                      <template #trigger>
                        <n-button size="small" quaternary @click="overviewModalVisible = true">
                          <template #icon><n-icon><component :is="OverviewIcon" /></n-icon></template>
                          <span v-if="!compactHeader">{{ t("task.overview") }}</span>
                        </n-button>
                      </template>
                      {{ t("task.overview") }}
                    </n-tooltip>
                    <n-tooltip :disabled="!compactHeader" placement="bottom">
                      <template #trigger>
                        <n-button size="small" quaternary @click="terminalStore.createPortManagementTab()">
                          <template #icon><n-icon><component :is="PortIcon" /></n-icon></template>
                          <span v-if="!compactHeader">{{ t("task.portManagement") }}</span>
                        </n-button>
                      </template>
                      {{ t("task.portManagement") }}
                    </n-tooltip>
                    <div class="global-search-wrap">
                      <n-input
                        v-model:value="globalSearch"
                        ref="taskSearchInputRef"
                        clearable
                        size="small"
                        :placeholder="t('task.searchPlaceholder') || 'Search tasks...'"
                        class="global-search"
                        @focus="taskSearchFocused = true"
                        @update:value="taskSearchFocused = true"
                        @blur="onTaskSearchBlur"
                        @keydown="onTaskSearchKeydown"
                      >
                        <template #prefix>
                          <n-icon><component :is="svgIcons.search" /></n-icon>
                        </template>
                      </n-input>
                      <Teleport to="body">
                        <div
                          v-show="taskSearchPanelVisible"
                          class="task-search-dropdown"
                          :style="taskSearchDropdownInlineStyle"
                          ref="taskSearchDropdownElRef"
                        >
                          <div
                            v-if="taskSearchResults.length === 0"
                            class="task-search-empty"
                          >
                            {{ t("task.noResults") || "No tasks found" }}
                          </div>
                          <div
                            v-for="(task, index) in taskSearchResults"
                            :key="task.id"
                            class="task-search-item"
                            :class="{
                              'task-search-item--active': index === taskSearchHighlight,
                            }"
                            @mousedown.prevent="runTaskFromSearch(task)"
                          >
                            <div class="task-search-item-title">
                              <span class="task-search-item-name">{{ task.name }}</span>
                              <span v-if="task.cwd" class="task-search-item-cwd">
                                {{ task.cwd }}
                              </span>
                            </div>
                            <span
                              v-if="task.command"
                              class="task-search-item-cmd"
                            >
                              {{ task.command }}
                            </span>
                          </div>
                        </div>
                      </Teleport>
                    </div>
                  </n-space>
                  <n-space
                    v-if="showSettingsTabsInHeader"
                    :size="4"
                    class="settings-header-tabs"
                    :wrap="false"
                  >
                    <n-tooltip
                      v-for="tab in settingsHeaderTabs"
                      :key="tab.name"
                      :disabled="!compactHeader"
                      placement="bottom"
                    >
                      <template #trigger>
                        <n-button
                          size="small"
                          quaternary
                          :type="
                            settingsModalVisible && settingsActiveTab === tab.name
                              ? 'primary'
                              : 'default'
                          "
                          @click="onSettingsHeaderTabClick(tab.name)"
                        >
                          <template v-if="tab.icon" #icon>
                            <n-icon><component :is="tab.icon" /></n-icon>
                          </template>
                          <span v-if="!compactHeader">{{ tab.label }}</span>
                        </n-button>
                      </template>
                      {{ tab.label }}
                    </n-tooltip>
                  </n-space>
                </div>
                <div class="app-header-right">
                  <span
                    class="version-chip"
                    :class="{ 'version-chip--update': updaterStore.updateAvailable }"
                  >
                    v{{ headerDisplayVersion }}
                  </span>
                  <n-dropdown
                    v-if="!props.embedded"
                    trigger="click"
                    :options="languageMenuOptions"
                    @select="onLanguageMenuSelect"
                  >
                    <n-button quaternary circle :title="t('settings.language')">
                      <template #icon>
                        <n-icon><component :is="svgIcons.language" /></n-icon>
                      </template>
                    </n-button>
                  </n-dropdown>
                  <n-dropdown
                    v-if="!props.embedded && showWorkspaceLayoutMenu"
                    trigger="click"
                    :options="workspaceLayoutMenuOptions"
                    @select="onWorkspaceLayoutSelect"
                  >
                    <n-button
                      quaternary
                      circle
                      :type="terminalStore.isSplitMode ? 'primary' : 'default'"
                      :title="t('titlebar.layout')"
                    >
                      <template #icon>
                        <n-icon><component :is="svgIcons.grid" /></n-icon>
                      </template>
                    </n-button>
                  </n-dropdown>
                  <n-button
                    v-if="!props.embedded"
                    quaternary
                    circle
                    :type="notificationsDrawerVisible ? 'primary' : 'default'"
                    :title="t('notifications.title')"
                    class="app-header-notifications-btn"
                    @click="openNotifications"
                  >
                    <template #icon>
                      <span class="notif-icon-wrap">
                        <n-icon><component :is="svgIcons.notifications" /></n-icon>
                        <span v-if="notificationUnreadCount > 0" class="notif-unread-dot" aria-hidden="true" />
                      </span>
                    </template>
                  </n-button>
                  <n-button quaternary circle @click="toggleTheme" :title="t('titlebar.toggleTheme')">
                    <template #icon>
                      <n-icon>
                        <component :is="effectiveTheme === 'light' ? svgIcons.sun : svgIcons.moon" />
                      </n-icon>
                    </template>
                  </n-button>
                  <n-button
                    v-if="!props.embedded"
                    quaternary
                    circle
                    tag="a"
                    href="https://github.com/langhuihui/rebebuca"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="GitHub"
                    @mousedown.stop
                  >
                    <template #icon>
                      <n-icon :size="18"><LogoGithub /></n-icon>
                    </template>
                  </n-button>
                  <UserMenu />
                </div>
              </div>

              <n-layout has-sider class="content-layout">
                <TaskSidebar />

                <n-layout-content v-if="!uiStore.miniMode" class="main-content">
                  <ConsoleArea />
                </n-layout-content>
              </n-layout>
            </n-layout>
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
import { ref, onMounted, onUnmounted, inject, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  NMessageProvider,
  NConfigProvider,
  NDialogProvider,
  NLayout,
  NLayoutContent,
  NModal,
  NDrawer,
  NDrawerContent,
  NButton,
  NInput,
  NSelect,
  NSpace,
  NIcon,
  NDropdown,
  NPopover,
  NAlert,
  NTooltip,
} from "naive-ui";
import { useRunConfigStore } from "./stores/runConfig";
import { useTaskManagerStore } from "./stores/taskManager";
import { useTerminalStore } from "./stores/terminal";
import { useUIStore } from "./stores/ui";
import { useAppStore } from "./stores/app";
import { useUpdaterStore } from "./stores/updater";
import { useFeatureFlagsStore } from "./stores/featureFlags";
import { useNotificationStore } from "./stores/notification";
import { useSettingsHeaderTabs } from "./composables/useSettingsHeaderTabs";
import { useLocale } from "./composables/useLocale";
import TaskSidebar from "./components/TaskSidebar.vue";
import ConsoleArea from "./components/ConsoleArea.vue";
import StatusBar from "./components/StatusBar.vue";
import SettingsPanel from "./components/settings/SettingsPanel.vue";
import NotificationsPanel from "./components/NotificationsPanel.vue";
import ServerDirectoryPicker from "./components/ServerDirectoryPicker.vue";
import ServerFilePicker from "./components/ServerFilePicker.vue";
import RemoteNotificationModal from "./components/RemoteNotificationModal.vue";
import { useTheme } from "./composables/useTheme";
type UnlistenFn = () => void;
import { isWindows } from "./utils/platform";
import { initTrayService, cleanupTrayService } from "./services/trayService";
import {
  registerDirectoryPicker,
  unregisterDirectoryPicker,
  onDirectorySelected,
  getDirectoryPickerFsAdapter,
  type DirectoryPickerOptions,
} from "./services/directoryPickerService";
import {
  registerFilePicker,
  unregisterFilePicker,
  onFileSelected,
  getFilePickerFsAdapter,
  type FilePickerOptions,
} from "./services/filePickerService";
import { svgIcons } from "./utils/icons";
import type { Task } from "./providers/types";
import { LogoGithub } from "@vicons/ionicons5";
import {
  TimeOutline as HistoryIcon,
  PieChartOutline as OverviewIcon,
  GitNetworkOutline as PortIcon,
} from "@vicons/ionicons5";
import UserMenu from "../shared/components/UserMenu.vue";
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
const { currentTheme, effectiveTheme, toggleTheme } = useTheme();

// Store management
const runConfigStore = useRunConfigStore();
const taskManager = useTaskManagerStore();
const terminalStore = useTerminalStore();
const uiStore = useUIStore();
const appStore = useAppStore();
const updaterStore = useUpdaterStore();
const featureFlagsStore = useFeatureFlagsStore();
const notificationStore = useNotificationStore();
const notificationUnreadCount = computed(() => notificationStore.unreadCount);
const { settingsHeaderTabs } = useSettingsHeaderTabs();
const { getLocalizedOptions, setLocale } = useLocale();

const settingsModalTitle = computed(() => {
  const tab = settingsHeaderTabs.value.find((x) => x.name === settingsActiveTab.value);
  return tab?.label ?? t("settings.title");
});

const languageMenuOptions = computed(() =>
  getLocalizedOptions().map((o) => ({ label: o.label, key: o.value })),
);

const onLanguageMenuSelect = (key: string) => {
  setLocale(key);
};

// About dialog state
const showAboutDialog = ref(false);
const currentVersion = ref("");
const headerDisplayVersion = computed(
  () => updaterStore.currentVersion || currentVersion.value,
);

const globalSearch = ref("");
const settingsModalVisible = ref(false);
const settingsActiveTab = ref("general");
const historyModalVisible = ref(false);
const overviewModalVisible = ref(false);
const historySearch = ref("");

// Compact header: show icon-only buttons when window is too narrow
const compactHeader = ref(false);
const COMPACT_HEADER_THRESHOLD = 1700;

const checkCompactHeader = () => {
  compactHeader.value = window.innerWidth < COMPACT_HEADER_THRESHOLD;
};
const historyStatusFilter = ref<"all" | "running" | "success" | "error">("all");
const taskSearchFocused = ref(false);
const taskSearchHighlight = ref(0);
let taskSearchBlurTimer: ReturnType<typeof setTimeout> | null = null;

const notificationsDrawerVisible = ref(false);
const notificationsWinW = ref(
  typeof window !== "undefined" ? window.innerWidth : 1024,
);
const notificationsDrawerWidth = computed(() =>
  Math.min(480, Math.max(320, notificationsWinW.value - 48)),
);

function syncNotificationsDrawerWinW() {
  if (typeof window !== "undefined") {
    notificationsWinW.value = window.innerWidth;
  }
}

const showSettingsTabsInHeader = computed(() => !props.embedded);

const showWorkspaceLayoutMenu = computed(() => !props.embedded);

const taskSearchInputRef = ref<any>(null);
const taskSearchDropdownElRef = ref<HTMLElement | null>(null);
const taskSearchDropdownPos = ref({ top: 0, left: 0, width: 0 });
const taskSearchDropdownInlineStyle = computed(() => ({
  top: `${taskSearchDropdownPos.value.top}px`,
  left: `${taskSearchDropdownPos.value.left}px`,
  width: `${taskSearchDropdownPos.value.width}px`,
}));

/** Parse rgb/rgba string to [r,g,b] or null */
function parseRgbTuple(color: string): [number, number, number] | null {
  const m = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Blend translucent panel color over a solid base (opaque result). */
function flattenOverBase(rgba: string, baseRgb: [number, number, number]): string {
  const m = rgba.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/,
  );
  if (!m) return rgba;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a = m[4] !== undefined ? Number(m[4]) : 1;
  if (a >= 0.999) {
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  }
  const [br, bg, bb] = baseRgb;
  const outR = Math.round(r * a + br * (1 - a));
  const outG = Math.round(g * a + bg * (1 - a));
  const outB = Math.round(b * a + bb * (1 - a));
  return `rgb(${outR},${outG},${outB})`;
}

/**
 * Resolve an opaque panel background: Naive modal color may be translucent;
 * blend over app/body background so the dropdown does not look "see-through".
 * `dropdownEl` must already have `--n-color-modal` / `--n-color` copied so
 * resolution happens in theme scope (no white fallback in dark theme).
 */
function resolveOpaqueDropdownBackground(
  dropdownEl: HTMLElement,
  sourceEl: HTMLElement,
): string | null {
  const mount =
    (sourceEl.closest(".n-config-provider") as HTMLElement | null) ||
    document.body;
  const isDark = mount.classList.contains("n-config-provider--dark");

  const naiveDarkPanelRgb = "rgb(24, 24, 28)";
  const naiveLightPanelRgb = "rgb(255, 255, 255)";

  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;left:-99999px;top:0;width:1px;height:1px;pointer-events:none;visibility:hidden;opacity:0;";
  probe.style.background = "var(--n-color-modal, var(--n-color))";
  dropdownEl.appendChild(probe);
  let bg = window.getComputedStyle(probe).backgroundColor;
  dropdownEl.removeChild(probe);

  if (!bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)") {
    bg = isDark ? naiveDarkPanelRgb : naiveLightPanelRgb;
  }

  const rgbParts = bg.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (isDark && rgbParts) {
    const r = Number(rgbParts[1]);
    const g = Number(rgbParts[2]);
    const b = Number(rgbParts[3]);
    if (r > 220 && g > 220 && b > 220) {
      bg = naiveDarkPanelRgb;
    }
  }

  const baseEl =
    (sourceEl.closest(".app-window") as HTMLElement | null) ||
    (mount.querySelector(".app-window") as HTMLElement | null) ||
    document.body;
  const baseBg = window.getComputedStyle(baseEl).backgroundColor;
  let baseRgb = parseRgbTuple(baseBg);
  if (
    !baseRgb ||
    baseBg === "transparent" ||
    baseBg === "rgba(0, 0, 0, 0)"
  ) {
    baseRgb = isDark ? [24, 24, 28] : [255, 255, 255];
  }

  const alphaMatch = bg.match(
    /rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/,
  );
  if (alphaMatch) {
    const alpha = Number(alphaMatch[1]);
    if (alpha < 0.999) return flattenOverBase(bg, baseRgb);
  }
  return bg;
}

const syncTaskSearchDropdownThemeVars = () => {
  const dropdownEl = taskSearchDropdownElRef.value;
  if (!dropdownEl) return;

  const comp = taskSearchInputRef.value as any;
  const elFromRef: HTMLElement | undefined =
    comp?.$el && comp.$el instanceof HTMLElement ? comp.$el : comp;
  const elFromDom =
    (document.querySelector(
      ".global-search input",
    ) as HTMLElement | null) ||
    (document.querySelector(".global-search") as HTMLElement | null);
  const sourceEl =
    elFromRef && typeof elFromRef.getBoundingClientRect === "function"
      ? elFromRef
      : elFromDom;
  if (!sourceEl) return;

  const sourceStyles = window.getComputedStyle(sourceEl);

  // Custom properties might be defined on some ancestor (e.g. NConfigProvider),
  // so walk up to find the closest resolved value.
  const getVarFromAncestors = (start: HTMLElement, name: string) => {
    let el: HTMLElement | null = start;
    // Avoid infinite loops; DOM depth is small here.
    for (let i = 0; i < 25 && el; i++) {
      const v = window.getComputedStyle(el).getPropertyValue(name).trim();
      if (v) return v;
      el = el.parentElement;
    }
    return "";
  };

  const varNames = [
    "--n-color",
    "--n-color-modal",
    "--n-border-color",
    "--n-color-hover",
    "--n-text-color-1",
    "--n-text-color-3",
    "--n-text-color-2",
    "--n-primary-color",
  ];

  for (const name of varNames) {
    const value = getVarFromAncestors(sourceEl as HTMLElement, name);
    if (value) dropdownEl.style.setProperty(name, value);
  }

  // Critical fallback: if theme CSS vars couldn't be resolved (teleport scope),
  // use the resolved colors from the input itself so text stays readable.
  const fallbackText1 =
    sourceStyles.getPropertyValue("--n-text-color-1").trim() ||
    sourceStyles.color.trim();
  const fallbackText2 =
    sourceStyles.getPropertyValue("--n-text-color-2").trim() ||
    fallbackText1;
  const fallbackText3 =
    sourceStyles.getPropertyValue("--n-text-color-3").trim() ||
    fallbackText2;

  if (fallbackText1) {
    dropdownEl.style.setProperty("--n-text-color-1", fallbackText1);
    dropdownEl.style.color = fallbackText1; // explicit to avoid inherit->black
  }
  if (fallbackText2) dropdownEl.style.setProperty("--n-text-color-2", fallbackText2);
  if (fallbackText3) dropdownEl.style.setProperty("--n-text-color-3", fallbackText3);

  if (import.meta.env.DEV) {
    console.debug("[TaskSearch] synced vars", {
      nText1: dropdownEl.style.getPropertyValue("--n-text-color-1"),
      nText2: dropdownEl.style.getPropertyValue("--n-text-color-2"),
      nText3: dropdownEl.style.getPropertyValue("--n-text-color-3"),
    });
  }

  const opaqueBg = resolveOpaqueDropdownBackground(dropdownEl, sourceEl as HTMLElement);
  if (opaqueBg) {
    dropdownEl.style.background = opaqueBg;
    dropdownEl.style.backgroundColor = opaqueBg;
    dropdownEl.style.backgroundImage = "none";
  }
};

const taskSearchPanelVisible = computed(
  () => taskSearchFocused.value && globalSearch.value.trim().length > 0,
);

function updateTaskSearchDropdownPos() {
  const comp = taskSearchInputRef.value as any;
  // Naive UI component refs might not be the raw <input>; try $el first,
  // then fall back to DOM queries.
  const elFromRef: HTMLElement | undefined =
    comp?.$el && comp.$el instanceof HTMLElement ? comp.$el : comp;
  const elFromDom =
    (document.querySelector(
      ".global-search input",
    ) as HTMLElement | null) ||
    (document.querySelector(".global-search") as HTMLElement | null);
  const el =
    elFromRef && typeof elFromRef.getBoundingClientRect === "function"
      ? elFromRef
      : elFromDom;
  if (!el || typeof el.getBoundingClientRect !== "function") return;

  const rect = el.getBoundingClientRect();
  const dropdownWidth = Math.min(
    980,
    Math.max(420, Math.round(rect.width * 1.8)),
  );
  // Keep a small gap under the input.
  taskSearchDropdownPos.value = {
    top: rect.bottom + 4,
    left: rect.left,
    width: dropdownWidth,
  };

  // Apply theme vars after the dropdown is visible.
  syncTaskSearchDropdownThemeVars();
}

const taskSearchResults = computed(() => {
  const q = globalSearch.value.trim().toLowerCase();
  if (!q) return [];
  return taskManager.combinedTasks.filter(
    (task) =>
      // Search only "command name" (task.name). Do not match command path.
      task.name.toLowerCase().includes(q),
  );
});

const onTaskSearchBlur = () => {
  if (taskSearchBlurTimer) clearTimeout(taskSearchBlurTimer);
  taskSearchBlurTimer = setTimeout(() => {
    taskSearchFocused.value = false;
    taskSearchBlurTimer = null;
  }, 150);
};

const runTaskFromSearch = async (task: Task) => {
  try {
    await taskManager.executeTask(task);
  } catch (err) {
    console.error("[App] runTaskFromSearch:", err);
  }
  globalSearch.value = "";
  taskSearchFocused.value = false;
  taskSearchHighlight.value = 0;
};

const onTaskSearchKeydown = (e: KeyboardEvent) => {
  if (!taskSearchPanelVisible.value) {
    if (e.key === "Escape") {
      globalSearch.value = "";
    }
    return;
  }
  const list = taskSearchResults.value;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (list.length === 0) return;
    taskSearchHighlight.value = (taskSearchHighlight.value + 1) % list.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (list.length === 0) return;
    taskSearchHighlight.value =
      (taskSearchHighlight.value - 1 + list.length) % list.length;
  } else if (e.key === "Enter") {
    e.preventDefault();
    const selected = list[taskSearchHighlight.value];
    if (selected) void runTaskFromSearch(selected);
  } else if (e.key === "Escape") {
    e.preventDefault();
    globalSearch.value = "";
    taskSearchFocused.value = false;
  }
};

watch(globalSearch, (v) => {
  taskSearchHighlight.value = 0;
  if (v.trim().length > 0) requestAnimationFrame(() => updateTaskSearchDropdownPos());
  if (import.meta.env.DEV) {
    console.debug("[TaskSearch]", {
      globalSearch: v,
      panelVisible: taskSearchPanelVisible.value,
      results: taskSearchResults.value.length,
      dropdownPos: taskSearchDropdownPos.value,
    });
  }
});

watch(taskSearchPanelVisible, (visible) => {
  if (!visible) return;
  // Wait for v-show/Teleport to render before measuring.
  requestAnimationFrame(() => {
    updateTaskSearchDropdownPos();
    syncTaskSearchDropdownThemeVars();
  });
});

watch(taskSearchResults, (list) => {
  if (taskSearchHighlight.value >= list.length) {
    taskSearchHighlight.value = Math.max(0, list.length - 1);
  }
});

const workspaceLayoutMenuOptions = computed(() => [
  { label: t("titlebar.layoutSingle"), key: "single" },
  { label: t("titlebar.layoutDual"), key: "dual" },
  { label: t("titlebar.layoutQuad"), key: "quad" },
]);

const onWorkspaceLayoutSelect = (key: string | number) => {
  const k = String(key);
  if (k === "single" || k === "dual" || k === "quad") {
    terminalStore.setSplitLayout(k);
  }
};

const onSettingsHeaderTabClick = (name: string) => {
  settingsActiveTab.value = name;
  settingsModalVisible.value = true;
};

const historyTimestamp = (item: (typeof runConfigStore.history)[number]) => {
  const n = new Date(item.timestamp).getTime();
  return Number.isFinite(n) ? n : 0;
};

const sortedHistory = computed(() =>
  [...runConfigStore.history].sort(
    (a, b) => historyTimestamp(b) - historyTimestamp(a),
  ),
);

const historyStatusOptions = computed(() => [
  { label: t("task.statusAll"), value: "all" },
  { label: t("task.statusRunning"), value: "running" },
  { label: t("task.statusSuccess"), value: "success" },
  { label: t("task.statusError"), value: "error" },
]);

const filteredHistory = computed(() => {
  const q = historySearch.value.trim().toLowerCase();
  return sortedHistory.value.filter((item) => {
    const statusMatched =
      historyStatusFilter.value === "all" || item.status === historyStatusFilter.value;
    const cmd = (item.command ?? "").toLowerCase();
    const queryMatched =
      !q || item.name.toLowerCase().includes(q) || cmd.includes(q);
    return statusMatched && queryMatched;
  });
});

const taskStats = computed(() => {
  const total = runConfigStore.history.length;
  const running = runConfigStore.history.filter((h) => h.status === "running").length;
  const success = runConfigStore.history.filter((h) => h.status === "success").length;
  const error = runConfigStore.history.filter((h) => h.status === "error").length;
  return { total, running, success, error };
});

const recentFailedTasks = computed(() =>
  sortedHistory.value.filter((h) => h.status === "error").slice(0, 5),
);

const openNotifications = () => {
  syncNotificationsDrawerWinW();
  notificationsDrawerVisible.value = true;
};

const formatTimestamp = (timestamp: Date | string) => {
  const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return d.toLocaleString();
};

const jumpToHistoryWithFailed = () => {
  historyStatusFilter.value = "error";
  overviewModalVisible.value = false;
  historyModalVisible.value = true;
};

const selectHistoryItem = (
  item: (typeof runConfigStore.history)[number],
) => {
  uiStore.setSelectedHistoryItem(item);
  terminalStore.setActiveTab(null);
  historyModalVisible.value = false;
};

watch(
  [settingsHeaderTabs, settingsActiveTab],
  () => {
    const names = settingsHeaderTabs.value.map((tab) => tab.name);
    if (!names.includes(settingsActiveTab.value)) {
      settingsActiveTab.value = "general";
    }
  },
  { immediate: true },
);

// Directory picker state (for server mode)
const isDirectoryPickerVisible = ref(false);
const directoryPickerOptions = ref<DirectoryPickerOptions>({});
const directoryPickerFsAdapter = ref<{
  readDir: (path: string) => Promise<any[]>;
} | null>(null);

// File picker state (for server mode)
const isFilePickerVisible = ref(false);
const filePickerOptions = ref<FilePickerOptions>({});
const filePickerFsAdapter = ref<{
  readDir: (path: string) => Promise<any[]>;
} | null>(null);

// Handle directory picker selection
const onDirectoryPickerSelect = (path: string | null) => {
  isDirectoryPickerVisible.value = false;
  onDirectorySelected(path);
};

// Handle file picker selection
const onFilePickerSelect = (path: string | null) => {
  isFilePickerVisible.value = false;
  onFileSelected(path);
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
    })),
  );

  // First try to find by pid (system PID)
  let result = runConfigStore.history.find((item) => item.pid === processId);

  // If not found and processId looks like a UUID, try to find by internalId
  if (!result && processId.includes("-")) {
    result = runConfigStore.history.find(
      (item) => item.internalId === processId,
    );
  }

  // SSH / PTY id stored on history (server mode)
  if (!result) {
    result = runConfigStore.history.find((item) => item.ptyId === processId);
  }

  console.log(
    `[FRONTEND] findHistoryByProcessId result:`,
    result ? result.id : "not found",
  );
  return result;
};

// Append output to history item with type distinction
const appendOutputToHistory = (
  processId: string,
  content: string,
  outputType: "stdout" | "stderr" | "system",
) => {
  const historyItem = findHistoryByProcessId(processId);
  if (historyItem) {
    console.log(
      `[FRONTEND] Appending ${outputType} to history item ${
        historyItem.id
      }: ${content.substring(0, 50)}...`,
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
      `[FRONTEND] History item not found for PID ${processId}, buffering ${outputType} output`,
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
  status: "running" | "success" | "error",
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
          duration / 1000,
        )}s)`,
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
      item.status === "running" && item.pid && !finishedProcesses.has(item.pid),
  );

  if (runningProcesses.length > 0) {
    console.log(
      `[FRONTEND] Updating stats for ${runningProcesses.length} running processes:`,
      runningProcesses.map((p) => ({ id: p.id, pid: p.pid, name: p.name })),
    );
  }

  for (const item of runningProcesses) {
    if (item.pid && !checkingProcesses.has(item.pid)) {
      // Check if this process has failed too many times
      const failureCount = failedStatsChecks.get(item.pid) || 0;
      if (failureCount >= 5) {
        // Skip processes that have failed too many times
        console.log(
          `Skipping process ${item.pid} - too many failed stats checks (${failureCount})`,
        );
        continue;
      }

      checkingProcesses.add(item.pid);

      try {
        console.log(
          `[FRONTEND] Attempting to get stats for process ${
            item.pid
          } (attempt ${failureCount + 1})`,
        );
        const stats = (await runConfigStore.getProcessStats(
          item.pid,
        )) as ProcessStats | null;

        console.log(`[FRONTEND] Stats result for process ${item.pid}:`, stats);

        if (stats) {
          item.cpuUsage = `${stats.cpu_usage.toFixed(1)}%`;
          item.memoryUsage = stats.memory_usage_mb;

          console.log(
            `[FRONTEND] Successfully updated stats for process ${item.pid}: CPU=${item.cpuUsage}, Memory=${item.memoryUsage}`,
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
            `[FRONTEND] Process ${item.pid} stats returned null, but not marking as finished yet`,
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
            `Process ${item.pid} has finished, marking as finished and updating status`,
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
            `Process ${item.pid} stats temporarily unavailable (attempt ${newFailureCount}/5): ${errorMessage}`,
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
    runConfigStore.history.map((h) => h.pid).filter(Boolean),
  );
  const toRemove = Array.from(finishedProcesses).filter(
    (pid) => !currentPids.has(pid),
  );
  toRemove.forEach((pid) => finishedProcesses.delete(pid));

  // Also clean up checking processes cache
  const toRemoveChecking = Array.from(checkingProcesses).filter(
    (pid) => !currentPids.has(pid),
  );
  toRemoveChecking.forEach((pid) => checkingProcesses.delete(pid));

  // Clean up failed stats checks cache
  const toRemoveFailed = Array.from(failedStatsChecks.keys()).filter(
    (pid) => !currentPids.has(pid),
  );
  toRemoveFailed.forEach((pid) => failedStatsChecks.delete(pid));

  if (
    toRemove.length > 0 ||
    toRemoveChecking.length > 0 ||
    toRemoveFailed.length > 0
  ) {
    console.log(
      `Cleaned up ${toRemove.length} finished processes, ${toRemoveChecking.length} checking processes, and ${toRemoveFailed.length} failed stats checks from cache`,
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

// Global API for remote task management
const setupGlobalAPI = () => {
  if (typeof window === "undefined") return;

  (window as any).rebebucaAPI = {
    // Get all tasks from server
    async getTasks(): Promise<any[]> {
      try {
        const response = await fetch("/api/tasks");
        const data = await response.json();
        return data.tasks || [];
      } catch (error) {
        console.error("[RebebucaAPI] Failed to get tasks:", error);
        return [];
      }
    },

    // Save tasks to server
    async saveTasks(tasks: any[]): Promise<boolean> {
      try {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tasks),
        });
        const data = await response.json();
        return data.success === true;
      } catch (error) {
        console.error("[RebebucaAPI] Failed to save tasks:", error);
        return false;
      }
    },

    // Get a specific task
    async getTask(taskId: string): Promise<any | null> {
      try {
        const response = await fetch(`/api/tasks/${taskId}`);
        const data = await response.json();
        return data.task || null;
      } catch (error) {
        console.error("[RebebucaAPI] Failed to get task:", error);
        return null;
      }
    },

    // Run a task by ID - returns run info
    async runTask(
      taskId: string,
    ): Promise<{ success: boolean; runId?: string; error?: string }> {
      try {
        const response = await fetch(`/api/tasks/${taskId}/run`, {
          method: "POST",
        });
        const data = await response.json();

        if (data.success) {
          return {
            success: true,
            runId: data.runId,
          };
        }
        return { success: false, error: data.error };
      } catch (error) {
        console.error("[RebebucaAPI] Failed to run task:", error);
        return { success: false, error: String(error) };
      }
    },

    // Get run history for a task
    async getRunHistory(taskId: string): Promise<any[]> {
      try {
        const response = await fetch(`/api/tasks/${taskId}/history`);
        const data = await response.json();
        return data.runs || [];
      } catch (error) {
        console.error("[RebebucaAPI] Failed to get run history:", error);
        return [];
      }
    },
  };

  console.log("[Rebebuca] Global API exposed at window.rebebucaAPI");
};

// Setup Tauri event listeners on mount
onMounted(async () => {
  // Expose global API for remote execution
  setupGlobalAPI();

  // Check compact header on mount
  checkCompactHeader();
  window.addEventListener("resize", checkCompactHeader);

  // Check platform for window controls styling
  uiStore.setWindowsPlatform(await isWindows());

  // Suppress ResizeObserver errors
  suppressResizeObserverError();

  // Add global error handler for ResizeObserver
  window.addEventListener("error", resizeObserverErrorHandler);

  syncNotificationsDrawerWinW();
  window.addEventListener("resize", syncNotificationsDrawerWinW);

  // Register directory picker for server mode
  registerDirectoryPicker((options: DirectoryPickerOptions) => {
    // Get the latest fsAdapter
    directoryPickerFsAdapter.value = getDirectoryPickerFsAdapter();
    directoryPickerOptions.value = options;
    isDirectoryPickerVisible.value = true;
  });

  // Register file picker for server mode
  registerFilePicker((options: FilePickerOptions) => {
    // Get the latest fsAdapter
    filePickerFsAdapter.value = getFilePickerFsAdapter();
    filePickerOptions.value = options;
    isFilePickerVisible.value = true;
  });

  // Get current version
  currentVersion.value = await updaterStore.getCurrentVersion();

  // Initialize feature flags
  await featureFlagsStore.initialize();

  // WebSocket terminal listeners + PTY restore after refresh (runs even when ConsoleArea is unmounted, e.g. settings modal open)
  try {
    const { useTerminalStore } = await import("./stores/terminal");
    await useTerminalStore().initListeners();
  } catch (e) {
    console.warn("[App] Terminal listeners / PTY restore:", e);
  }

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
          100,
        )}...`,
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
    },
  );

  // Listen for process started
  unlistenStarted = await appStore.safeListen(
    "process-started",
    (event: any) => {
      const { internal_id, system_pid } = event.payload;
      console.log(
        `[FRONTEND] Process started - Internal UUID: ${internal_id}, System PID: ${system_pid}`,
      );

      // Find history item by the internal_id (UUID)
      const historyItem = findHistoryByProcessId(internal_id);

      if (historyItem) {
        // Use system_pid if available, otherwise use internal_id
        const processId = system_pid ? system_pid.toString() : internal_id;

        console.log(
          `[FRONTEND] Process started - updating history item ${historyItem.id} with process ID: ${processId} (system_pid: ${system_pid}, internal_id: ${internal_id})`,
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
          `[FRONTEND] History item not found for internal UUID ${internal_id}`,
        );
        console.warn(
          `[FRONTEND] Available history items:`,
          runConfigStore.history.map((h) => ({
            id: h.id,
            pid: h.pid,
            internalId: h.internalId,
            status: h.status,
          })),
        );
      }
    },
  );

  // Listen for process stopped
  unlistenStopped = await appStore.safeListen(
    "process-stopped",
    async (event: any) => {
      const { internal_id, system_pid, status } = event.payload;
      console.log(
        `[FRONTEND] Process stopped - Internal UUID: ${internal_id}, System PID: ${system_pid}, Status: ${status}`,
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
    },
  );

  // Listen for PTY exit events (for terminal-based task execution)
  unlistenPtyExit = await appStore.safeListen(
    "pty-exit",
    async (event: any) => {
      const { pty_id, exit_code } = event.payload;
      console.log(
        `[FRONTEND] PTY exit event - PTY ID: ${pty_id}, Exit Code: ${exit_code}`,
      );

      // Find history item by ptyId
      const historyItem = runConfigStore.history.find(
        (item) => item.ptyId === pty_id,
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
          `[FRONTEND] PTY ${pty_id} finished, duration: ${duration}ms, status: ${historyStatus}`,
        );

        // Update history
        runConfigStore.updateHistory(historyItem.id, {
          status: historyStatus,
          duration: duration,
        });

        // Notify taskManager that task has exited (for SSH tasks)
        if (historyItem.configId) {
          try {
            const { useTaskManagerStore } =
              await import("./stores/taskManager");
            const taskManager = useTaskManagerStore();
            taskManager.onTaskExit(historyItem.ptyId || historyItem.configId);
          } catch (error) {
            console.error("[App] Failed to notify taskManager:", error);
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
    },
  );

  // Listen for SSH output events
  unlistenSshOutput = await appStore.safeListen(
    "ssh-output",
    async (event: any) => {
      const { taskId, type, content } = event.payload;
      console.log(`[FRONTEND] SSH output - Task ID: ${taskId}, Type: ${type}`);

      // Find history item by task ID (ptyId is the exec_id for SSH tasks)
      const historyItem = runConfigStore.history.find(
        (item) => item.configId === taskId || item.ptyId === taskId,
      );

      if (historyItem) {
        // Map SSH output type to history output type
        const outputType =
          type === "stdout"
            ? "stdout"
            : type === "stderr"
              ? "stderr"
              : "system";
        appendOutputToHistory(historyItem.ptyId || taskId, content, outputType);
      } else {
        // Buffer output if history item doesn't exist yet
        if (!outputBuffer.value[taskId]) {
          outputBuffer.value[taskId] = [];
        }
        outputBuffer.value[taskId].push({ content, outputType: type });
      }
    },
  );

  unlistenSshProcessStarted = await appStore.safeListen(
    "ssh-process-started",
    async (event: any) => {
      const { taskId, pid } = event.payload;
      console.log(
        `[FRONTEND] SSH process started - Task ID: ${taskId}, PID: ${pid}`,
      );

      const historyItem = runConfigStore.history.find(
        (item) => item.configId === taskId || item.ptyId === taskId,
      );

      if (historyItem) {
        runConfigStore.updateHistory(historyItem.id, {
          pid,
          ptyId: taskId, // Use taskId as ptyId for SSH tasks
        });
      }
    },
  );

  unlistenSshProcessFinished = await appStore.safeListen(
    "ssh-process-finished",
    async (event: any) => {
      const { taskId, exitCode } = event.payload;
      console.log(
        `[FRONTEND] SSH process finished - Task ID: ${taskId}, Exit Code: ${exitCode}`,
      );

      const historyItem = runConfigStore.history.find(
        (item) => item.configId === taskId || item.ptyId === taskId,
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
            const { useTaskManagerStore } =
              await import("./stores/taskManager");
            const taskManager = useTaskManagerStore();
            taskManager.onTaskExit(taskId);
          } catch (error) {
            console.error("[App] Failed to notify taskManager:", error);
          }
        }
      }
    },
  );

  unlistenSshError = await appStore.safeListen(
    "ssh-error",
    async (event: any) => {
      const { taskId, message } = event.payload;
      console.error(
        `[FRONTEND] SSH error - Task ID: ${taskId}, Message: ${message}`,
      );

      const historyItem = runConfigStore.history.find(
        (item) => item.configId === taskId || item.ptyId === taskId,
      );

      if (historyItem) {
        runConfigStore.updateHistory(historyItem.id, {
          status: "error",
          output: (historyItem.output || "") + `[SSH ERROR] ${message}\n`,
        });
      }
    },
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
  window.removeEventListener("resize", syncNotificationsDrawerWinW);
  if (taskSearchBlurTimer) clearTimeout(taskSearchBlurTimer);

  // Unregister directory picker
  unregisterDirectoryPicker();

  // Unregister file picker
  unregisterFilePicker();

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

  // Cleanup header resize observer
  window.removeEventListener("resize", checkCompactHeader);
});
</script>

<style scoped>
.app-window {
  height: 100vh;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Naive NLayout: fill viewport height through nested scroll containers */
.app-window :deep(.n-layout-scroll-container) {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-layout {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.main-layout :deep(.n-layout-scroll-container) {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace-layout {
  flex: 1;
  min-height: 0;
  height: 100%;
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.workspace-layout :deep(.n-layout-scroll-container) {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace-layout :deep(.n-layout-scroll-container > .app-header) {
  flex-shrink: 0;
}

.workspace-layout :deep(.n-layout-scroll-container > .content-layout) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.content-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-layout :deep(.n-layout-scroll-container) {
  flex: 1;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  overflow: hidden !important;
  align-items: stretch;
}

.content-layout :deep(.n-layout-sider) {
  flex-shrink: 0;
}

.content-layout :deep(.n-layout-content) {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.main-content {
  min-width: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
}

/* LayoutContent: scroll slot must fill remaining row width after sidebar */
.main-content :deep(.n-layout-scroll-container) {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.management-panel {
  height: 100%;
  overflow: auto;
  padding: 12px;
}

.management-panel--modal {
  height: auto;
  max-height: min(70vh, 640px);
  padding: 0;
}

.task-subnav {
  margin-left: 4px;
}

.settings-header-tabs {
  margin-left: 4px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.empty-hint {
  color: var(--n-text-color-3);
  padding: 16px 0;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.history-search {
  width: 280px;
}

.history-status-filter {
  width: 160px;
}

.history-item {
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.history-item:hover {
  background: color-mix(in srgb, var(--n-primary-color) 8%, transparent);
}

.history-item--active {
  border-color: var(--n-primary-color);
  background: color-mix(in srgb, var(--n-primary-color) 12%, transparent);
}

.history-main {
  min-width: 0;
}

.history-name {
  font-weight: 600;
  margin-bottom: 4px;
}

.history-command {
  color: var(--n-text-color-3);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 560px;
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--n-text-color-3);
  font-size: 12px;
}

.status-tag {
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid var(--n-border-color);
  text-transform: uppercase;
  font-size: 11px;
}

.status-running {
  color: #2080f0;
}

.status-success {
  color: #18a058;
}

.status-error {
  color: #d03050;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: 12px;
}

.overview-card {
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px;
}

.overview-label {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.overview-value {
  font-size: 24px;
  font-weight: 700;
  margin-top: 4px;
}

.recent-failed-block {
  margin-top: 16px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px;
}

.recent-failed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.panel-title-sm {
  font-size: 14px;
  font-weight: 600;
}

.failed-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.failed-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  padding: 8px 10px;
}

.failed-name {
  font-weight: 500;
}

.failed-time {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.app-header {
  height: 52px;
  border-bottom: 1px solid var(--n-border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  gap: 12px;
}

.app-header-left,
.app-header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.app-header-left {
  flex-wrap: nowrap;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: visible;
}

.app-header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.app-header-logo {
  display: block;
  width: 26px;
  height: 26px;
  object-fit: contain;
}

.global-search-wrap {
  position: relative;
  flex-shrink: 0;
}

.global-search {
  width: 280px;
}

.task-search-dropdown {
  position: fixed;
  top: 0;
  left: 0;
  min-width: 240px; /* Avoid "0px width" causing invisible dropdown */
  max-height: min(640px, 70vh);
  overflow-y: auto;
  z-index: 10000;
  background-color: var(--n-color-modal, var(--n-color));
  background-image: none;
  border: 1px solid var(--n-border-color, rgba(0, 0, 0, 0.18));
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  color: var(--n-text-color-1, #e6e6e6);
}

.task-search-empty {
  padding: 12px 14px;
  font-size: 13px;
  color: var(--n-text-color-3, #bdbdbd);
}

.task-search-item {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-bottom: 1px solid var(--n-border-color);
  color: var(--n-text-color-1, #e6e6e6);
}

.task-search-item:last-child {
  border-bottom: none;
}

.task-search-item:hover,
.task-search-item--active {
  background: var(
    --n-color-hover,
    color-mix(in srgb, var(--n-primary-color, #409eff) 14%, transparent)
  );
}

.task-search-item-name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--n-text-color-1, #e6e6e6);
}

.task-search-item-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.task-search-item-cwd {
  flex: 0 1 55%;
  min-width: 0;
  font-size: 11px;
  color: var(--n-text-color-3, #bdbdbd);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

.task-search-item-cmd {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--n-text-color-2, #9e9e9e);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-title {
  font-size: 15px;
  font-weight: 600;
}

.version-chip {
  font-size: 12px;
  color: var(--n-text-color-3);
  padding: 2px 8px;
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
}

.version-chip-trigger {
  font: inherit;
  background: transparent;
  cursor: pointer;
  line-height: 1.25;
}

.version-chip-trigger:hover {
  color: var(--n-text-color-2);
  border-color: var(--n-text-color-3);
}

.version-chip--update {
  color: var(--n-success-color);
  border-color: color-mix(in srgb, var(--n-success-color) 45%, var(--n-border-color));
}

.version-popover-inner {
  max-width: 320px;
}

.version-popover-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.version-popover-muted {
  color: var(--n-text-color-3);
  flex-shrink: 0;
}

.version-popover-strong {
  font-weight: 600;
  word-break: break-all;
}

.version-popover-notes {
  margin-top: 6px;
  font-size: 12px;
  white-space: pre-wrap;
  color: var(--n-text-color-2);
  line-height: 1.45;
}

.version-popover-cmd {
  margin-top: 8px;
  font-size: 12px;
}

.version-popover-code {
  display: block;
  margin-top: 4px;
  padding: 8px;
  border-radius: 6px;
  background: var(--n-color-embedded);
  border: 1px solid var(--n-border-color);
  font-size: 12px;
  word-break: break-all;
  color: var(--n-color-primary);
}

@media (max-width: 1100px) {
  .global-search {
    width: 200px;
  }
  .history-search {
    width: 200px;
  }
  .overview-cards {
    grid-template-columns: repeat(2, minmax(150px, 1fr));
  }
}

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

/* Settings modal */
.settings-app-modal :deep(.n-card__content) {
  padding: 0;
  overflow: hidden;
}

.settings-modal-body {
  height: min(76vh, 800px);
  min-height: 280px;
}

.app-notifications-drawer :deep(.n-drawer-body-content-wrapper) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.notifications-drawer-panel-wrap {
  flex: 1;
  min-height: 0;
  height: calc(100dvh - 140px);
}

.app-header-notifications-btn .notif-icon-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.app-header-notifications-btn .notif-unread-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--n-color-error);
  box-shadow: 0 0 0 1px var(--n-color);
}
</style>
