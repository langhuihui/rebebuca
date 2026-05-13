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

import { ref } from 'vue';
import { getAdapter, type BackendAdapter } from '../adapters';
import type { RunningProcessInfo, FavoriteTaskInfo } from '../adapters/types';

// Adapter instance cache
let adapter: BackendAdapter | null = null;
let initialized = false;

// Event listener cleanup functions
const cleanupFunctions: Array<() => void> = [];

/**
 * Composable for managing tray menu functionality
 * Syncs running processes and favorites to the system tray menu
 */
export function useTrayMenu() {
  const isReady = ref(false);

  /**
   * Initialize the tray menu service
   */
  async function init() {
    if (initialized) return;
    
    try {
      adapter = await getAdapter();
      
      // No system tray in browser / Node web UI
      if (!adapter) return;
      initialized = true;
      isReady.value = true;
      console.log('[TrayMenu] Tray menu service initialized');
    } catch (error) {
      console.error('[TrayMenu] Failed to initialize:', error);
    }
  }

  /**
   * Update the running processes shown in the tray menu
   */
  async function updateRunningProcesses(processes: RunningProcessInfo[]) {
    if (!adapter) return;
    
    try {
      await adapter.tray.updateRunningProcesses(processes);
      console.log('[TrayMenu] Updated running processes:', processes.length);
    } catch (error) {
      console.error('[TrayMenu] Failed to update running processes:', error);
    }
  }

  /**
   * Update the favorite tasks shown in the tray menu
   */
  async function updateFavorites(favorites: FavoriteTaskInfo[]) {
    if (!adapter) return;
    
    try {
      await adapter.tray.updateFavorites(favorites);
      console.log('[TrayMenu] Updated favorites:', favorites.length);
    } catch (error) {
      console.error('[TrayMenu] Failed to update favorites:', error);
    }
  }

  /**
   * Register a callback for when user clicks "Restart" on a running process
   */
  function onRestartProcess(callback: (processId: string) => void): () => void {
    if (!adapter) return () => {};
    
    const cleanup = adapter.tray.onRestartProcess(callback);
    cleanupFunctions.push(cleanup);
    return cleanup;
  }

  /**
   * Register a callback for when user clicks "Stop" on a running process
   */
  function onStopProcess(callback: (processId: string) => void): () => void {
    if (!adapter) return () => {};
    
    const cleanup = adapter.tray.onStopProcess(callback);
    cleanupFunctions.push(cleanup);
    return cleanup;
  }

  /**
   * Register a callback for when user clicks on a favorite task to run it
   */
  function onRunFavorite(callback: (taskId: string) => void): () => void {
    if (!adapter) return () => {};
    
    const cleanup = adapter.tray.onRunFavorite(callback);
    cleanupFunctions.push(cleanup);
    return cleanup;
  }

  /**
   * Cleanup all event listeners
   */
  function cleanup() {
    cleanupFunctions.forEach(fn => fn());
    cleanupFunctions.length = 0;
  }

  return {
    isReady,
    init,
    updateRunningProcesses,
    updateFavorites,
    onRestartProcess,
    onStopProcess,
    onRunFavorite,
    cleanup,
  };
}

// Singleton instance for global access
let trayMenuInstance: ReturnType<typeof useTrayMenu> | null = null;

/**
 * Get the singleton tray menu instance
 */
export function getTrayMenu() {
  if (!trayMenuInstance) {
    trayMenuInstance = useTrayMenu();
  }
  return trayMenuInstance;
}
