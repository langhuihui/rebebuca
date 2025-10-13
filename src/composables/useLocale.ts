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
import { computed } from 'vue';

export function useLocale() {
  const { locale } = useI18n();

  const currentLocale = computed(() => locale.value);

  const availableLocales = [
    { label: 'English', value: 'en' },
    { label: '简体中文', value: 'zh-CN' },
  ];

  const setLocale = (newLocale: string) => {
    locale.value = newLocale as any;
    localStorage.setItem('app-locale', newLocale);
  };

  const toggleLocale = () => {
    const newLocale = locale.value === 'zh-CN' ? 'en' : 'zh-CN';
    setLocale(newLocale);
  };

  return {
    currentLocale,
    availableLocales,
    setLocale,
    toggleLocale,
  };
}

