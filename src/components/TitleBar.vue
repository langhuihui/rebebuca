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
        <!-- Version and Update indicator -->
        <div class="version-update-group">
          <span class="version-text">v{{ updaterStore.currentVersion }}</span>
          <n-tooltip v-if="updaterStore.updateAvailable" trigger="hover">
            <template #trigger>
              <span class="update-indicator" @click="openSettingsUpdate" @mousedown.stop>
                <n-icon size="12">
                  <component :is="svgIcons.refresh" />
                </n-icon>
              </span>
            </template>
            {{ t('settings.updateAvailable') }}: v{{ updaterStore.updateInfo?.version }}
          </n-tooltip>
        </div>

        <!-- Notification bell button -->
        <n-button
          text
          size="small"
          @click="openNotificationDialog"
          class="titlebar-button notification-button"
          title="Notifications"
          @mousedown.stop
        >
          <template #icon>
            <n-icon size="18">
              <NotificationsOutline />
            </n-icon>
            <span v-if="notificationCount > 0" class="notification-badge">{{ notificationCount > 99 ? '99+' : notificationCount }}</span>
          </template>
        </n-button>

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
          @click="openGitHub"
          class="titlebar-button"
          title="GitHub"
          @mousedown.stop
        >
          <template #icon>
            <component :is="svgIcons.github" />
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

  <!-- Notifications Dialog -->
  <n-modal
    v-model:show="showNotifications"
    preset="card"
    :title="t('notifications.title')"
    style="width: 500px;"
    to="body"
    @after-leave="closeNotificationDialog"
  >
    <n-scrollbar style="max-height: 400px;">
      <div v-if="notifications.length === 0" class="empty-notifications">
        {{ t('notifications.empty') }}
      </div>
      <div v-else class="notifications-list">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="notification-item"
          :class="{ 'unread': !notification.read }"
          @click="notificationStore.markAsReadInSnapshot(notification.id)"
        >
          <div class="notification-header">
            <span class="notification-type">{{ notification.title || notification.type }}</span>
            <span class="notification-time">{{ formatTime(notification.time) }}</span>
          </div>
          <div class="notification-message selectable-text">{{ notification.message }}</div>
        </div>
      </div>
    </n-scrollbar>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { NButton, NDropdown, NModal, NScrollbar, useDialog, NIcon } from "naive-ui";
import { useI18n } from "vue-i18n";
import { NotificationsOutline } from "@vicons/ionicons5";
import { useUIStore } from "../stores/ui";
import { useRunConfigStore } from "../stores/runConfig";
import { useTerminalStore } from "../stores/terminal";
import { useTheme } from "../composables/useTheme";
import { useSettingsStore } from "../stores/settings";
import { useUpdaterStore } from "../stores/updater";
import { useNotificationStore } from "../stores/notification";
import { iconComponents, svgIcons } from "../utils/icons";
import {
  minimizeWindow,
  toggleMaximize,
  closeWindow,
  startDrag,
} from "../utils/windowControls";
import { SettingsDialog } from "./settings";
import { getAdapter } from "../adapters";

interface Props {
  effectiveTheme: string;
}

defineProps<Props>();

const { t } = useI18n();
const uiStore = useUIStore();
const runConfigStore = useRunConfigStore();
const settingsStore = useSettingsStore();
const terminalStore = useTerminalStore();
const updaterStore = useUpdaterStore();
const notificationStore = useNotificationStore();
const dialog = useDialog();
const { setThemeMode } = useTheme();

// Settings dialog state
const showSettingsDialog = ref(false);

// Notification dialog state
const showNotifications = ref(false);

// Update check interval (every minute)
let updateCheckInterval: ReturnType<typeof setInterval> | null = null;

// Computed: notification count (unread) - from store
const notificationCount = computed(() => notificationStore.unreadCount);

// Computed: notifications list for display - use displayNotifications from store
const notifications = computed(() => notificationStore.displayNotifications);

// Handle notification dialog open
const openNotificationDialog = () => {
  notificationStore.openDialog();
  showNotifications.value = true;
};

// Handle notification dialog close
const closeNotificationDialog = () => {
  showNotifications.value = false;
  notificationStore.closeDialog();
};

// Format time for display
const formatTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return t('notifications.justNow');
  if (minutes < 60) return `${minutes} ${t('notifications.minutesAgo')}`;
  if (hours < 24) return `${hours} ${t('notifications.hoursAgo')}`;
  if (days < 7) return `${days} ${t('notifications.daysAgo')}`;
  return date.toLocaleDateString();
};

