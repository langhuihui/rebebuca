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
  <div
    class="custom-titlebar"
    :class="{ 'light-theme': effectiveTheme === 'light' }"
    @mousedown="handleTitlebarMousedown"
    @dblclick="handleTitlebarDoubleClick"
  >
    <div
      class="titlebar-content"
      :class="{ 'windows-layout': uiStore.isWindowsPlatform }"
    >
      <!-- Left side for Windows: logo + buttons -->
      <template v-if="uiStore.isWindowsPlatform && !uiStore.miniMode">
        <div class="titlebar-left-group">
          <img
            :src="effectiveTheme === 'light' ? '/text.svg' : '/text.svg'"
            alt="Rebebuca"
            :class="
              effectiveTheme === 'light' ? 'text-logo-light' : 'text-logo-dark'
            "
            class="title-logo"
          />
          <div class="titlebar-actions">
            <n-space :size="4">
              <n-tooltip>
                <template #trigger>
                  <n-button
                    size="small"
                    quaternary
                    @click="handleAddFolder"
                    class="titlebar-action-button"
                  >
                    <template #icon>
                      <n-icon size="16">
                        <component :is="svgIcons.folderPlus" />
                      </n-icon>
                    </template>
                  </n-button>
                </template>
                {{ t('task.addFolder') }}
              </n-tooltip>
              <n-tooltip>
                <template #trigger>
                  <n-button
                    size="small"
                    quaternary
                    @click="handleAddTask"
                    class="titlebar-action-button"
                  >
                    <template #icon>
                      <n-icon size="16">
                        <component :is="svgIcons.plus" />
                      </n-icon>
                    </template>
                  </n-button>
                </template>
                {{ t('task.addTask') }}
              </n-tooltip>
              <n-tooltip>
                <template #trigger>
                  <n-button
                    size="small"
                    quaternary
                    @click="handlePortManagement"
                    class="titlebar-action-button"
                  >
                    <template #icon>
                      <n-icon size="16">
                        <component :is="svgIcons.network" />
                      </n-icon>
                    </template>
                  </n-button>
                </template>
                {{ t('task.portManagement') }}
              </n-tooltip>
              <n-tooltip v-if="featureFlagsStore.flags.aiCollab">
                <template #trigger>
                  <n-button
                    size="small"
                    quaternary
                    @click="handleAICollabNative"
                    class="titlebar-action-button"
                  >
                    <template #icon>
                      <n-icon size="16">
                        <component :is="svgIcons.zap" />
                      </n-icon>
                    </template>
                  </n-button>
                </template>
                {{ t('aiCollab.nativeMode') }}
              </n-tooltip>
            </n-space>
          </div>
        </div>
      </template>

      <!-- Logo in mini mode for Windows (centered) -->
      <div class="titlebar-center" v-if="uiStore.isWindowsPlatform && uiStore.miniMode">
        <img
          :src="effectiveTheme === 'light' ? '/logo.svg' : '/logo-dark.svg'"
          alt="Rebebuca"
          class="title-logo-icon"
        />
      </div>

      <!-- Title center for Windows platform -->
      <div class="titlebar-center" v-if="uiStore.isWindowsPlatform && !uiStore.miniMode">
        <!-- Show history title -->
        <span
          v-if="uiStore.selectedHistoryItem"
          class="history-title-display"
        >
          {{ uiStore.selectedHistoryItem.name }}
        </span>
      </div>

      <!-- Window controls - macOS style on the left -->
      <div v-if="!uiStore.isWindowsPlatform" class="window-controls">
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

      <!-- Logo after window controls (macOS, hidden in mini mode) -->
      <div
        v-if="!uiStore.isWindowsPlatform && !uiStore.miniMode"
        class="titlebar-left-section"
      >
        <img
          :src="effectiveTheme === 'light' ? '/logo.svg' : '/logo-dark.svg'"
          alt="Rebebuca"
          class="title-logo-icon"
        />
        <div class="titlebar-actions">
          <n-space :size="4">
            <n-tooltip>
              <template #trigger>
                <n-button
                  size="small"
                  quaternary
                  @click="handleAddFolder"
                  class="titlebar-action-button"
                >
                  <template #icon>
                    <n-icon size="16">
                      <component :is="svgIcons.folderPlus" />
                    </n-icon>
                  </template>
                </n-button>
              </template>
              {{ t('task.addFolder') }}
            </n-tooltip>
            <n-tooltip>
              <template #trigger>
                <n-button
                  size="small"
                  quaternary
                  @click="handleAddTask"
                  class="titlebar-action-button"
                >
                  <template #icon>
                    <n-icon size="16">
                      <component :is="svgIcons.plus" />
                    </n-icon>
                  </template>
                </n-button>
              </template>
              {{ t('task.addTask') }}
            </n-tooltip>
            <n-tooltip>
              <template #trigger>
                <n-button
                  size="small"
                  quaternary
                  @click="handlePortManagement"
                  class="titlebar-action-button"
                >
                  <template #icon>
                    <n-icon size="16">
                      <component :is="svgIcons.network" />
                    </n-icon>
                  </template>
                </n-button>
              </template>
              {{ t('task.portManagement') }}
            </n-tooltip>
            <n-tooltip v-if="featureFlagsStore.flags.aiCollab">
              <template #trigger>
                <n-button
                  size="small"
                  quaternary
                  @click="handleAICollabNative"
                  class="titlebar-action-button"
                >
                  <template #icon>
                    <n-icon size="16">
                      <component :is="svgIcons.zap" />
                    </n-icon>
                  </template>
                </n-button>
              </template>
              {{ t('aiCollab.nativeMode') }}
            </n-tooltip>
          </n-space>
        </div>
      </div>

      <!-- Title only for non-Windows (hidden in mini mode) -->
      <div
        class="titlebar-center"
        v-if="!uiStore.isWindowsPlatform && !uiStore.miniMode"
      >
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
        <div class="version-update-group" v-if="!uiStore.miniMode">
          <span class="version-text">v{{ updaterStore.currentVersion }}</span>
          <template v-if="updaterStore.updateAvailable">
            <span class="update-arrow">→</span>
            <span class="new-version-text"
              >v{{ updaterStore.updateInfo?.version }}</span
            >
            <n-button
              type="success"
              size="tiny"
              class="update-button"
              :class="{ updating: updaterStore.downloading }"
              :style="
                updaterStore.downloading
                  ? { '--progress': updaterStore.downloadProgress + '%' }
                  : {}
              "
              :disabled="updaterStore.downloading"
              @click="handleDirectUpdate"
              @mousedown.stop
            >
              <template #icon>
                <n-icon size="12" v-if="!updaterStore.downloading">
                  <component :is="svgIcons.refresh" />
                </n-icon>
              </template>
              <span v-if="updaterStore.downloading" class="progress-text">
                {{ updaterStore.downloadProgress }}%
              </span>
              <span v-else>{{ t("settings.update") }}</span>
            </n-button>
          </template>
        </div>

        <!-- Notification bell button -->
        <n-button
          v-if="!uiStore.miniMode"
          text
          size="small"
          @click="openNotificationDialog"
          class="titlebar-button notification-button"
          :title="t('notifications.title')"
          @mousedown.stop
        >
          <template #icon>
            <n-icon size="18">
              <NotificationsOutline />
            </n-icon>
            <span v-if="notificationCount > 0" class="notification-badge">{{
              notificationCount > 99 ? "99+" : notificationCount
            }}</span>
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
                    ? svgIcons.sun
                    : svgIcons.moon
                "
              />
            </template>
          </n-button>
        </n-dropdown>
        <n-button
          v-if="!uiStore.miniMode"
          text
          size="small"
          @click="() => openSettingsTab()"
          class="titlebar-button"
          :title="t('task.settings')"
          @mousedown.stop
        >
          <template #icon>
            <component :is="svgIcons.settings" />
          </template>
        </n-button>
        <n-button
          v-if="!uiStore.miniMode"
          text
          size="small"
          @click="handleToggleSplitMode"
          class="titlebar-button"
          :class="{ active: terminalStore.isSplitMode }"
          :title="t('titlebar.toggleSplitMode')"
          @mousedown.stop
        >
          <template #icon>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="12" y1="3" x2="12" y2="21"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
            </svg>
          </template>
        </n-button>
        <n-button
          text
          size="small"
          @click="uiStore.toggleMiniMode()"
          class="titlebar-button"
          :title="t('titlebar.toggleMiniMode')"
          @mousedown.stop
        >
          <template #icon>
            <component :is="uiStore.miniMode ? svgIcons.layoutOutline : svgIcons.layout" />
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

  <!-- Notifications Dialog -->
  <n-modal
    v-model:show="showNotifications"
    preset="card"
    :title="t('notifications.title')"
    style="width: 500px"
    to="body"
    @after-leave="closeNotificationDialog"
  >
    <n-scrollbar style="max-height: 400px">
      <div v-if="notifications.length === 0" class="empty-notifications">
        {{ t("notifications.empty") }}
      </div>
      <div v-else ref="notificationsListRef" class="notifications-list">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          :data-notification-id="notification.id"
          class="notification-item"
          :class="{ unread: !notification.read }"
        >
          <div class="notification-header">
            <span class="notification-type">{{
              notification.title || notification.type
            }}</span>
            <span class="notification-time">{{
              formatTime(notification.time)
            }}</span>
          </div>
          <div class="notification-message selectable-text">
            {{ notification.message }}
          </div>
        </div>
      </div>
    </n-scrollbar>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import {
  NButton,
  NModal,
  NScrollbar,
  NTooltip,
  useDialog,
  NIcon,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import { NotificationsOutline } from "@vicons/ionicons5";
import { useUIStore } from "../stores/ui";
import { useTerminalStore } from "../stores/terminal";
import { useTheme } from "../composables/useTheme";
import { useSettingsStore } from "../stores/settings";
import { useUpdaterStore } from "../stores/updater";
import { useNotificationStore } from "../stores/notification";
import { useFeatureFlagsStore } from "../stores/featureFlags";
import { svgIcons } from "../utils/icons";
import {
  minimizeWindow,
  toggleMaximize,
  closeWindow,
  startDrag,
} from "../utils/windowControls";
import "../adapters";

// Handle titlebar mousedown for window dragging
const handleTitlebarMousedown = (event: MouseEvent) => {
  startDrag(event);
};

// Handle double click on titlebar for maximize/restore (macOS behavior)
const handleTitlebarDoubleClick = (event: MouseEvent) => {
  // Don't toggle maximize if clicking on interactive elements
  const target = event.target as HTMLElement;
  if (
    target.closest(".n-button") ||
    target.closest(".n-dropdown") ||
    target.closest(".n-tooltip") ||
    target.closest(".n-space") ||
    target.closest("button") ||
    target.closest(".window-control-button") ||
    target.closest(".window-controls") ||
    target.closest(".titlebar-button") ||
    target.closest(".titlebar-actions") ||
    target.closest(".titlebar-action-button") ||
    target.closest(".update-button") ||
    target.closest(".update-indicator") ||
    target.closest(".notification-button") ||
    target.closest(".version-update-group")
  ) {
    return;
  }
  toggleMaximize();
};

// Action button handlers
const handleAddFolder = () => {
  window.dispatchEvent(new CustomEvent('add-folder'));
};

const handleAddTask = () => {
  window.dispatchEvent(new CustomEvent('add-task'));
};

const handlePortManagement = () => {
  window.dispatchEvent(new CustomEvent('port-management'));
};

const handleAICollabNative = () => {
  window.dispatchEvent(new CustomEvent('ai-collab-native'));
};

// Handle split mode toggle
const handleToggleSplitMode = () => {
  terminalStore.toggleSplitMode();
};

interface Props {
  effectiveTheme: string;
}

defineProps<Props>();

const { t } = useI18n();
const uiStore = useUIStore();
const settingsStore = useSettingsStore();
const terminalStore = useTerminalStore();
const updaterStore = useUpdaterStore();
const notificationStore = useNotificationStore();
const featureFlagsStore = useFeatureFlagsStore();
const dialog = useDialog();
const { setThemeMode } = useTheme();

// Notification dialog state
const showNotifications = ref(false);

// Notification list ref for Intersection Observer
const notificationsListRef = ref<HTMLElement | null>(null);
let notificationObserver: IntersectionObserver | null = null;

// Update check interval (every minute)
let updateCheckInterval: ReturnType<typeof setInterval> | null = null;

// Computed: notification count (unread) - from store
const notificationCount = computed(() => notificationStore.unreadCount);

// Computed: notifications list for display - use displayNotifications from store
const notifications = computed(() => notificationStore.displayNotifications);

// Setup Intersection Observer for auto-marking notifications as read
const setupNotificationObserver = () => {
  if (notificationObserver) {
    notificationObserver.disconnect();
  }

  notificationObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const notificationId = (entry.target as HTMLElement).dataset
            .notificationId;
          if (notificationId) {
            notificationStore.markAsReadInSnapshot(notificationId);
          }
        }
      });
    },
    {
      threshold: 0.5, // 50% visible to mark as read
    }
  );

  // Observe all notification items
  if (notificationsListRef.value) {
    const items =
      notificationsListRef.value.querySelectorAll(".notification-item");
    items.forEach((item) => {
      notificationObserver?.observe(item);
    });
  }
};

