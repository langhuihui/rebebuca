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
import {
  fetchRemoteNotifications,
  getReadNotificationIds,
  markNotificationAsRead as markAsReadInStorage,
  markNotificationsAsRead as markMultipleAsReadInStorage,
  type RemoteNotification,
} from '../services/remoteNotificationService';

// Check interval: 1 hour
const CHECK_INTERVAL = 60 * 60 * 1000;

export const useRemoteNotificationStore = defineStore('remoteNotification', () => {
  // All fetched notifications
  const notifications = ref<RemoteNotification[]>([]);
  
  // Read notification IDs
  const readIds = ref<string[]>([]);
  
  // Loading state
  const isLoading = ref(false);
  
  // Last check time
  const lastCheckTime = ref<number>(0);
  
  // Check interval ID
  let checkIntervalId: number | null = null;

  // Computed: unread notifications
  const unreadNotifications = computed(() => {
    return notifications.value.filter(n => !readIds.value.includes(n.id));
  });

  // Computed: unread count
  const unreadCount = computed(() => {
    return unreadNotifications.value.length;
  });

  // Computed: has unread notifications
  const hasUnread = computed(() => {
    return unreadCount.value > 0;
  });

  /**
   * Fetch notifications and update state
   */
  async function fetchNotifications(): Promise<void> {
    if (isLoading.value) return;

    isLoading.value = true;
    try {
      const [fetched, read] = await Promise.all([
        fetchRemoteNotifications(),
        getReadNotificationIds(),
      ]);

      notifications.value = fetched;
      readIds.value = read;
      lastCheckTime.value = Date.now();

      console.log('[RemoteNotificationStore] Fetched notifications:', {
        total: fetched.length,
        read: read.length,
        unread: fetched.length - read.filter(id => fetched.some(n => n.id === id)).length,
      });
    } catch (error) {
      console.error('[RemoteNotificationStore] Failed to fetch notifications:', error);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Mark a notification as read
   */
  async function markAsRead(notificationId: string): Promise<void> {
    if (readIds.value.includes(notificationId)) return;

    // Optimistically update local state
    readIds.value.push(notificationId);

    // Persist to storage
    await markAsReadInStorage(notificationId);
  }

  /**
   * Mark all notifications as read
   */
  async function markAllAsRead(): Promise<void> {
    const unreadIds = unreadNotifications.value.map(n => n.id);
    if (unreadIds.length === 0) return;

    // Optimistically update local state
    readIds.value.push(...unreadIds);

    // Persist to storage
    await markMultipleAsReadInStorage(unreadIds);
  }

  /**
   * Start periodic checking
   */
  function startPeriodicCheck(): void {
    if (checkIntervalId) {
      clearInterval(checkIntervalId);
    }

    // Check immediately on start
    fetchNotifications();

    // Then check periodically
    checkIntervalId = window.setInterval(() => {
      fetchNotifications();
    }, CHECK_INTERVAL);

    console.log('[RemoteNotificationStore] Started periodic notification check');
  }

  /**
   * Stop periodic checking
   */
  function stopPeriodicCheck(): void {
    if (checkIntervalId) {
      clearInterval(checkIntervalId);
      checkIntervalId = null;
      console.log('[RemoteNotificationStore] Stopped periodic notification check');
    }
  }

  /**
   * Get a notification by ID
   */
  function getNotificationById(id: string): RemoteNotification | undefined {
    return notifications.value.find(n => n.id === id);
  }

  /**
   * Check if a notification is read
   */
  function isRead(notificationId: string): boolean {
    return readIds.value.includes(notificationId);
  }

  return {
    // State
    notifications,
    readIds,
    isLoading,
    lastCheckTime,
    
    // Computed
    unreadNotifications,
    unreadCount,
    hasUnread,
    
    // Actions
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    startPeriodicCheck,
    stopPeriodicCheck,
    getNotificationById,
    isRead,
  };
});