// Check for errors and add notifications
const checkForErrors = () => {
  // Check for update available
  if (updaterStore.updateAvailable) {
    notificationStore.addUpdate(
      t('notifications.update'),
      t('notifications.updateAvailable', { version: updaterStore.updateInfo?.version })
    );
  }
};

const settingsDialogRef = ref<InstanceType<typeof SettingsDialog> | null>(null);
const initialSettingsTab = ref('general');

// Open settings to update tab
const openSettingsUpdate = () => {
  initialSettingsTab.value = 'update';
  showSettingsDialog.value = true;
};

// Initialize
onMounted(async () => {
  await settingsStore.initialize();
  
  // Get current version
  await updaterStore.getCurrentVersion();
  
  // Check for updates immediately
  await updaterStore.autoCheckForUpdates();
  
  // Check for errors and notifications
  checkForErrors();
  
  // Listen for open-settings-update event
  window.addEventListener('open-settings-update', openSettingsUpdate);
  
  // Setup periodic update check (every minute)
  updateCheckInterval = setInterval(async () => {
    await updaterStore.checkForUpdates();
  }, 60 * 1000); // 60 seconds
});

// Cleanup
onUnmounted(() => {
  window.removeEventListener('open-settings-update', openSettingsUpdate);
  
  // Clear update check interval
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
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

// Open GitHub
const openGitHub = async () => {
  try {
    const adapter = await getAdapter();
    await adapter.system.openExternal('https://github.com/langhuihui/rebebuca');
  } catch (error) {
    console.error('Failed to open GitHub:', error);
  }
};
</script>

<style scoped>
/* Version and update group */
.version-update-group {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: 8px;
  padding-right: 8px;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.version-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
}

.update-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, #18a058, #36ad6a);
  color: white;
  cursor: pointer;
  animation: pulse-glow 2s ease-in-out infinite, bounce 1s ease-in-out infinite;
  box-shadow: 0 0 8px rgba(24, 160, 88, 0.6);
}

.update-indicator :deep(.n-icon) {
  animation: spin 3s linear infinite;
}

.update-indicator:hover {
  background: linear-gradient(135deg, #36ad6a, #18a058);
  transform: scale(1.1);
  box-shadow: 0 0 12px rgba(24, 160, 88, 0.8);
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 4px rgba(24, 160, 88, 0.4), 0 0 8px rgba(24, 160, 88, 0.3);
  }
  50% {
    box-shadow: 0 0 8px rgba(24, 160, 88, 0.8), 0 0 16px rgba(24, 160, 88, 0.5), 0 0 24px rgba(24, 160, 88, 0.3);
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Light theme */
:global(.n-config-provider--light) .version-update-group {
  border-right-color: rgba(0, 0, 0, 0.1);
}

:global(.n-config-provider--light) .version-text {
  color: rgba(0, 0, 0, 0.45);
}

/* Notification button styles */
.notification-button {
  position: relative;
}

.notification-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background-color: #ff4d4f;
  color: white;
  font-size: 10px;
  font-weight: 600;
  min-width: 14px;
  height: 14px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  line-height: 1;
  pointer-events: none;
}

/* Light theme */
:global(.n-config-provider--light) .notification-badge {
  background-color: #f5222d;
}

/* Notification dialog styles */
.notifications-list {
  padding: 0;
}

.notification-item {
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: background-color 0.2s;
}

.notification-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.notification-item.unread {
  background-color: rgba(0, 208, 132, 0.1);
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.notification-type {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.notification-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.notification-message {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
}

/* Allow text selection in notification messages */
.selectable-text {
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
  cursor: text;
}

.empty-notifications {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

/* Light theme notifications */
:global(.n-config-provider--light) .notification-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

:global(.n-config-provider--light) .notification-item.unread {
  background-color: rgba(24, 160, 88, 0.1);
}

:global(.n-config-provider--light) .notification-type {
  color: rgba(0, 0, 0, 0.85);
}

:global(.n-config-provider--light) .notification-time {
  color: rgba(0, 0, 0, 0.5);
}

:global(.n-config-provider--light) .notification-message {
  color: rgba(0, 0, 0, 0.7);
}

:global(.n-config-provider--light) .empty-notifications {
  color: rgba(0, 0, 0, 0.45);
}
</style>