// Cleanup observer
const cleanupNotificationObserver = () => {
  if (notificationObserver) {
    notificationObserver.disconnect();
    notificationObserver = null;
  }
};

// Watch for showNotifications changes to setup/cleanup observer
watch(showNotifications, async (newValue) => {
  if (newValue) {
    // Wait for DOM to update
    await nextTick();
    setupNotificationObserver();
  } else {
    cleanupNotificationObserver();
  }
});

// Watch for notifications list changes to re-observe new items
watch(
  notifications,
  async () => {
    if (showNotifications.value) {
      await nextTick();
      setupNotificationObserver();
    }
  },
  { deep: true }
);

// Handle notification dialog open - create tab instead
const openNotificationDialog = () => {
  terminalStore.createNotificationsTab();
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

  if (minutes < 1) return t("notifications.justNow");
  if (minutes < 60) return `${minutes} ${t("notifications.minutesAgo")}`;
  if (hours < 24) return `${hours} ${t("notifications.hoursAgo")}`;
  if (days < 7) return `${days} ${t("notifications.daysAgo")}`;
  return date.toLocaleDateString();
};

// Check for errors and add notifications
const checkForErrors = () => {
  // Check for update available
  if (updaterStore.updateAvailable) {
    notificationStore.addUpdate(
      t("notifications.update"),
      t("notifications.updateAvailable", {
        version: updaterStore.updateInfo?.version,
      })
    );
  }
};

