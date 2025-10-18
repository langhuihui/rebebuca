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
  <div class="console-area">
    <!-- Welcome screen when no history is selected -->
    <WelcomeScreen
      v-if="!uiStore.selectedHistoryItem"
      :effective-theme="effectiveTheme"
    />

    <!-- Console output for selected history item -->
    <div v-else class="console-content">
      <!-- Console toolbar -->
      <n-space class="mb-2 console-toolbar" size="small">
        <!-- 重放/运行按钮 -->
        <n-button size="small" text @click="handleRestartHistory">
          <template #icon>
            <component :is="iconComponents.replay" />
          </template>
        </n-button>

        <!-- 停止按钮 (仅运行中显示) -->
        <n-button
          v-if="uiStore.selectedHistoryItem.status === 'running'"
          size="small"
          text
          @click="handleStopHistory"
        >
          <template #icon>
            <component :is="iconComponents.stop(true)" />
          </template>
        </n-button>

        <!-- 下载/导出按钮 -->
        <n-button size="small" text @click="handleExportHistory">
          <template #icon>
            <component :is="iconComponents.export" />
          </template>
        </n-button>

        <!-- 清空按钮 -->
        <n-button size="small" text @click="handleClearHistoryOutput">
          <template #icon>
            <component :is="iconComponents.clear" />
          </template>
        </n-button>

        <!-- 命令行内容显示 -->
        <n-text depth="3" class="command-display">
          {{ getHistoryCommand(uiStore.selectedHistoryItem) }}
        </n-text>
      </n-space>

      <!-- Console output -->
      <div class="console-output-container">
        <n-scrollbar
          class="console-scrollbar"
          :ref="(el: any) => consoleScrollbarRef = el"
        >
          <pre
            class="console-output"
            v-html="
              convertAnsiToHtml(
                uiStore.selectedHistoryItem.output || '',
                appStore.ansiConverter
              )
            "
          ></pre>
        </n-scrollbar>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NSpace, NButton, NScrollbar, NText } from "naive-ui";
import { useUIStore } from "../stores/ui";
import { useAppStore } from "../stores/app";
import { useTheme } from "../composables/useTheme";
import { useRunConfigStore } from "../stores/runConfig";
import { iconComponents } from "../utils/icons";
import { convertAnsiToHtml } from "../utils/ansiUtils";
import { handleExportTab } from "../utils/tabOperations";
import WelcomeScreen from "./WelcomeScreen.vue";
import type { RunHistory } from "../stores/runConfig";

const uiStore = useUIStore();
const appStore = useAppStore();
const { effectiveTheme } = useTheme();
const runConfigStore = useRunConfigStore();

const consoleScrollbarRef = ref<any>(null);

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

const handleRestartHistory = () => {
  if (uiStore.selectedHistoryItem) {
    // Handle restart logic here
  }
};

const handleStopHistory = () => {
  if (uiStore.selectedHistoryItem) {
    // Handle stop logic here
  }
};

const handleExportHistory = () => {
  if (uiStore.selectedHistoryItem) {
    handleExportTab({
      output: uiStore.selectedHistoryItem.output || "",
      name: uiStore.selectedHistoryItem.name,
    });
  }
};

const handleClearHistoryOutput = () => {
  if (uiStore.selectedHistoryItem) {
    uiStore.selectedHistoryItem.output = "";
    runConfigStore.updateHistory(uiStore.selectedHistoryItem.id, {
      output: "",
    });
  }
};
</script>
