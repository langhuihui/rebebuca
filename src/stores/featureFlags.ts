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
  aiCollab: boolean;
  ssh: boolean;
}

const defaultProductionFlags: FeatureFlags = {
  aiCollab: true,
  ssh: true,
};

const defaultDevelopmentFlags: FeatureFlags = {
  aiCollab: true,
  ssh: true,
};

export const useFeatureFlagsStore = defineStore('featureFlags', () => {
  const initialized = ref(false);

  const flags = computed<FeatureFlags>(() =>
    isDevelopmentMode() ? defaultDevelopmentFlags : defaultProductionFlags,
  );

  function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    return flags.value[feature];
  }

  async function initialize(): Promise<void> {
    if (initialized.value) return;
    initialized.value = true;
  }

  return {
    flags,
    initialized,
    initialize,
    isFeatureEnabled,
    isDevelopmentMode,
  };
});