// Open settings tab
const openSettingsTab = (tab?: string) => {
  terminalStore.createSettingsTab(tab || "general");
};

// Open settings to update tab
const openSettingsUpdate = () => {
  terminalStore.createSettingsTab("update");
};

// Handle direct update from titlebar
const handleDirectUpdate = async () => {
  if (updaterStore.downloading) return;

  try {
    await updaterStore.downloadAndInstall();
  } catch (error) {
    console.error("Update failed:", error);
    // If update fails, open settings tab to show error
    terminalStore.createSettingsTab("update");
  }
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
  window.addEventListener("open-settings-update", openSettingsUpdate);

  // Setup periodic update check (every minute)
  updateCheckInterval = setInterval(async () => {
    await updaterStore.checkForUpdates();
  }, 60 * 1000); // 60 seconds
});

// Cleanup
onUnmounted(() => {
  window.removeEventListener("open-settings-update", openSettingsUpdate);

  // Cleanup notification observer
  cleanupNotificationObserver();

  // Clear update check interval
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
});

const handleThemeSelect = (key: string) => {
  setThemeMode(key as "light" | "dark" | "system");
};

// Handle close window with setting check
const handleCloseWindow = async () => {
  const behavior = settingsStore.settings.closeButtonBehavior || "exit";
  const confirmBeforeClose = settingsStore.settings.confirmBeforeClose;

  // Check if there are running tasks and confirmBeforeClose is enabled
  if (confirmBeforeClose && terminalStore.runningTabs.length > 0) {
    dialog.warning({
      title: t("settings.confirmCloseTitle"),
      content: t("settings.confirmCloseContent", {
        count: terminalStore.runningTabs.length,
      }),
      positiveText: t("common.confirm"),
      negativeText: t("common.cancel"),
      onPositiveClick: async () => {
        await performClose(behavior);
      },
    });
    return;
  }

  await performClose(behavior);
};

