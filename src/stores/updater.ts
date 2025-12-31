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

export interface ReleaseNote {
  tag: string;
  date: string;
  body: string;
}

// Store instance for persistence
let store: any = null;

// Initialize Tauri store
const initStore = async () => {
  if (!store) {
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      store = await Store.load('rebebuca-config.json');
    } catch (error) {
      console.warn('[Updater] Failed to initialize Tauri store:', error);
      return null;
    }
  }
  return store;
};

export const useUpdaterStore = defineStore('updater', () => {
  // State
  const checking = ref(false);
  const downloading = ref(false);
  const downloadProgress = ref(0);
  const updateAvailable = ref(false);
  const updateInfo = ref<UpdateInfo | null>(null);
  const error = ref<string | null>(null);
  const currentVersion = ref('');
  const hasCheckedOnStartup = ref(false);
  
  // What's new dialog state
  const showWhatsNew = ref(false);
  const whatsNewReleaseNotes = ref<ReleaseNote[]>([]);
  const lastSeenVersion = ref<string>('');
  
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
   * Load last seen version from storage
   */
  async function loadLastSeenVersion(): Promise<string> {
    try {
      const storeInstance = await initStore();
      if (storeInstance) {
        const version = await storeInstance.get('lastSeenVersion');
        lastSeenVersion.value = version || '';
        return lastSeenVersion.value;
      }
    } catch (error) {
      console.error('[Updater] Failed to load last seen version:', error);
    }
    return '';
  }
  
  /**
   * Save last seen version to storage
   */
  async function saveLastSeenVersion(version: string): Promise<void> {
    try {
      const storeInstance = await initStore();
      if (storeInstance) {
        await storeInstance.set('lastSeenVersion', version);
        await storeInstance.save();
        lastSeenVersion.value = version;
      }
    } catch (error) {
      console.error('[Updater] Failed to save last seen version:', error);
    }
  }
  
  /**
   * Check if we should show what's new dialog (after update)
   */
  async function checkWhatsNew(): Promise<boolean> {
    const version = await getCurrentVersion();
    const lastSeen = await loadLastSeenVersion();
    
    if (!version) return false;
    
    // If no last seen version or version changed, show what's new
    if (!lastSeen || lastSeen !== version) {
      console.log(`[Updater] Version changed: ${lastSeen} -> ${version}`);
      
      // Fetch release notes for current version
      try {
        const notes = await fetchReleaseNotes(version);
        if (notes.length > 0) {
          whatsNewReleaseNotes.value = notes;
          showWhatsNew.value = true;
          return true;
        }
      } catch (error) {
        console.error('[Updater] Failed to fetch release notes:', error);
      }
      
      // Save current version even if no notes found
      await saveLastSeenVersion(version);
    }
    
    return false;
  }
  
  /**
   * Dismiss what's new dialog and save version
   */
  async function dismissWhatsNew(): Promise<void> {
    showWhatsNew.value = false;
    if (currentVersion.value) {
      await saveLastSeenVersion(currentVersion.value);
    }
  }
  
  /**
   * Auto check for updates on startup (silent, no error shown)
   */
  async function autoCheckForUpdates(): Promise<void> {
    if (hasCheckedOnStartup.value) return;
    hasCheckedOnStartup.value = true;
    
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
        console.log('[Updater] Auto-check: Update available:', update.version);
      } else {
        updateAvailable.value = false;
        updateInfo.value = null;
        console.log('[Updater] Auto-check: No updates available');
      }
    } catch (e) {
      // Silent fail for auto-check
      console.log('[Updater] Auto-check failed (silent):', e);
    }
  }
  
  /**
   * Fetch release notes for a specific version or recent releases
   */
  async function fetchReleaseNotes(targetVersion?: string): Promise<ReleaseNote[]> {
    try {
      const response = await fetch('https://api.github.com/repos/langhuihui/rebebuca/releases?per_page=5');
      if (!response.ok) throw new Error('Failed to fetch releases');
      const releases = await response.json();
      
      const notes: ReleaseNote[] = releases.map((release: { tag_name: string; published_at: string; body: string }) => ({
        tag: release.tag_name,
        date: new Date(release.published_at).toLocaleDateString(),
        body: release.body || ''
      }));
      
      // If target version specified, find releases since that version
      if (targetVersion) {
        const targetTag = `v${targetVersion}`;
        const targetIndex = notes.findIndex(n => n.tag === targetTag);
        if (targetIndex >= 0) {
          // Return only the current version's notes
          return notes.slice(0, targetIndex + 1);
        }
      }
      
      return notes;
    } catch (error) {
      console.error('[Updater] Failed to fetch release notes:', error);
      return [];
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
    showWhatsNew,
    whatsNewReleaseNotes,
    lastSeenVersion,
    
    // Actions
    getCurrentVersion,
    checkForUpdates,
    autoCheckForUpdates,
    downloadAndInstall,
    reset,
    checkWhatsNew,
    dismissWhatsNew,
    fetchReleaseNotes,
  };
});
