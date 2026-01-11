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
  <n-space align="center" justify="space-between" style="width: 100%">
    <n-text strong>{{ t('task.title') }}</n-text> 
    <n-tooltip trigger="hover">
      <template #trigger>
        <n-button quaternary size="small" circle @click="$emit('add-folder')">
          <template #icon>
            <n-icon>
              <component :is="svgIcons.folderOpen" />
            </n-icon>
          </template>
        </n-button>
      </template>
      {{ t('task.addFolder') }}
    </n-tooltip>
  </n-space>
</template>

<script setup lang="ts">
import { NSpace, NText, NButton, NIcon, NTooltip } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { svgIcons } from '../../utils/icons';

const { t } = useI18n();

defineEmits<{
  (e: 'add-folder'): void;
}>();
</script>

<style scoped>
.task-header-content {
  padding: 12px 0;
}
</style>
