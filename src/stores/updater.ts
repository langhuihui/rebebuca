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
import { ref } from 'vue';

export interface UpdateInfo {
  version: string;
  date: string;
  body: string;
}

export const useUpdaterStore = defineStore('updater', () => {
  // State
  const checking = ref(false);
  const downloading = ref(false);
  const downloadProgress = ref(0);
  const updateAvailable = ref(false);
  const updateInfo = ref<UpdateInfo | null>(null);
  const error = ref<string | null>(null);
  const currentVersion = ref('');
  
  /**
   * Get current app version
   */
  async function getCurrentVersion(): Promise<string> {
    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      currentVersion.value = await getVersion();
      return currentVersion.value;
    } catch (e) {
      console.error('[Updater] Failed to get version:', e);
      return '';
    }
  }
  
  /**
   * Check for updates
   */
  async function checkForUpdates(): Promise<boolean> {
    checking.value = true;
    error.value = null;
    
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      
      if (update) {
        updateAvailable.value = true;
        updateInfo.value = {
          version: update.version,
          date: update.date || '',
          body: update.body || '',
        };
        console.log('[Updater] Update available:', update.version);
        return true;
      } else {
        updateAvailable.value = false;
        updateInfo.value = null;
        console.log('[Updater] No updates available');
        return false;
      }
    } catch (e) {
      error.value = String(e);
      console.error('[Updater] Check failed:', e);
      return false;
    } finally {
      checking.value = false;
    }
  }
  
  /**
   * Download and install update
   */
  async function downloadAndInstall(): Promise<void> {
    if (!updateAvailable.value) {
      throw new Error('No update available');
    }
    
    downloading.value = true;
    downloadProgress.value = 0;
    error.value = null;
    
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      
      const update = await check();
      if (!update) {
        throw new Error('Update not found');
      }
      
      let downloaded = 0;
      let contentLength = 0;
      
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            console.log(`[Updater] Download started, size: ${contentLength}`);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              downloadProgress.value = Math.round((downloaded / contentLength) * 100);
            }
            break;
          case 'Finished':
            downloadProgress.value = 100;
            console.log('[Updater] Download finished');
            break;
        }
      });
      
      console.log('[Updater] Update installed, relaunching...');
      await relaunch();
    } catch (e) {
      error.value = String(e);
      console.error('[Updater] Download/install failed:', e);
      throw e;
    } finally {
      downloading.value = false;
    }
  }
  
  /**
   * Reset state
   */
  function reset() {
    checking.value = false;
    downloading.value = false;
    downloadProgress.value = 0;
    updateAvailable.value = false;
    updateInfo.value = null;
    error.value = null;
  }
  
  return {
    // State
    checking,
    downloading,
    downloadProgress,
    updateAvailable,
    updateInfo,
    error,
    currentVersion,
    
    // Actions
    getCurrentVersion,
    checkForUpdates,
    downloadAndInstall,
    reset,
  };
});
