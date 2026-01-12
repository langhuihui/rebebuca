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
import { getAdapter, type BackendAdapter } from '../adapters';

// Adapter instance for persistence
let adapter: BackendAdapter | null = null;

// Initialize adapter
const initAdapter = async () => {
  if (!adapter) {
    try {
      adapter = await getAdapter();
    } catch (error) {
      console.warn('[FeatureFlags] Failed to initialize adapter:', error);
      return null;
    }
  }
  return adapter;
};

/**
 * Check if we're in development mode
 * Development mode is determined by:
 * 1. Vite dev server (import.meta.env.DEV)
 * 2. Or explicit VITE_DEV_MODE=true environment variable
 */
export function isDevelopmentMode(): boolean {
  return import.meta.env.DEV === true || import.meta.env.VITE_DEV_MODE === 'true';
}

/**
 * Feature flags interface
 * These control which features are visible/enabled in the application
 */
export interface FeatureFlags {
  // AI Collaboration feature
  aiCollab: boolean;
  // SSH feature
  ssh: boolean;
}

/**
 * Default feature flags for production (features are hidden)
 */
const defaultProductionFlags: FeatureFlags = {
  aiCollab: false,
  ssh: true,
};

/**
 * Default feature flags for development (features are visible for testing)
 */
const defaultDevelopmentFlags: FeatureFlags = {
  aiCollab: true,
  ssh: true,
};

export const useFeatureFlagsStore = defineStore('featureFlags', () => {
  // The actual feature flags state (for development override)
  const devOverrideFlags = ref<FeatureFlags>({ ...defaultDevelopmentFlags });
  
  // Whether dev overrides are enabled (only meaningful in dev mode)
  const devOverrideEnabled = ref(false);
  
  // Initialization flag
  const initialized = ref(false);
  
  /**
   * Get the effective feature flags based on environment and overrides
   */
  const flags = computed<FeatureFlags>(() => {
    if (isDevelopmentMode()) {
      // In development mode, use override flags if enabled, otherwise use dev defaults
      if (devOverrideEnabled.value) {
        return devOverrideFlags.value;
      }
      return defaultDevelopmentFlags;
    }
    // In production mode, always use production defaults (features hidden)
    return defaultProductionFlags;
  });
  
  /**
   * Check if a specific feature is enabled
   */
  function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    return flags.value[feature];
  }
  
  /**
   * Save dev override settings to persistent storage
   * Only saves in development mode
   */
  async function saveDevOverrides(): Promise<void> {
    if (!isDevelopmentMode()) return;
    
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        await adapterInstance.storage.set('featureFlagsDevOverride', {
          enabled: devOverrideEnabled.value,
          flags: devOverrideFlags.value,
        });
        await adapterInstance.storage.save();
        console.log('[FeatureFlags] Saved dev overrides:', devOverrideFlags.value);
      }
    } catch (error) {
      console.error('[FeatureFlags] Failed to save dev overrides:', error);
    }
  }
  
  /**
   * Load dev override settings from persistent storage
   */
  async function loadDevOverrides(): Promise<void> {
    if (!isDevelopmentMode()) return;
    
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        const saved = await adapterInstance.storage.get<{
          enabled: boolean;
          flags: FeatureFlags;
        }>('featureFlagsDevOverride');
        if (saved) {
          devOverrideEnabled.value = saved.enabled;
          devOverrideFlags.value = { ...defaultDevelopmentFlags, ...saved.flags };
          console.log('[FeatureFlags] Loaded dev overrides:', saved);
        }
      }
    } catch (error) {
      console.error('[FeatureFlags] Failed to load dev overrides:', error);
    }
  }
  
  /**
   * Initialize feature flags
   */
  async function initialize(): Promise<void> {
    if (initialized.value) return;
    
    initialized.value = true;
    await loadDevOverrides();
  }
  
  /**
   * Update a specific feature flag (dev mode only)
   */
  async function setFeatureFlag(
    feature: keyof FeatureFlags,
    enabled: boolean
  ): Promise<void> {
    if (!isDevelopmentMode()) {
      console.warn('[FeatureFlags] Cannot modify feature flags in production mode');
      return;
    }
    
    devOverrideFlags.value[feature] = enabled;
    devOverrideEnabled.value = true;
    await saveDevOverrides();
  }
  
  /**
   * Enable/disable dev override mode
   */
  async function setDevOverrideEnabled(enabled: boolean): Promise<void> {
    if (!isDevelopmentMode()) return;
    
    devOverrideEnabled.value = enabled;
    await saveDevOverrides();
  }
  
  /**
   * Reset all feature flags to defaults
   */
  async function resetToDefaults(): Promise<void> {
    if (!isDevelopmentMode()) return;
    
    devOverrideEnabled.value = false;
    devOverrideFlags.value = { ...defaultDevelopmentFlags };
    await saveDevOverrides();
  }
  
  return {
    // State
    flags,
    devOverrideFlags,
    devOverrideEnabled,
    initialized,
    
    // Methods
    initialize,
    isFeatureEnabled,
    setFeatureFlag,
    setDevOverrideEnabled,
    resetToDefaults,
    
    // Utilities
    isDevelopmentMode,
  };
});
