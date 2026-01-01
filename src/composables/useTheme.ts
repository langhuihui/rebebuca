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

import { ref, computed } from 'vue';
import { darkTheme, lightTheme, type GlobalTheme } from 'naive-ui';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'rebebuca-theme';

// Theme state
const themeMode = ref<ThemeMode>('dark');
const systemTheme = ref<'light' | 'dark'>('dark');

// Initialize theme from localStorage or default to dark
const savedTheme = localStorage.getItem(STORAGE_KEY) as ThemeMode;
if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
  themeMode.value = savedTheme;
}

// Apply initial theme class to DOM
const applyThemeClass = (theme?: 'light' | 'dark') => {
  // Wait for DOM to be ready
  if (typeof document !== 'undefined') {
    const configProvider = document.querySelector('.n-config-provider');
    if (configProvider) {
      // Remove existing theme classes
      configProvider.classList.remove(
        'n-config-provider--light',
        'n-config-provider--dark'
      );

      // Determine the effective theme
      let effectiveThemeValue = theme;
      if (!effectiveThemeValue) {
        effectiveThemeValue = themeMode.value === 'system' ? systemTheme.value : themeMode.value;
      }

      // Add the correct theme class
      if (effectiveThemeValue === 'light') {
        configProvider.classList.add('n-config-provider--light');
      } else {
        configProvider.classList.add('n-config-provider--dark');
      }
    }
  }
};

// Apply theme class on initialization with delay to ensure DOM is ready
setTimeout(() => {
  applyThemeClass();
}, 0);

// Detect system theme preference
const detectSystemTheme = () => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    systemTheme.value = 'light';
  } else {
    systemTheme.value = 'dark';
  }
};

// Listen for system theme changes
const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
const handleSystemThemeChange = (e: MediaQueryListEvent) => {
  systemTheme.value = e.matches ? 'light' : 'dark';
  // Apply theme class if currently using system theme
  if (themeMode.value === 'system') {
    applyThemeClass();
  }
};

// Initialize system theme detection
detectSystemTheme();
mediaQuery.addEventListener('change', handleSystemThemeChange);

// Computed theme
const currentTheme = computed<GlobalTheme>(() => {
  const effectiveTheme = themeMode.value === 'system' ? systemTheme.value : themeMode.value;
  return effectiveTheme === 'light' ? lightTheme : darkTheme;
});

// Computed theme name for display
const themeName = computed(() => {
  if (themeMode.value === 'system') {
    return systemTheme.value === 'light' ? '浅色 (系统)' : '深色 (系统)';
  }
  return themeMode.value === 'light' ? '浅色' : '深色';
});

// Set theme mode
const setThemeMode = (mode: ThemeMode) => {
  themeMode.value = mode;
  localStorage.setItem(STORAGE_KEY, mode);
  // Calculate the effective theme and apply it immediately
  const effectiveThemeValue = mode === 'system' ? systemTheme.value : mode;
  applyThemeClass(effectiveThemeValue);
};

// Toggle between light and dark (skip system for manual toggle)
const toggleTheme = () => {
  if (themeMode.value === 'system') {
    // If currently on system, switch to the opposite of current system theme
    setThemeMode(systemTheme.value === 'light' ? 'dark' : 'light');
  } else {
    // Toggle between light and dark
    setThemeMode(themeMode.value === 'light' ? 'dark' : 'light');
  }
};

// Set to system theme
const setSystemTheme = () => {
  setThemeMode('system');
};

// Get current effective theme (light/dark, not system)
const effectiveTheme = computed<'light' | 'dark'>(() => {
  return themeMode.value === 'system' ? systemTheme.value : themeMode.value;
});

// Check if current theme is light
const isLight = computed(() => effectiveTheme.value === 'light');

// Check if current theme is dark
const isDark = computed(() => effectiveTheme.value === 'dark');

export function useTheme() {
  return {
    // State
    themeMode,
    systemTheme,

    // Computed
    currentTheme,
    themeName,
    effectiveTheme,
    isLight,
    isDark,

    // Methods
    setThemeMode,
    toggleTheme,
    setSystemTheme,
  };
}
