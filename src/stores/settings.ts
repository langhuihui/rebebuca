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
import { getAdapter, type BackendAdapter } from '../adapters';

// Adapter instance for persistence
let adapter: BackendAdapter | null = null;

// Initialize adapter
const initAdapter = async () => {
  if (!adapter) {
    try {
      adapter = await getAdapter();
    } catch (error) {
      console.warn('[Settings] Failed to initialize adapter:', error);
      return null;
    }
  }
  return adapter;
};

export interface AppSettings {
  // Log settings
  saveLogs: boolean;
  maxLogFiles: number;
  
  // Behavior settings
  confirmBeforeClose: boolean;
  autoExpandFolders: boolean;
  closeButtonBehavior: 'hide' | 'exit';  // 'hide' = minimize to tray, 'exit' = quit app
  
  // UI settings
  showTaskIcons: boolean;
  recentTasksCount: number;  // Number of recent tasks to show (0 to disable)
  
  // Terminal settings
  preferredTerminal: string | null;  // Terminal ID to use when opening in system terminal
  preferredShell: string | null;  // Shell path to use for internal PTY terminal (e.g., /bin/zsh, /bin/bash)
  
  // Command icon customization
  // Maps command patterns to icon names, e.g., { "npm": "npm", "go build": "go" }
  commandIcons: Record<string, string>;
}

const defaultSettings: AppSettings = {
  saveLogs: true,
  maxLogFiles: 100,
  confirmBeforeClose: true,
  autoExpandFolders: true,
  closeButtonBehavior: 'exit',
  showTaskIcons: true,
  recentTasksCount: 5,
  preferredTerminal: null,
  preferredShell: null,
  commandIcons: {},
};

export const useSettingsStore = defineStore('settings', () => {
  // Settings state
  const settings = ref<AppSettings>({ ...defaultSettings });
  
  // Initialization flag
  const initialized = ref(false);
  
  /**
   * Save settings to persistent storage
   */
  async function saveSettings(): Promise<void> {
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        await adapterInstance.storage.set('appSettings', settings.value);
        await adapterInstance.storage.save();
        console.log('[Settings] Saved settings:', settings.value);
      }
    } catch (error) {
      console.error('[Settings] Failed to save settings:', error);
    }
  }
  
  /**
   * Load settings from persistent storage
   */
  async function loadSettings(): Promise<void> {
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        const savedSettings = await adapterInstance.storage.get<AppSettings>('appSettings');
        if (savedSettings) {
          settings.value = { ...defaultSettings, ...savedSettings };
          console.log('[Settings] Loaded settings:', settings.value);
        }
      }
    } catch (error) {
      console.error('[Settings] Failed to load settings:', error);
    }
  }
  
  /**
   * Initialize settings
   */
  async function initialize(): Promise<void> {
    if (initialized.value) return;
    
    initialized.value = true;
    await loadSettings();
  }
  
  /**
   * Update a specific setting
   */
  async function updateSetting<K extends keyof AppSettings>(
    key: K, 
    value: AppSettings[K]
  ): Promise<void> {
    settings.value[key] = value;
    await saveSettings();
  }
  
  /**
   * Reset settings to defaults
   */
  async function resetSettings(): Promise<void> {
    settings.value = { ...defaultSettings };
    await saveSettings();
  }
  
  return {
    settings,
    initialized,
    initialize,
    saveSettings,
    loadSettings,
    updateSetting,
    resetSettings,
  };
});
