<!--
 Rebebuca
 Copyright (C) 2025 rebebuca contributors
 
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 
 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->

<template>
  <n-popover
    trigger="click"
    placement="bottom"
    :show="show"
    @update:show="$emit('update:show', $event)"
  >
    <template #trigger>
      <slot>
        <n-button size="small" quaternary>
          <template #icon>
            <n-icon size="16">
              <component :is="currentIcon" />
            </n-icon>
          </template>
        </n-button>
      </slot>
    </template>
    <div class="icon-picker">
      <div class="icon-picker-header">
        <n-input
          v-model:value="searchQuery"
          size="small"
          :placeholder="t('settings.searchIcons')"
          clearable
        />
      </div>
      <div class="icon-picker-grid">
        <n-tooltip
          v-for="(icon, name) in filteredIcons"
          :key="name"
          trigger="hover"
          :delay="500"
        >
          <template #trigger>
            <div
              class="icon-picker-item"
              :class="{ 'icon-picker-item-selected': name === modelValue }"
              @click="selectIcon(name as string)"
            >
              <n-icon size="20">
                <component :is="icon" />
              </n-icon>
            </div>
          </template>
          {{ name }}
        </n-tooltip>
      </div>
    </div>
  </n-popover>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { NPopover, NButton, NIcon, NInput, NTooltip } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { svgIcons } from '../utils/icons';

const { t } = useI18n();

interface Props {
  modelValue?: string;
  show?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 'task',
  show: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'update:show', value: boolean): void;
}>();

const searchQuery = ref('');

const currentIcon = computed(() => {
  const iconName = props.modelValue as keyof typeof svgIcons;
  return svgIcons[iconName] || svgIcons.task;
});

const filteredIcons = computed(() => {
  const query = searchQuery.value.toLowerCase();
  if (!query) return svgIcons;
  
  return Object.fromEntries(
    Object.entries(svgIcons).filter(([name]) => 
      name.toLowerCase().includes(query)
    )
  );
});

const selectIcon = (name: string) => {
  emit('update:modelValue', name);
  emit('update:show', false);
};
</script>

<style scoped>
.icon-picker {
  width: 280px;
  max-height: 320px;
  display: flex;
  flex-direction: column;
}

.icon-picker-header {
  padding-bottom: 8px;
  border-bottom: 1px solid var(--n-border-color);
  margin-bottom: 8px;
}

.icon-picker-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
  overflow-y: auto;
  padding: 4px;
}

.icon-picker-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.icon-picker-item:hover {
  background-color: var(--n-color-hover);
}

.icon-picker-item-selected {
  background-color: var(--n-color-pressed);
  outline: 2px solid var(--n-color-target);
}
</style>
