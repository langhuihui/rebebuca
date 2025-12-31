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

// Store instance for persistence
let store: any = null;

// Initialize Tauri store
const initStore = async () => {
  if (!store) {
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      store = await Store.load('rebebuca-settings.json');
    } catch (error) {
      console.warn('[Settings] Failed to initialize Tauri store:', error);
      return null;
    }
  }
  return store;
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
      const storeInstance = await initStore();
      if (storeInstance) {
        await storeInstance.set('appSettings', settings.value);
        await storeInstance.save();
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
      const storeInstance = await initStore();
      if (storeInstance) {
        const savedSettings = await storeInstance.get('appSettings');
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
