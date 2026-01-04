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

import { watch } from 'vue';
import { getAdapter, type BackendAdapter } from '../adapters';
import type { RunningProcessInfo, FavoriteTaskInfo } from '../adapters/types';
import { useTaskManagerStore } from '../stores/taskManager';
import { useTerminalStore } from '../stores/terminal';

// Adapter instance
let adapter: BackendAdapter | null = null;
let initialized = false;

// Cleanup functions for event listeners
const cleanupFns: Array<() => void> = [];

// Watch stop handles
let stopWatchers: Array<() => void> = [];

/**
 * Initialize the tray menu service
 * This should be called once when the app starts
 */
export async function initTrayService() {
  if (initialized) return;
  
  try {
    adapter = await getAdapter();
    
    // Only setup tray on Tauri (desktop app)
    if (adapter.type !== 'tauri') {
      console.log('[TrayService] Not running in Tauri, skipping tray menu setup');
      return;
    }
    
    initialized = true;
    
    // Setup watchers for state changes
    setupWatchers();
    
    // Setup event listeners for tray menu actions
    setupEventListeners();
    
    console.log('[TrayService] Tray service initialized');
  } catch (error) {
    console.error('[TrayService] Failed to initialize:', error);
  }
}

/**
 * Setup watchers to sync state changes to tray menu
 */
function setupWatchers() {
  const taskManager = useTaskManagerStore();
  const terminalStore = useTerminalStore();
  
  // Watch for running tasks changes
  const stopRunningWatch = watch(
    () => terminalStore.runningTabs,
    async (tabs) => {
      if (!adapter || adapter.type !== 'tauri') return;
      
      try {
        // Map running tabs to RunningProcessInfo
        const processes: RunningProcessInfo[] = tabs.map(tab => ({
          id: tab.ptyId,
          name: tab.label || tab.command || 'Unknown',
          taskId: tab.taskId,
        }));
        
        await adapter.tray.updateRunningProcesses(processes);
        console.log('[TrayService] Updated running processes:', processes.length);
      } catch (error) {
        console.error('[TrayService] Failed to update running processes:', error);
      }
    },
    { immediate: true, deep: true }
  );
  stopWatchers.push(stopRunningWatch);
  
  // Watch for favorites changes  
  const stopFavoritesWatch = watch(
    () => taskManager.favoriteTasks,
    async (favorites) => {
      if (!adapter || adapter.type !== 'tauri') return;
      
      try {
        // Map favorite tasks to FavoriteTaskInfo
        const favoriteInfos: FavoriteTaskInfo[] = favorites.map(task => ({
          id: task.id,
          name: task.name,
          command: task.command,
          cwd: task.cwd,
        }));
        
        await adapter.tray.updateFavorites(favoriteInfos);
        console.log('[TrayService] Updated favorites:', favoriteInfos.length);
      } catch (error) {
        console.error('[TrayService] Failed to update favorites:', error);
      }
    },
    { immediate: true, deep: true }
  );
  stopWatchers.push(stopFavoritesWatch);
}

/**
 * Setup event listeners for tray menu actions
 */
function setupEventListeners() {
  if (!adapter || adapter.type !== 'tauri') return;
  
  const taskManager = useTaskManagerStore();
  const terminalStore = useTerminalStore();
  
  // Listen for restart process events
  const cleanupRestart = adapter.tray.onRestartProcess(async (processId: string) => {
    console.log('[TrayService] Restart process requested:', processId);
    
    // Find the tab by ptyId
    const tab = terminalStore.findTabByPtyId(processId);
    if (tab && tab.taskId) {
      // Find the task and restart it
      const task = taskManager.findTask(tab.taskId);
      if (task) {
        try {
          // Stop the current process
          await terminalStore.stopTask(tab.id);
          // Wait a bit for the process to stop
          await new Promise(resolve => setTimeout(resolve, 500));
          // Re-execute the task
          await taskManager.executeTask(task);
          console.log('[TrayService] Task restarted:', task.name);
        } catch (error) {
          console.error('[TrayService] Failed to restart task:', error);
        }
      }
    }
  });
  cleanupFns.push(cleanupRestart);
  
  // Listen for stop process events
  const cleanupStop = adapter.tray.onStopProcess(async (processId: string) => {
    console.log('[TrayService] Stop process requested:', processId);
    
    // Find the tab by ptyId
    const tab = terminalStore.findTabByPtyId(processId);
    if (tab) {
      try {
        await terminalStore.stopTask(tab.id);
        console.log('[TrayService] Task stopped:', tab.label);
      } catch (error) {
        console.error('[TrayService] Failed to stop task:', error);
      }
    }
  });
  cleanupFns.push(cleanupStop);
  
  // Listen for run favorite events
  const cleanupFavorite = adapter.tray.onRunFavorite(async (taskId: string) => {
    console.log('[TrayService] Run favorite requested:', taskId);
    
    // Find the task by id
    const task = taskManager.findTask(taskId);
    if (task) {
      try {
        await taskManager.executeTask(task);
        console.log('[TrayService] Favorite task started:', task.name);
      } catch (error) {
        console.error('[TrayService] Failed to start favorite task:', error);
      }
    } else {
      console.warn('[TrayService] Task not found:', taskId);
    }
  });
  cleanupFns.push(cleanupFavorite);
}

/**
 * Cleanup the tray service
 */
export function cleanupTrayService() {
  // Stop all watchers
  stopWatchers.forEach(stop => stop());
  stopWatchers = [];
  
  // Cleanup all event listeners
  cleanupFns.forEach(fn => fn());
  cleanupFns.length = 0;
  
  initialized = false;
  console.log('[TrayService] Tray service cleaned up');
}
