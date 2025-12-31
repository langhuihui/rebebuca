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

import { useI18n } from 'vue-i18n';
import { computed, ref } from 'vue';

// Detect system language
function getSystemLocale(): string {
  const browserLang = navigator.language || (navigator as any).userLanguage;
  const lang = browserLang.toLowerCase();
  if (lang.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}

export function useLocale() {
  const { locale } = useI18n();

  // Store the locale mode ('system' | 'en' | 'zh-CN')
  const localeMode = ref<string>(localStorage.getItem('app-locale-mode') || 'system');

  const currentLocale = computed(() => locale.value);

  const availableLocales = [
    { label: 'Follow System', value: 'system', labelZh: '跟随系统' },
    { label: 'English', value: 'en', labelZh: 'English' },
    { label: '简体中文', value: 'zh-CN', labelZh: '简体中文' },
  ];

  // Get display label based on current locale
  const getLocalizedOptions = () => {
    return availableLocales.map(l => ({
      label: locale.value === 'zh-CN' ? l.labelZh : l.label,
      value: l.value,
    }));
  };

  const setLocale = (mode: string) => {
    localeMode.value = mode;
    localStorage.setItem('app-locale-mode', mode);
    
    // Determine actual locale
    const actualLocale = mode === 'system' ? getSystemLocale() : mode;
    locale.value = actualLocale as any;
    localStorage.setItem('app-locale', actualLocale);
  };

  const toggleLocale = () => {
    const newLocale = locale.value === 'zh-CN' ? 'en' : 'zh-CN';
    setLocale(newLocale);
  };

  // Initialize locale based on mode
  const initLocale = () => {
    const mode = localStorage.getItem('app-locale-mode') || 'system';
    localeMode.value = mode;
    const actualLocale = mode === 'system' ? getSystemLocale() : mode;
    locale.value = actualLocale as any;
  };

  return {
    currentLocale,
    localeMode,
    availableLocales,
    getLocalizedOptions,
    setLocale,
    toggleLocale,
    initLocale,
    getSystemLocale,
  };
}

