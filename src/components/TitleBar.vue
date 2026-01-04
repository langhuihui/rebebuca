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
  <div class="custom-titlebar" :class="{ 'light-theme': effectiveTheme === 'light' }" @mousedown="startDrag">
    <div class="titlebar-content" :class="{ 'windows-layout': uiStore.isWindowsPlatform }">
      <!-- Left side for Windows title logo -->
      <div class="titlebar-left" v-if="uiStore.isWindowsPlatform">
        <img
          :src="effectiveTheme === 'light' ? '/text.svg' : '/text.svg'"
          alt="Rebebuca"
          :class="
            effectiveTheme === 'light' ? 'text-logo-light' : 'text-logo-dark'
          "
          class="title-logo"
        />
      </div>

      <!-- Title center for Windows platform -->
      <div class="titlebar-center" v-if="uiStore.isWindowsPlatform">
        <span v-if="uiStore.selectedHistoryItem" class="history-title-display">
          {{ uiStore.selectedHistoryItem.name }}
        </span>
      </div>

      <!-- Window controls - macOS style on the left -->
      <div
        v-if="!uiStore.isWindowsPlatform"
        class="window-controls"
      >
        <button
          class="window-control-button close-btn"
          @click="handleCloseWindow"
          @mousedown.stop
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
          @mousedown.stop
          title="最小化"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="1" y="4.5" width="8" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          class="window-control-button maximize-btn"
          @click="toggleMaximize"
          @mousedown.stop
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

      <!-- Title only for non-Windows -->
      <div class="titlebar-center" v-if="!uiStore.isWindowsPlatform">
        <img
          v-if="!uiStore.selectedHistoryItem"
          :src="effectiveTheme === 'light' ? '/text.svg' : '/text.svg'"
          alt="Rebebuca"
          :class="
            effectiveTheme === 'light' ? 'text-logo-light' : 'text-logo-dark'
          "
          class="title-logo"
        />
        <span v-else class="history-title-display">
          {{ uiStore.selectedHistoryItem.name }}
        </span>
      </div>

      <!-- Right buttons -->
      <div class="titlebar-right">
        <n-dropdown
          :options="uiStore.themeOptions"
          @select="handleThemeSelect"
          trigger="click"
        >
          <n-button
            text
            size="small"
            class="titlebar-button"
            :title="t('titlebar.toggleTheme')"
            @mousedown.stop
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
          @mousedown.stop
        >
          <template #icon>
            <component :is="iconComponents.sidebar" />
          </template>
        </n-button>
        <n-button
          text
          size="small"
          @click="openLogsFolder"
          class="titlebar-button"
          :title="t('history.openLogsFolder')"
          @mousedown.stop
        >
          <template #icon>
            <component :is="svgIcons.folderOpen" />
          </template>
        </n-button>
        <n-button
          text
          size="small"
          @click="showSettingsDialog = true"
          class="titlebar-button"
          :title="t('task.settings')"
          @mousedown.stop
        >
          <template #icon>
            <component :is="svgIcons.settings" />
          </template>
        </n-button>
      </div>

      <!-- Window controls - Windows style on the right -->
      <div
        v-if="uiStore.isWindowsPlatform"
        class="window-controls windows-style"
      >
        <button
          class="window-control-button minimize-btn"
          @click="minimizeWindow"
          @mousedown.stop
          title="最小化"
        >
          <span>−</span>
        </button>
        <button
          class="window-control-button maximize-btn"
          @click="toggleMaximize"
          @mousedown.stop
          title="最大化"
        >
          <span>□</span>
        </button>
        <button
          class="window-control-button close-btn"
          @click="handleCloseWindow"
          @mousedown.stop
          title="关闭"
        >
          <span>×</span>
        </button>
      </div>
    </div>
  </div>
  
  <!-- Settings Dialog -->
  <SettingsDialog
    ref="settingsDialogRef"
    v-model:show="showSettingsDialog"
    :initial-tab="initialSettingsTab"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { NButton, NDropdown, useDialog } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useUIStore } from "../stores/ui";
import { useRunConfigStore } from "../stores/runConfig";
import { useTerminalStore } from "../stores/terminal";
import { useTheme } from "../composables/useTheme";
import { useSettingsStore } from "../stores/settings";
import { iconComponents, svgIcons } from "../utils/icons";
import {
  minimizeWindow,
  toggleMaximize,
  closeWindow,
  startDrag,
} from "../utils/windowControls";
import { SettingsDialog } from "./settings";

interface Props {
  effectiveTheme: string;
}

defineProps<Props>();

const { t } = useI18n();
const uiStore = useUIStore();
const runConfigStore = useRunConfigStore();
const settingsStore = useSettingsStore();
const terminalStore = useTerminalStore();
const dialog = useDialog();
const { setThemeMode } = useTheme();

// Settings dialog state
const showSettingsDialog = ref(false);
const settingsDialogRef = ref<InstanceType<typeof SettingsDialog> | null>(null);
const initialSettingsTab = ref('general');

// Open settings to update tab
const openSettingsUpdate = () => {
  initialSettingsTab.value = 'update';
  showSettingsDialog.value = true;
};

// Initialize settings
onMounted(async () => {
  await settingsStore.initialize();
  
  // Listen for open-settings-update event
  window.addEventListener('open-settings-update', openSettingsUpdate);
});

// Cleanup
onUnmounted(() => {
  window.removeEventListener('open-settings-update', openSettingsUpdate);
});

const handleThemeSelect = (key: string) => {
  setThemeMode(key as "light" | "dark" | "system");
};

const toggleSidebar = () => {
  uiStore.toggleSidebar();
};

// Handle close window with setting check
const handleCloseWindow = async () => {
  const behavior = settingsStore.settings.closeButtonBehavior || 'exit';
  const confirmBeforeClose = settingsStore.settings.confirmBeforeClose;
  
  // Check if there are running tasks and confirmBeforeClose is enabled
  if (confirmBeforeClose && terminalStore.runningTabs.length > 0) {
    dialog.warning({
      title: t('settings.confirmCloseTitle'),
      content: t('settings.confirmCloseContent', { count: terminalStore.runningTabs.length }),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
      onPositiveClick: async () => {
        await performClose(behavior);
      },
    });
    return;
  }
  
  await performClose(behavior);
};

// Perform the actual close action
const performClose = async (behavior: 'hide' | 'exit') => {
  if (behavior === 'hide') {
    // Hide window (minimize to tray)
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      await appWindow.hide();
    } catch (error) {
      console.error('Failed to hide window:', error);
      // Fallback to close
      await closeWindow();
    }
  } else {
    // Default: exit (close window)
    await closeWindow();
  }
};

// Open logs folder
const openLogsFolder = async () => {
  try {
    await runConfigStore.openLogsFolder();
  } catch (error) {
    console.error('Failed to open logs folder:', error);
  }
};
</script>
