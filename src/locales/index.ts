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

import { createI18n } from 'vue-i18n';
import en from './en';
import zhCN from './zh-CN';

// Detect system language
function getSystemLocale(): string {
  // Get browser/system language
  const browserLang = navigator.language || (navigator as any).userLanguage;

  // Normalize language code
  const lang = browserLang.toLowerCase();

  // Map to supported languages
  if (lang.startsWith('zh')) {
    return 'zh-CN';
  }

  return 'en';
}

// Get stored language preference or use system language
const storedMode = localStorage.getItem('app-locale-mode') || 'system';
const storedLocale = localStorage.getItem('app-locale');

// Determine actual locale
let defaultLocale: string;
if (storedMode === 'system') {
  defaultLocale = getSystemLocale();
} else if (storedLocale) {
  defaultLocale = storedLocale;
} else {
  defaultLocale = getSystemLocale();
}

const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: 'en',
  messages: {
    en,
    'zh-CN': zhCN,
  },
});

// Save locale preference when changed
export function setLocale(locale: string) {
  i18n.global.locale.value = locale as any;
  localStorage.setItem('app-locale', locale);
}

export default i18n;

