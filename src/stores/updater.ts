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
import { getAdapter, isTauri, type BackendAdapter } from '../adapters';

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

// Adapter instance
let adapter: BackendAdapter | null = null;

const getAdapterInstance = async (): Promise<BackendAdapter> => {
  if (!adapter) {
    adapter = await getAdapter();
  }
  return adapter;
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
  
  // Current version release note (for displaying current version features)
  const currentVersionNote = ref<ReleaseNote | null>(null);
  // New version release note (for displaying upgrade available)
  const newVersionNote = ref<ReleaseNote | null>(null);
  
  /**
   * Get current app version
   */
  async function getCurrentVersion(): Promise<string> {
    try {
      if (!isTauri()) {
        currentVersion.value = '0.0.0-web';
        return currentVersion.value;
      }
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
      const adapterInstance = await getAdapterInstance();
      const version = await adapterInstance.storage.get<string>('lastSeenVersion');
      lastSeenVersion.value = version || '';
      return lastSeenVersion.value;
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
      const adapterInstance = await getAdapterInstance();
      await adapterInstance.storage.set('lastSeenVersion', version);
      await adapterInstance.storage.save();
      lastSeenVersion.value = version;
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
      
      // Fetch release note for current version only
      try {
        const note = await fetchCurrentVersionNote();
        if (note) {
          // Only show current version's release note
          whatsNewReleaseNotes.value = [note];
          showWhatsNew.value = true;
          
          // Also check if there's a newer version available
          await checkNewVersionAvailable();
          
          return true;
        }
      } catch (error) {
        console.error('[Updater] Failed to fetch release notes:', error);
      }
      
      // Save current version even if no notes found
      await saveLastSeenVersion(version);
    } else {
      // Even if version hasn't changed, check for new version available
      await checkNewVersionAvailable();
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
    
    if (!isTauri()) {
      console.log('[Updater] Auto-check skipped in non-Tauri environment');
      return;
    }
    
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
      console.log('[Updater] Auto-check failed (silent):', e);
    }
  }
  
  /**
   * Fetch release notes for a specific version or recent releases
   */
  async function fetchReleaseNotes(targetVersion?: string): Promise<ReleaseNote[]> {
    try {
      const response = await fetch('https://api.github.com/repos/langhuihui/rebebuca/releases?per_page=10');
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
   * Fetch current version's release note only
   */
  async function fetchCurrentVersionNote(): Promise<ReleaseNote | null> {
    try {
      const version = currentVersion.value || await getCurrentVersion();
      if (!version) return null;
      
      const targetTag = `v${version}`;
      const response = await fetch(`https://api.github.com/repos/langhuihui/rebebuca/releases/tags/${targetTag}`);
      
      if (!response.ok) {
        console.log(`[Updater] No release found for tag ${targetTag}`);
        return null;
      }
      
      const release = await response.json();
      const note: ReleaseNote = {
        tag: release.tag_name,
        date: new Date(release.published_at).toLocaleDateString(),
        body: release.body || ''
      };
      
      currentVersionNote.value = note;
      return note;
    } catch (error) {
      console.error('[Updater] Failed to fetch current version note:', error);
      return null;
    }
  }
  
  /**
   * Fetch latest release note (for upgrade notification)
   */
  async function fetchLatestVersionNote(): Promise<ReleaseNote | null> {
    try {
      const response = await fetch('https://api.github.com/repos/langhuihui/rebebuca/releases/latest');
      
      if (!response.ok) {
        console.log('[Updater] No latest release found');
        return null;
      }
      
      const release = await response.json();
      const note: ReleaseNote = {
        tag: release.tag_name,
        date: new Date(release.published_at).toLocaleDateString(),
        body: release.body || ''
      };
      
      return note;
    } catch (error) {
      console.error('[Updater] Failed to fetch latest version note:', error);
      return null;
    }
  }
  
  /**
   * Check if there's a newer version available and fetch its release note
   */
  async function checkNewVersionAvailable(): Promise<boolean> {
    try {
      const version = currentVersion.value || await getCurrentVersion();
      if (!version) return false;
      
      const latestNote = await fetchLatestVersionNote();
      if (!latestNote) return false;
      
      const currentTag = `v${version}`;
      
      // Compare versions - if latest tag is different from current, there's an update
      if (latestNote.tag !== currentTag) {
        // Simple version comparison: check if latest is newer
        const latestVersion = latestNote.tag.replace(/^v/, '');
        if (compareVersions(latestVersion, version) > 0) {
          newVersionNote.value = latestNote;
          return true;
        }
      }
      
      newVersionNote.value = null;
      return false;
    } catch (error) {
      console.error('[Updater] Failed to check new version:', error);
      return false;
    }
  }
  
  /**
   * Compare two version strings
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    
    return 0;
  }
  
  /**
   * Check for updates
   */
  async function checkForUpdates(): Promise<boolean> {
    if (!isTauri()) {
      console.log('[Updater] Check skipped in non-Tauri environment');
      return false;
    }
    
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
    currentVersionNote,
    newVersionNote,
    
    // Actions
    getCurrentVersion,
    checkForUpdates,
    autoCheckForUpdates,
    downloadAndInstall,
    reset,
    checkWhatsNew,
    dismissWhatsNew,
    fetchReleaseNotes,
    fetchCurrentVersionNote,
    fetchLatestVersionNote,
    checkNewVersionAvailable,
  };
});
