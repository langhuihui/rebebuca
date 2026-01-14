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

// Self-hosted releases endpoint (same server as update check)
const RELEASES_URL = 'https://download.m7s.live/rb/releases.json';

// Cache for releases data
let releasesCache: { latest: string; releases: Array<{ version: string; date: string; body: string }> } | null = null;
let releasesCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
      if (isTauri()) {
        const { getVersion } = await import('@tauri-apps/api/app');
        currentVersion.value = await getVersion();
      } else {
        // In server mode, get version from remote server
        const adapterInstance = await getAdapterInstance();
        const result = await adapterInstance.updater.checkForUpdates();
        if (result && 'version' in result) {
          // The server returns currentVersion in the check result
          // We need to get it from a separate call or parse from result
          currentVersion.value = (result as { currentVersion?: string }).currentVersion || '0.0.0-server';
        } else {
          currentVersion.value = '0.0.0-server';
        }
      }
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
    
    try {
      if (isTauri()) {
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
      } else {
        // In server mode, check via adapter
        const adapterInstance = await getAdapterInstance();
        const result = await adapterInstance.updater.checkForUpdates();
        
        if (result && result.available) {
          updateAvailable.value = true;
          updateInfo.value = {
            version: result.version || '',
            date: '',
            body: result.notes || '',
          };
          console.log('[Updater] Auto-check: Server update available:', result.version);
        } else {
          updateAvailable.value = false;
          updateInfo.value = null;
          console.log('[Updater] Auto-check: No server updates available');
        }
      }
    } catch (e) {
      console.log('[Updater] Auto-check failed (silent):', e);
    }
  }
  
  /**
   * Fetch all releases from self-hosted server
   */
  async function fetchReleasesData(): Promise<typeof releasesCache> {
    // Return cached data if still valid
    if (releasesCache && Date.now() - releasesCacheTime < CACHE_TTL) {
      return releasesCache;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(RELEASES_URL, {
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`[Updater] Failed to fetch releases: ${response.status}`);
        return null;
      }
      
      releasesCache = await response.json();
      releasesCacheTime = Date.now();
      return releasesCache;
    } catch (error) {
      // Silent fail for network errors (expected in some environments)
      return null;
    }
  }
  
  /**
   * Fetch release notes for a specific version or recent releases
   */
  async function fetchReleaseNotes(targetVersion?: string): Promise<ReleaseNote[]> {
    const data = await fetchReleasesData();
    if (!data) return [];
    
    const notes: ReleaseNote[] = data.releases.map(release => ({
      tag: `v${release.version}`,
      date: release.date,
      body: release.body || ''
    }));
    
    // If target version specified, find releases since that version
    if (targetVersion) {
      const targetTag = `v${targetVersion}`;
      const targetIndex = notes.findIndex(n => n.tag === targetTag);
      if (targetIndex >= 0) {
        return notes.slice(0, targetIndex + 1);
      }
    }
    
    return notes;
  }
  
  /**
   * Fetch current version's release note only
   */
  async function fetchCurrentVersionNote(): Promise<ReleaseNote | null> {
    const version = currentVersion.value || await getCurrentVersion();
    if (!version) return null;
    
    const data = await fetchReleasesData();
    if (!data) return null;
    
    const release = data.releases.find(r => r.version === version);
    if (!release) {
      console.log(`[Updater] No release found for version ${version}`);
      return null;
    }
    
    const note: ReleaseNote = {
      tag: `v${release.version}`,
      date: release.date,
      body: release.body || ''
    };
    
    currentVersionNote.value = note;
    return note;
  }
  
  /**
   * Fetch latest release note (for upgrade notification)
   */
  async function fetchLatestVersionNote(): Promise<ReleaseNote | null> {
    const data = await fetchReleasesData();
    if (!data || data.releases.length === 0) {
      console.log('[Updater] No releases found');
      return null;
    }
    
    // First release is the latest
    const release = data.releases[0];
    const note: ReleaseNote = {
      tag: `v${release.version}`,
      date: release.date,
      body: release.body || ''
    };
    
    return note;
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
    checking.value = true;
    error.value = null;
    
    try {
      if (isTauri()) {
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
      } else {
        // In server mode, check via adapter
        const adapterInstance = await getAdapterInstance();
        const result = await adapterInstance.updater.checkForUpdates();
        
        if (result && result.available) {
          updateAvailable.value = true;
          updateInfo.value = {
            version: result.version || '',
            date: '',
            body: result.notes || '',
          };
          console.log('[Updater] Server update available:', result.version);
          return true;
        } else {
          updateAvailable.value = false;
          updateInfo.value = null;
          console.log('[Updater] No server updates available');
          return false;
        }
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
   * In server mode, this opens the download page since auto-update is not supported
   */
  async function downloadAndInstall(): Promise<void> {
    if (!updateAvailable.value) {
      throw new Error('No update available');
    }
    
    downloading.value = true;
    downloadProgress.value = 0;
    error.value = null;
    
    try {
      if (isTauri()) {
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
      } else {
        // In server mode, use adapter to download and install
        const adapterInstance = await getAdapterInstance();
        
        // Register progress callback
        const cleanup = adapterInstance.updater.onProgress((progress) => {
          downloadProgress.value = progress;
        });
        
        try {
          await adapterInstance.updater.downloadAndInstall();
          console.log('[Updater] Server update initiated, waiting for restart...');
        } finally {
          cleanup();
        }
      }
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
