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
  <n-modal
    v-model:show="showModal"
    preset="card"
    :title="currentNotification?.title || t('remoteNotifications.title')"
    style="width: 480px"
    class="remote-notification-modal"
    :closable="true"
    :mask-closable="false"
    @after-leave="onModalClosed"
  >
    <template #header-extra>
      <n-tag v-if="currentNotification" :type="getTagType(currentNotification.type)" size="small">
        {{ getTypeLabel(currentNotification.type) }}
      </n-tag>
    </template>

    <div v-if="currentNotification" class="notification-content">
      <p class="notification-message">{{ currentNotification.message }}</p>
      
      <div v-if="currentNotification.action" class="notification-action">
        <n-button
          type="primary"
          size="small"
          tag="a"
          :href="currentNotification.action.url"
          target="_blank"
        >
          {{ currentNotification.action.label }}
        </n-button>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer">
        <span v-if="totalCount > 1" class="notification-counter">
          {{ currentIndex + 1 }} / {{ totalCount }}
        </span>
        <div class="footer-buttons">
          <n-button v-if="hasNext" @click="showNext">
            {{ t('remoteNotifications.next') }}
          </n-button>
          <n-button type="primary" @click="closeAndMarkRead">
            {{ t('remoteNotifications.gotIt') }}
          </n-button>
        </div>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { NModal, NButton, NTag } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useRemoteNotificationStore } from '../stores/remoteNotification';
import type { RemoteNotification } from '../services/remoteNotificationService';

const { t } = useI18n();
const remoteNotificationStore = useRemoteNotificationStore();

// Modal state
const showModal = ref(false);
const currentIndex = ref(0);

// Notifications to display
const pendingNotifications = ref<RemoteNotification[]>([]);

// Current notification
const currentNotification = computed(() => {
  return pendingNotifications.value[currentIndex.value] || null;
});

// Total count
const totalCount = computed(() => pendingNotifications.value.length);

// Has next notification
const hasNext = computed(() => {
  return currentIndex.value < totalCount.value - 1;
});

// Get tag type based on notification type
const getTagType = (type: RemoteNotification['type']): 'info' | 'warning' | 'success' | 'error' => {
  switch (type) {
    case 'warning':
      return 'warning';
    case 'update':
      return 'success';
    case 'announcement':
      return 'info';
    default:
      return 'info';
  }
};

// Get type label
const getTypeLabel = (type: RemoteNotification['type']): string => {
  switch (type) {
    case 'info':
      return t('remoteNotifications.typeInfo');
    case 'warning':
      return t('remoteNotifications.typeWarning');
    case 'update':
      return t('remoteNotifications.typeUpdate');
    case 'announcement':
      return t('remoteNotifications.typeAnnouncement');
    default:
      return type;
  }
};

// Show next notification
const showNext = async () => {
  if (currentNotification.value) {
    await remoteNotificationStore.markAsRead(currentNotification.value.id);
  }
  if (hasNext.value) {
    currentIndex.value++;
  }
};

// Close modal and mark current as read
const closeAndMarkRead = async () => {
  if (currentNotification.value) {
    await remoteNotificationStore.markAsRead(currentNotification.value.id);
  }
  showModal.value = false;
};

// Handle modal closed
const onModalClosed = () => {
  // Mark remaining as read if user closes modal
  pendingNotifications.value.forEach(async (notification) => {
    if (!remoteNotificationStore.isRead(notification.id)) {
      await remoteNotificationStore.markAsRead(notification.id);
    }
  });
  pendingNotifications.value = [];
  currentIndex.value = 0;
};

// Watch for unread notifications
watch(
  () => remoteNotificationStore.unreadNotifications,
  (unread) => {
    if (unread.length > 0 && !showModal.value && pendingNotifications.value.length === 0) {
      pendingNotifications.value = [...unread];
      currentIndex.value = 0;
      showModal.value = true;
    }
  },
  { immediate: true }
);

// Start checking on mount
onMounted(() => {
  remoteNotificationStore.startPeriodicCheck();
});
</script>

<style scoped>
.remote-notification-modal :deep(.n-card-header) {
  padding: 16px 20px;
}

.remote-notification-modal :deep(.n-card__content) {
  padding: 20px;
}

.remote-notification-modal :deep(.n-card__footer) {
  padding: 12px 20px;
}

.notification-content {
  min-height: 60px;
}

.notification-message {
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-text-color-2);
  margin: 0 0 16px 0;
  white-space: pre-wrap;
}

.notification-action {
  margin-top: 12px;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notification-counter {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.footer-buttons {
  display: flex;
  gap: 8px;
}
</style>
