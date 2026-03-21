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
  <div class="notifications-panel">
    <n-scrollbar class="notifications-scrollbar">
      <div v-if="notifications.length === 0" class="empty-notifications">
        {{ t("notifications.empty") }}
      </div>
      <div v-else class="notifications-list">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          :data-notification-id="notification.id"
          class="notification-item"
          :class="{ unread: !notification.read }"
          role="button"
          tabindex="0"
          @click="openDetail(notification)"
          @keydown.enter.prevent="openDetail(notification)"
          @keydown.space.prevent="openDetail(notification)"
        >
          <div class="notification-header">
            <span class="notification-type">{{
              notification.title || notification.type
            }}</span>
            <span class="notification-time">{{
              formatTime(notification.time)
            }}</span>
          </div>

          <div
            v-if="notification.source"
            class="notification-source"
          >
            {{ notification.source }}
          </div>

          <div class="notification-preview selectable-text">
            {{ notification.message }}
          </div>
        </div>
      </div>
    </n-scrollbar>

    <n-drawer
      v-model:show="drawerVisible"
      :width="drawerWidth"
      placement="right"
      display-directive="show"
      :trap-focus="false"
      :block-scroll="false"
      @after-leave="onDrawerAfterLeave"
    >
      <n-drawer-content
        v-if="selected"
        :title="selected.title || selected.type"
        :native-scrollbar="false"
        closable
      >
        <div class="drawer-meta">
          <span class="drawer-time">{{ formatTime(selected.time) }}</span>
          <n-tag
            v-if="selected.type"
            size="small"
            :bordered="false"
            :type="tagTypeForNotification(selected.type)"
          >
            {{ selected.type }}
          </n-tag>
          <n-tag
            v-if="selected.source"
            size="small"
            :bordered="false"
          >
            {{ selected.source }}
          </n-tag>
        </div>
        <n-scrollbar class="drawer-message-scroll">
          <pre class="drawer-message selectable-text">{{ selected.message }}</pre>
        </n-scrollbar>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, onBeforeUnmount } from "vue";
import { NScrollbar, NDrawer, NDrawerContent, NTag } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useNotificationStore, type Notification, type NotificationType } from "../stores/notification";

const { t } = useI18n();
const notificationStore = useNotificationStore();

const drawerVisible = ref(false);
const selected = ref<Notification | null>(null);
const winWidth = ref(
  typeof window !== "undefined" ? window.innerWidth : 1024,
);

const notifications = computed(() => notificationStore.displayNotifications);

const drawerWidth = computed(() =>
  Math.min(520, Math.max(320, winWidth.value - 48)),
);

function tagTypeForNotification(
  type: NotificationType,
): "default" | "info" | "success" | "warning" | "error" {
  switch (type) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "update":
      return "success";
    case "info":
      return "info";
    default:
      return "default";
  }
}

function openDetail(n: Notification) {
  selected.value = n;
  drawerVisible.value = true;
  notificationStore.markAsReadInSnapshot(n.id);
}

function onDrawerAfterLeave() {
  selected.value = null;
}

function syncWindowWidth() {
  if (typeof window !== "undefined") {
    winWidth.value = window.innerWidth;
  }
}

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
  return date.toLocaleString();
};

onMounted(async () => {
  notificationStore.openDialog();
  await nextTick();
  syncWindowWidth();
  window.addEventListener("resize", syncWindowWidth);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", syncWindowWidth);
});

onUnmounted(() => {
  drawerVisible.value = false;
  selected.value = null;
  notificationStore.closeDialog();
});

</script>

<style scoped>
.notifications-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.notifications-scrollbar {
  flex: 1;
  height: 100%;
}

.notifications-list {
  padding: 0;
}

.notification-item {
  padding: 12px 16px;
  border-bottom: 1px solid var(--n-border-color, rgba(255, 255, 255, 0.1));
  cursor: pointer;
  transition: background-color 0.2s;
}

.notification-item:hover {
  background-color: var(--n-color-hover, rgba(255, 255, 255, 0.05));
}

.notification-item:focus-visible {
  outline: 2px solid var(--n-primary-color);
  outline-offset: -2px;
}

.notification-item.unread {
  background-color: var(--n-primary-color-hover, rgba(0, 208, 132, 0.1));
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  gap: 8px;
}

.notification-type {
  font-size: 13px;
  font-weight: 600;
  color: var(--n-text-color, rgba(255, 255, 255, 0.9));
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-time {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.5));
}

.notification-source {
  font-size: 11px;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.45));
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.notification-preview {
  font-size: 13px;
  color: var(--n-text-color-2, rgba(255, 255, 255, 0.7));
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Allow text selection in notification messages */
.selectable-text {
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
  cursor: text;
}

.notification-preview.selectable-text {
  cursor: pointer;
}

.empty-notifications {
  text-align: center;
  padding: 40px;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.5));
  font-size: 14px;
}

.drawer-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.drawer-time {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.drawer-message-scroll {
  max-height: calc(100vh - 180px);
}

.drawer-message {
  margin: 0;
  padding: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--n-text-color);
}
</style>
