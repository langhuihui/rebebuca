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
  <n-modal 
    v-model:show="showDialog"
    preset="dialog"
    :title="t('task.selectTasksToImport')"
    :positive-text="t('task.importSelected')"
    :negative-text="t('common.cancel')"
    style="width: 600px;"
    :positive-button-props="{ disabled: selectedTasks.length === 0 }"
    to="body"
    @positive-click="handleConfirmImport"
  >
    <div class="import-task-selection">
      <div class="selection-header">
        <n-checkbox 
          :checked="isAllSelected" 
          :indeterminate="isPartialSelected"
          @update:checked="handleSelectAll"
        >
          {{ t('task.selectAll') }} ({{ selectedTasks.length }}/{{ tasks.length }})
        </n-checkbox>
      </div>
      <n-scrollbar style="max-height: 400px;">
        <div v-if="tasks.length === 0" class="no-tasks-found">
          {{ t('task.noTasksFound') }}
        </div>
        <div 
          v-for="task in tasks" 
          :key="task.id" 
          class="import-task-item"
          :class="{ selected: selectedTasks.includes(task.id), duplicate: isDuplicate(task) }"
        >
          <n-checkbox 
            :checked="selectedTasks.includes(task.id)"
            @update:checked="(checked: boolean) => handleToggleTask(task.id, checked)"
          >
            <div class="task-info">
              <div class="task-name">{{ task.name }}</div>
              <div class="task-command">{{ task.command }} {{ task.args?.join(' ') || '' }}</div>
              <div v-if="isDuplicate(task)" class="task-duplicate-hint">
                {{ t('task.willOverwrite') }}
              </div>
            </div>
          </n-checkbox>
        </div>
      </n-scrollbar>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { NModal, NScrollbar, NCheckbox } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import type { Task } from '../../../providers/types';

const props = defineProps<{
  show: boolean;
  tasks: Task[];
  duplicateTaskNames: string[];
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'confirm', selectedTaskIds: string[]): void;
}>();

const { t } = useI18n();

const selectedTasks = ref<string[]>([]);

const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

const isAllSelected = computed(() => 
  props.tasks.length > 0 && selectedTasks.value.length === props.tasks.length
);

const isPartialSelected = computed(() => 
  selectedTasks.value.length > 0 && selectedTasks.value.length < props.tasks.length
);

const isDuplicate = (task: Task): boolean => {
  return props.duplicateTaskNames.includes(task.name);
};

const handleSelectAll = (checked: boolean) => {
  if (checked) {
    selectedTasks.value = props.tasks.map(t => t.id);
  } else {
    selectedTasks.value = [];
  }
};

const handleToggleTask = (taskId: string, checked: boolean) => {
  if (checked) {
    if (!selectedTasks.value.includes(taskId)) {
      selectedTasks.value = [...selectedTasks.value, taskId];
    }
  } else {
    selectedTasks.value = selectedTasks.value.filter(id => id !== taskId);
  }
};

const handleConfirmImport = () => {
  emit('confirm', selectedTasks.value);
  return true;
};

// Auto-select all tasks when dialog opens with new tasks
watch(() => props.tasks, (newTasks) => {
  if (newTasks.length > 0) {
    selectedTasks.value = newTasks.map(t => t.id);
  }
}, { immediate: true });

// Reset selection when dialog closes
watch(showDialog, (show) => {
  if (!show) {
    selectedTasks.value = [];
  }
});
</script>

<style scoped>
.import-task-selection {
  padding: 8px 0;
}

.selection-header {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 8px;
}

.no-tasks-found {
  text-align: center;
  padding: 32px;
  color: rgba(255, 255, 255, 0.5);
}

.import-task-item {
  padding: 8px 12px;
  border-radius: 4px;
  margin: 4px 0;
  transition: background-color 0.2s;
}

.import-task-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.import-task-item.selected {
  background: rgba(24, 160, 88, 0.1);
}

.import-task-item.duplicate {
  border-left: 3px solid #f0a020;
}

.task-info {
  margin-left: 8px;
}

.task-name {
  font-weight: 500;
  font-size: 13px;
}

.task-command {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-family: monospace;
  margin-top: 2px;
  word-break: break-all;
}

.task-duplicate-hint {
  font-size: 11px;
  color: #f0a020;
  margin-top: 2px;
}

/* Light theme */
:global(.n-config-provider--light) .selection-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

:global(.n-config-provider--light) .no-tasks-found {
  color: rgba(0, 0, 0, 0.5);
}

:global(.n-config-provider--light) .import-task-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

:global(.n-config-provider--light) .task-command {
  color: rgba(0, 0, 0, 0.5);
}
</style>
