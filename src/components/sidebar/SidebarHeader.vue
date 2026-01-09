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
        <!-- Action buttons (hidden in mini mode) -->
        <n-space v-if="!uiStore.miniMode" :size="4">
          <!-- Add folder/Open/Import button -->
          <n-tooltip trigger="hover">
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

          <!-- AI Collaboration button -->
          <template v-if="featureFlagsStore.flags.aiCollab">
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-button
                  size="small"
                  quaternary
                  @click="$emit('ai-collab')"
                >
                  <template #icon>
                    <n-icon size="16">
                      <component :is="svgIcons.robot" />
                    </n-icon>
                  </template>
                </n-button>
              </template>
              {{ t('aiCollab.title') }}
            </n-tooltip>
          </template>
        </n-space>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NTooltip, NButton, NSpace, NIcon } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { svgIcons } from '../../utils/icons';
import { useUIStore } from '../../stores/ui';
import { useFeatureFlagsStore } from '../../stores/featureFlags';

const uiStore = useUIStore();
const featureFlagsStore = useFeatureFlagsStore();

defineProps<{
  effectiveTheme: string;
}>();

defineEmits<{
  (e: 'add-folder'): void;
  (e: 'add-task'): void;
  (e: 'port-management'): void;
  (e: 'ai-collab'): void;
}>();

const { t } = useI18n();
</script>

<style scoped>
.task-header-container {
  padding: 0;
}

.task-header-content {
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* Light theme */
:global(.n-config-provider--light) .task-header-content,
:global(.sidebar-layout.light-theme) .task-header-content {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}
</style>
