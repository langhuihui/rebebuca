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
  <n-layout-sider
    v-show="uiStore.historyPanelVisible"
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
        <div v-if="sortedHistory.length > 0" class="history-list">
          <n-list class="history-items">
            <!-- Pinned items -->
            <template v-if="pinnedHistory.length > 0">
              <n-list-item
                v-for="item in pinnedHistory"
                :key="`pinned-${item.id}`"
                class="history-list-item pinned-item"
                :class="{
                  selected: uiStore.selectedHistoryItem?.id === item.id,
                }"
                @click="handleSelectHistory(item)"
                @mouseenter="hoveredHistoryId = item.id"
                @mouseleave="hoveredHistoryId = null"
              >
                <HistoryItem
                  :item="item"
                  :hovered="hoveredHistoryId === item.id"
                  :selected="uiStore.selectedHistoryItem?.id === item.id"
                  :get-program-icon="getProgramIcon"
                  :get-history-status-color="getHistoryStatusColor"
                  :get-history-command="getHistoryCommand"
                  :truncate-text="truncateText"
                  :format-time="formatTime"
                  :format-duration="formatDuration"
                  @pin="handleUnpinHistory"
                  @stop="handleStopHistory"
                  @rerun="handleReRunHistory"
                  @delete="handleDeleteHistory"
                />
              </n-list-item>
              <!-- Divider between pinned and regular items -->
              <div
                v-if="regularHistory.length > 0"
                class="history-divider"
              ></div>
            </template>

            <!-- Regular items -->
            <n-list-item
              v-for="item in regularHistory"
              :key="`regular-${item.id}`"
              class="history-list-item"
              :class="{ selected: uiStore.selectedHistoryItem?.id === item.id }"
              @click="handleSelectHistory(item)"
              @mouseenter="hoveredHistoryId = item.id"
              @mouseleave="hoveredHistoryId = null"
            >
              <HistoryItem
                :item="item"
                :hovered="hoveredHistoryId === item.id"
                :selected="uiStore.selectedHistoryItem?.id === item.id"
                :get-program-icon="getProgramIcon"
                :get-history-status-color="getHistoryStatusColor"
                :get-history-command="getHistoryCommand"
                :truncate-text="truncateText"
                :format-time="formatTime"
                :format-duration="formatDuration"
                @pin="handlePinHistory"
                @stop="handleStopHistory"
                @rerun="handleReRunHistory"
                @delete="handleDeleteHistory"
              />
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
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import {
  NLayoutSider,
  NSpace,
  NButton,
  NScrollbar,
  NList,
  NListItem,
  useDialog,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import { useUIStore } from "../stores/ui";
import { useRunConfigStore } from "../stores/runConfig";
import { iconComponents } from "../utils/icons";
import { getHistoryStatusColor } from "../utils/tabUtils";
import { getProgramIcon } from "../utils/programUtils";
import { formatTime } from "../utils/timeUtils";
import { removeHistoryItem } from "../utils/historyUtils";
import { showClearHistoryDialog } from "../utils/dialogUtils";
import { forceThemeOnFloatingComponents } from "../utils/themeUtils";
import { nextTick } from "vue";
import HistoryItem from "./HistoryItem.vue";
import type { RunHistory } from "../stores/runConfig";

const { t } = useI18n();
const uiStore = useUIStore();
const runConfigStore = useRunConfigStore();
const dialog = useDialog();

const hoveredHistoryId = ref<string | null>(null);

// Computed properties
const runHistory = computed(() => runConfigStore.history);

const sortedHistory = computed(() => {
  const history = [...runHistory.value];
  return history.sort((a, b) => {
    // Pinned items first
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    // Then by timestamp (newest first)
    return b.timestamp.getTime() - a.timestamp.getTime();
  });
});

const pinnedHistory = computed(() =>
  sortedHistory.value.filter((item) => item.pinned)
);
const regularHistory = computed(() =>
  sortedHistory.value.filter((item) => !item.pinned)
);

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

const formatDuration = (startTime?: number, duration?: number) => {
  // If duration is provided (for finished processes), use it
  // Otherwise calculate from startTime (for running processes)
  let actualDuration: number;

  if (duration !== undefined) {
    actualDuration = duration;
  } else if (startTime) {
    actualDuration = Date.now() - startTime;
  } else {
    return "0s";
  }

  const seconds = Math.floor(actualDuration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

const getHistoryCommand = (historyItem: RunHistory) => {
  const config = runConfigStore.getConfig(historyItem.configId);
  if (config) {
    const args =
      config.arguments && config.arguments.length > 0
        ? " " +
          config.arguments
            .map((arg: string) => (arg.includes(" ") ? `"${arg}"` : arg))
            .join(" ")
        : "";
    return `${config.command}${args}`;
  }
  return historyItem.command;
};

// Actions
const handleSelectHistory = (item: RunHistory) => {
  // Toggle selection - if clicking the same item, deselect it
  if (uiStore.selectedHistoryItem?.id === item.id) {
    uiStore.setSelectedHistoryItem(null);
  } else {
    uiStore.setSelectedHistoryItem(item);
  }
};

const handlePinHistory = (item: RunHistory) => {
  runConfigStore.updateHistory(item.id, { pinned: true });
};

const handleUnpinHistory = (item: RunHistory) => {
  runConfigStore.updateHistory(item.id, { pinned: false });
};

const handleStopHistory = async (item: RunHistory) => {
  if (item.pid) {
    try {
      await runConfigStore.stopCurrentRun(item.pid);
      item.output += `\n> ${t("console.stopping")}\n`;
      item.status = "success";

      runConfigStore.updateHistory(item.id, {
        status: "success",
        output: item.output,
      });
    } catch (error) {
      item.output += `\n> ${t("console.stopFailed")}: ${error}\n`;
      item.status = "error";

      runConfigStore.updateHistory(item.id, {
        status: "error",
        output: item.output,
      });
    }
  }
};

const handleReRunHistory = async (history: RunHistory) => {
  const config = runConfigStore.configs.find((c) => c.id === history.configId);
  if (config) {
    // Handle re-run logic here
  }
};

const handleDeleteHistory = async (historyItem: RunHistory) => {
  const index = runConfigStore.history.findIndex(
    (h) => h.id === historyItem.id
  );

  // If process is running, stop it first
  if (historyItem.pid && historyItem.status === "running") {
    try {
      await runConfigStore.stopCurrentRun(historyItem.pid);
    } catch (error) {
      console.error("Failed to stop process:", error);
    }
  }

  // Remove from history
  if (index !== -1) {
    removeHistoryItem(index, runConfigStore);
  }

  // Clear selection if this was the selected item
  if (uiStore.selectedHistoryItem?.id === historyItem.id) {
    uiStore.setSelectedHistoryItem(null);
  }
};

const handleOpenLogsFolder = async () => {
  try {
    await runConfigStore.openLogsFolder();
  } catch (error) {
    console.error("Failed to open logs folder:", error);
  }
};

const handleClearHistory = () => {
  showClearHistoryDialog(
    dialog,
    t,
    runConfigStore,
    forceThemeOnFloatingComponents,
    "light", // theme
    nextTick
  );
};
</script>
