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

import { getAdapter, type BackendAdapter } from '../adapters';
import { tauriFetch } from '../utils/tauriFetch';

// R2 notification file URL
const NOTIFICATION_URL = 'https://download.m7s.live/rb/notification.json';

// Storage key for read notification IDs
const READ_NOTIFICATIONS_KEY = 'readNotificationIds';

// Remote notification interface
export interface RemoteNotification {
  id: string;
  type: 'info' | 'warning' | 'update' | 'announcement';
  title: string;
  message: string;
  // Optional: version range to show notification (e.g., ">=0.5.0", "<1.0.0")
  versionRange?: string;
  // Optional: expiration date (ISO string)
  expiresAt?: string;
  // Optional: priority (higher = more important)
  priority?: number;
  // Optional: action button
  action?: {
    label: string;
    url: string;
  };
}

// Response from R2
interface NotificationResponse {
  notifications: RemoteNotification[];
  // Optional: timestamp of last update
  lastUpdated?: string;
}

// Adapter instance
let adapter: BackendAdapter | null = null;

// Initialize adapter
const initAdapter = async (): Promise<BackendAdapter | null> => {
  if (!adapter) {
    try {
      adapter = await getAdapter();
    } catch (error) {
      console.warn('[RemoteNotification] Failed to initialize adapter:', error);
      return null;
    }
  }
  return adapter;
};

/**
 * Fetch notifications from R2
 */
export async function fetchRemoteNotifications(): Promise<RemoteNotification[]> {
  try {
    const response = await tauriFetch(NOTIFICATION_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('[RemoteNotification] Failed to fetch notifications:', response.status);
      return [];
    }

    const data: NotificationResponse = await response.json();
    
    // Filter out expired notifications
    const now = new Date();
    const validNotifications = data.notifications.filter(notification => {
      if (notification.expiresAt) {
        return new Date(notification.expiresAt) > now;
      }
      return true;
    });

    // Sort by priority (higher first)
    validNotifications.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    console.log('[RemoteNotification] Fetched notifications:', validNotifications.length);
    return validNotifications;
  } catch (error) {
    console.error('[RemoteNotification] Error fetching notifications:', error);
    return [];
  }
}

/**
 * Get read notification IDs from local storage
 */
export async function getReadNotificationIds(): Promise<string[]> {
  try {
    const adapterInstance = await initAdapter();
    if (adapterInstance) {
      const readIds = await adapterInstance.storage.get<string[]>(READ_NOTIFICATIONS_KEY);
      return readIds || [];
    }
  } catch (error) {
    console.error('[RemoteNotification] Failed to get read notification IDs:', error);
  }
  return [];
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const adapterInstance = await initAdapter();
    if (adapterInstance) {
      const readIds = await getReadNotificationIds();
      if (!readIds.includes(notificationId)) {
        readIds.push(notificationId);
        await adapterInstance.storage.set(READ_NOTIFICATIONS_KEY, readIds);
        await adapterInstance.storage.save();
        console.log('[RemoteNotification] Marked notification as read:', notificationId);
      }
    }
  } catch (error) {
    console.error('[RemoteNotification] Failed to mark notification as read:', error);
  }
}

/**
 * Mark multiple notifications as read
 */
export async function markNotificationsAsRead(notificationIds: string[]): Promise<void> {
  try {
    const adapterInstance = await initAdapter();
    if (adapterInstance) {
      const readIds = await getReadNotificationIds();
      const newIds = notificationIds.filter(id => !readIds.includes(id));
      if (newIds.length > 0) {
        readIds.push(...newIds);
        await adapterInstance.storage.set(READ_NOTIFICATIONS_KEY, readIds);
        await adapterInstance.storage.save();
        console.log('[RemoteNotification] Marked notifications as read:', newIds);
      }
    }
  } catch (error) {
    console.error('[RemoteNotification] Failed to mark notifications as read:', error);
  }
}

/**
 * Get unread notifications
 */
export async function getUnreadNotifications(): Promise<RemoteNotification[]> {
  const [allNotifications, readIds] = await Promise.all([
    fetchRemoteNotifications(),
    getReadNotificationIds(),
  ]);

  return allNotifications.filter(notification => !readIds.includes(notification.id));
}

/**
 * Clear all read notification records (for debugging/testing)
 */
export async function clearReadNotifications(): Promise<void> {
  try {
    const adapterInstance = await initAdapter();
    if (adapterInstance) {
      await adapterInstance.storage.set(READ_NOTIFICATIONS_KEY, []);
      await adapterInstance.storage.save();
      console.log('[RemoteNotification] Cleared all read notification records');
    }
  } catch (error) {
    console.error('[RemoteNotification] Failed to clear read notifications:', error);
  }
}
