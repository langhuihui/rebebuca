/**
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
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type NotificationType = 'error' | 'warning' | 'info' | 'update';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: Date;
  read: boolean;
  source?: 'frontend' | 'tauri' | 'process' | 'system';
}

// Maximum notifications to keep
const MAX_NOTIFICATIONS = 50;

// Debounce similar errors (same message within this time window)
const ERROR_DEBOUNCE_MS = 1000;

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([]);
  const lastErrorMessage = ref<string>('');
  const lastErrorTime = ref<number>(0);
  
  // Dialog state: when dialog is open, new notifications go to pending
  const isDialogOpen = ref(false);
  const pendingNotifications = ref<Notification[]>([]);
  // Snapshot of notifications when dialog was opened
  const dialogSnapshot = ref<Notification[]>([]);

  // Computed: unread count (only count non-pending notifications)
  const unreadCount = computed(() => {
    return notifications.value.filter(n => !n.read).length;
  });

  // Get notifications for display in dialog (use snapshot when dialog is open)
  const displayNotifications = computed(() => {
    return isDialogOpen.value ? dialogSnapshot.value : notifications.value;
  });

  // Add a notification
  const addNotification = (
    type: NotificationType,
    title: string,
    message: string,
    source?: 'frontend' | 'tauri' | 'process' | 'system'
  ) => {
    // Debounce similar error messages
    if (type === 'error') {
      const now = Date.now();
      if (message === lastErrorMessage.value && now - lastErrorTime.value < ERROR_DEBOUNCE_MS) {
        return; // Skip duplicate error within debounce window
      }
      lastErrorMessage.value = message;
      lastErrorTime.value = now;
    }

    const notification: Notification = {
      id: `notify-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      time: new Date(),
      read: false,
      source,
    };

    // If dialog is open, add to pending instead
    if (isDialogOpen.value) {
      pendingNotifications.value = [notification, ...pendingNotifications.value];
    } else {
      notifications.value = [notification, ...notifications.value];
    }

    // Keep only last MAX_NOTIFICATIONS
    if (notifications.value.length > MAX_NOTIFICATIONS) {
      notifications.value = notifications.value.slice(0, MAX_NOTIFICATIONS);
    }
    if (pendingNotifications.value.length > MAX_NOTIFICATIONS) {
      pendingNotifications.value = pendingNotifications.value.slice(0, MAX_NOTIFICATIONS);
    }
  };

  // Convenience methods for different types
  const addError = (title: string, message: string, source?: 'frontend' | 'tauri' | 'process' | 'system') => {
    addNotification('error', title, message, source);
  };

  const addWarning = (title: string, message: string, source?: 'frontend' | 'tauri' | 'process' | 'system') => {
    addNotification('warning', title, message, source);
  };

  const addInfo = (title: string, message: string, source?: 'frontend' | 'tauri' | 'process' | 'system') => {
    addNotification('info', title, message, source);
  };

  const addUpdate = (title: string, message: string) => {
    addNotification('update', title, message, 'system');
  };

  // Mark a notification as read
  const markAsRead = (id: string) => {
    const notification = notifications.value.find(n => n.id === id);
    if (notification) {
      notification.read = true;
    }
  };

  // Mark all as read
  const markAllAsRead = () => {
    notifications.value.forEach(n => {
      n.read = true;
    });
  };

  // Clear all notifications
  const clearAll = () => {
    notifications.value = [];
  };

  // Clear read notifications
  const clearRead = () => {
    notifications.value = notifications.value.filter(n => !n.read);
  };

  // Open dialog: take a snapshot of current notifications
  const openDialog = () => {
    isDialogOpen.value = true;
    // Create a deep copy snapshot
    dialogSnapshot.value = notifications.value.map(n => ({ ...n }));
  };

  // Close dialog: clear read notifications and merge pending
  const closeDialog = () => {
    // Mark all displayed notifications as read and remove them
    notifications.value = notifications.value.filter(n => !n.read);
    
    // Merge pending notifications into main list
    if (pendingNotifications.value.length > 0) {
      notifications.value = [...pendingNotifications.value, ...notifications.value];
      pendingNotifications.value = [];
    }
    
    // Clear snapshot
    dialogSnapshot.value = [];
    isDialogOpen.value = false;
  };

  // Mark notification as read in snapshot (for display purposes)
  const markAsReadInSnapshot = (id: string) => {
    // Mark in snapshot
    const snapshotNotification = dialogSnapshot.value.find(n => n.id === id);
    if (snapshotNotification) {
      snapshotNotification.read = true;
    }
    // Also mark in main list
    const notification = notifications.value.find(n => n.id === id);
    if (notification) {
      notification.read = true;
    }
  };

  return {
    notifications,
    unreadCount,
    displayNotifications,
    isDialogOpen,
    addNotification,
    addError,
    addWarning,
    addInfo,
    addUpdate,
    markAsRead,
    markAsReadInSnapshot,
    markAllAsRead,
    clearAll,
    clearRead,
    openDialog,
    closeDialog,
  };
});