// Perform the actual close action
const performClose = async (behavior: "hide" | "exit") => {
  if (behavior === "hide") {
    // Hide window (minimize to tray)
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      await appWindow.hide();
    } catch (error) {
      console.error("Failed to hide window:", error);
      // Fallback to close
      await closeWindow();
    }
  } else {
    // Default: exit (close window)
    await closeWindow();
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

.update-arrow {
  font-size: 10px;
  color: #18a058;
  font-weight: bold;
}

.new-version-text {
  font-size: 11px;
  color: #18a058;
  font-weight: 600;
}

.update-button {
  height: 20px;
  padding: 0 8px;
  font-size: 11px;
  border-radius: 4px;
  animation: pulse-button 2s ease-in-out infinite;
  min-width: 50px;
  transition: all 0.3s ease;
}

.update-button.updating {
  animation: none;
  background: linear-gradient(
    90deg,
    #18a058 var(--progress, 0%),
    #36ad6a var(--progress, 0%)
  );
  position: relative;
  overflow: hidden;
}

.update-button.updating::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: var(--progress, 0%);
  background: rgba(255, 255, 255, 0.2);
  transition: width 0.3s ease;
}

.progress-text {
  font-weight: 600;
  font-size: 11px;
  min-width: 32px;
  text-align: center;
}

.update-button :deep(.n-icon) {
  animation: spin 3s linear infinite;
}

@keyframes pulse-button {
  0%,
  100% {
    box-shadow: 0 0 4px rgba(24, 160, 88, 0.4);
  }
  50% {
    box-shadow: 0 0 8px rgba(24, 160, 88, 0.8), 0 0 16px rgba(24, 160, 88, 0.4);
  }
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
  0%,
  100% {
    box-shadow: 0 0 4px rgba(24, 160, 88, 0.4), 0 0 8px rgba(24, 160, 88, 0.3);
  }
  50% {
    box-shadow: 0 0 8px rgba(24, 160, 88, 0.8), 0 0 16px rgba(24, 160, 88, 0.5),
      0 0 24px rgba(24, 160, 88, 0.3);
  }
}

@keyframes bounce {
  0%,
  100% {
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

/* Titlebar action buttons */
.titlebar-actions {
  display: flex;
  align-items: center;
  margin-left: 4px;
  -webkit-app-region: no-drag;
}

.titlebar-action-button {
  height: 28px;
  min-width: 28px;
  padding: 0 6px;
}

.titlebar-action-button :deep(.n-icon) {
  margin-right: 0;
}

/* Left group for logo + actions */
.titlebar-left-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
