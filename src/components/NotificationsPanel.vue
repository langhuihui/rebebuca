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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { NScrollbar } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useNotificationStore } from "../stores/notification";

const { t } = useI18n();
const notificationStore = useNotificationStore();

// Notification list ref for Intersection Observer
const notificationsListRef = ref<HTMLElement | null>(null);
let notificationObserver: IntersectionObserver | null = null;

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

// Watch for notifications list changes to re-observe new items
watch(
  notifications,
  async () => {
    await nextTick();
    setupNotificationObserver();
  },
  { deep: true }
);

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

onMounted(async () => {
  notificationStore.openDialog();
  await nextTick();
  setupNotificationObserver();
});

onUnmounted(() => {
  cleanupNotificationObserver();
  notificationStore.closeDialog();
});
</script>

<style scoped>
.notifications-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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

.notification-item.unread {
  background-color: var(--n-primary-color-hover, rgba(0, 208, 132, 0.1));
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
  color: var(--n-text-color, rgba(255, 255, 255, 0.9));
}

.notification-time {
  font-size: 11px;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.5));
}

.notification-message {
  font-size: 13px;
  color: var(--n-text-color-2, rgba(255, 255, 255, 0.7));
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
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.5));
  font-size: 14px;
}
</style>

