<!--
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
 -->

<template>
  <div class="custom-titlebar" @mousedown="startDrag">
    <div class="titlebar-content">
      <!-- Window controls -->
      <div
        class="window-controls"
        :class="{ 'windows-style': uiStore.isWindowsPlatform }"
      >
        <button
          class="window-control-button close-btn"
          @click="closeWindow"
          title="关闭"
        >
          <span v-if="uiStore.isWindowsPlatform">×</span>
          <svg v-else width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M1 1l8 8M9 1l-8 8"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <button
          class="window-control-button minimize-btn"
          @click="minimizeWindow"
          title="最小化"
        >
          <span v-if="uiStore.isWindowsPlatform">−</span>
          <svg v-else width="10" height="10" viewBox="0 0 10 10">
            <rect x="1" y="4.5" width="8" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          class="window-control-button maximize-btn"
          @click="toggleMaximize"
          title="最大化"
        >
          <span v-if="uiStore.isWindowsPlatform">□</span>
          <svg v-else width="10" height="10" viewBox="0 0 10 10">
            <rect
              x="1"
              y="1"
              width="8"
              height="8"
              stroke="currentColor"
              stroke-width="1"
              fill="none"
            />
          </svg>
        </button>
      </div>

      <!-- Title only -->
      <div class="titlebar-center">
        <img
          :src="effectiveTheme === 'light' ? '/text.svg' : '/text.svg'"
          alt="Rebebuca"
          :class="
            effectiveTheme === 'light' ? 'text-logo-light' : 'text-logo-dark'
          "
          class="title-logo"
        />
      </div>

      <!-- Right buttons -->
      <div class="titlebar-right">
        <n-dropdown
          :options="uiStore.themeOptions"
          @select="handleThemeSelect"
          trigger="click"
        >
          <n-button
            text
            size="small"
            class="titlebar-button"
            :title="t('titlebar.toggleTheme')"
          >
            <template #icon>
              <component
                :is="
                  effectiveTheme === 'light'
                    ? iconComponents.sun
                    : iconComponents.moon
                "
              />
            </template>
          </n-button>
        </n-dropdown>
        <n-button
          text
          size="small"
          @click="toggleSidebar"
          class="titlebar-button"
          :title="t('titlebar.toggleSidebar')"
        >
          <template #icon>
            <component :is="iconComponents.sidebar" />
          </template>
        </n-button>
        <n-button
          text
          size="small"
          @click="toggleHistoryPanel"
          class="titlebar-button"
          :title="t('titlebar.toggleHistory')"
        >
          <template #icon>
            <component :is="iconComponents.historyPanel" />
          </template>
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NDropdown } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useUIStore } from "../stores/ui";
import { useTheme } from "../composables/useTheme";
import { iconComponents } from "../utils/icons";
import {
  minimizeWindow,
  toggleMaximize,
  closeWindow,
  startDrag,
} from "../utils/windowControls";

interface Props {
  effectiveTheme: string;
}

defineProps<Props>();

const { t } = useI18n();
const uiStore = useUIStore();
const { setThemeMode } = useTheme();

const handleThemeSelect = (key: string) => {
  setThemeMode(key as "light" | "dark" | "system");
};

const toggleSidebar = () => {
  uiStore.toggleSidebar();
};

const toggleHistoryPanel = () => {
  uiStore.toggleHistoryPanel();
};
</script>
