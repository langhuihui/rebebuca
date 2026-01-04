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
  <div class="task-header-container">
    <div class="task-header-content">
      <div class="header-row">
        <!-- Logo with version -->
        <div class="logo-version">
          <img
            :src="effectiveTheme === 'light' ? '/logo.svg' : '/logo-dark.svg'"
            alt="Logo"
            class="logo-image"
          />
          <span class="version-text">v{{ currentVersion }}</span>
          <n-tooltip v-if="updateAvailable" trigger="hover">
            <template #trigger>
              <span class="update-indicator" @click="$emit('show-update')">
                <n-icon size="14">
                  <component :is="svgIcons.refresh" />
                </n-icon>
              </span>
            </template>
            {{ t('settings.updateAvailable') }}: v{{ updateVersion }}
          </n-tooltip>
        </div>
        <!-- Action buttons -->
        <n-space :size="4">
          <!-- Add folder/Quick Scan button -->
          <n-tooltip v-if="!hasFolders" trigger="hover">
            <template #trigger>
              <n-button
                size="small"
                quaternary
                @click="$emit('quick-scan')"
              >
                <template #icon>
                  <n-icon size="16">
                    <component :is="svgIcons.search" />
                  </n-icon>
                </template>
              </n-button>
            </template>
            {{ t('task.quickScan') }}
          </n-tooltip>
          
          <!-- Add folder/Open/Import button -->
          <n-tooltip v-else trigger="hover">
            <template #trigger>
              <n-button
                size="small"
                quaternary
                @click="$emit('add-folder')"
              >
                <template #icon>
                  <n-icon size="16">
                    <component :is="svgIcons.folderPlus" />
                  </n-icon>
                </template>
              </n-button>
            </template>
            {{ t('task.addFolder') }}
          </n-tooltip>
          
          <!-- Add task button -->
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button
                size="small"
                quaternary
                @click="$emit('add-task')"
              >
                <template #icon>
                  <n-icon size="16">
                    <component :is="svgIcons.plus" />
                  </n-icon>
                </template>
              </n-button>
            </template>
            {{ t('task.addTask') }}
          </n-tooltip>
          
          <!-- AI Generate button -->
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button
                size="small"
                quaternary
                @click="$emit('ai-generate')"
              >
                <template #icon>
                  <n-icon size="16">
                    <component :is="svgIcons.ai" />
                  </n-icon>
                </template>
              </n-button>
            </template>
            {{ t('task.aiGenerate') }}
          </n-tooltip>
          
          <!-- Port Management button -->
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button
                size="small"
                quaternary
                @click="$emit('port-management')"
              >
                <template #icon>
                  <n-icon size="16">
                    <component :is="svgIcons.network" />
                  </n-icon>
                </template>
              </n-button>
            </template>
            {{ t('task.portManagement') }}
          </n-tooltip>
        </n-space>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NTooltip, NButton, NSpace, NIcon } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { svgIcons } from '../../utils/icons';

defineProps<{
  effectiveTheme: string;
  currentVersion: string;
  updateAvailable: boolean;
  updateVersion?: string;
  hasFolders: boolean;
}>();

defineEmits<{
  (e: 'show-update'): void;
  (e: 'quick-scan'): void;
  (e: 'add-folder'): void;
  (e: 'add-task'): void;
  (e: 'ai-generate'): void;
  (e: 'port-management'): void;
}>();

const { t } = useI18n();
</script>

<style scoped>
.task-header-container {
  padding: 0;
}

.task-header-content {
  padding: 16px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.logo-image {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.logo-version {
  display: flex;
  align-items: center;
  gap: 6px;
}

.version-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
}

.update-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #18a058;
  color: white;
  cursor: pointer;
  animation: pulse 2s infinite;
}

.update-indicator:hover {
  background: #36ad6a;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(24, 160, 88, 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(24, 160, 88, 0);
  }
}

/* Light theme */
:global(.n-config-provider--light) .task-header-content,
:global(.sidebar-layout.light-theme) .task-header-content {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

:global(.n-config-provider--light) .version-text,
:global(.sidebar-layout.light-theme) .version-text {
  color: rgba(0, 0, 0, 0.45);
}
</style>
