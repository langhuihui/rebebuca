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
    :title="isEditMode ? t('task.editTask') : t('task.addTask')"
    :positive-text="t('common.save')"
    :negative-text="t('common.cancel')"
    style="width: 500px;"
    to="body"
    @positive-click="handleSave"
  >
    <n-form ref="taskFormRef" :model="editingTask" :rules="taskRules" label-placement="left" label-width="auto">
      <n-form-item :label="t('task.name')" path="name">
        <n-input v-model:value="editingTask.name" :placeholder="t('task.namePlaceholder')" />
      </n-form-item>
      <n-form-item :label="t('task.command')" path="command">
        <n-input-group>
          <n-input 
            v-model:value="editingTask.command" 
            type="textarea"
            :placeholder="t('task.commandPlaceholder')"
            :autosize="{ minRows: 1, maxRows: 5 }"
            class="command-textarea"
          />
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button @click="showCommandPlaza = true">
                <template #icon>
                  <n-icon size="16">
                    <component :is="svgIcons.grid" />
                  </n-icon>
                </template>
              </n-button>
            </template>
            {{ t('commandPlaza.title') }}
          </n-tooltip>
        </n-input-group>
      </n-form-item>
      <n-form-item :label="t('task.cwd')">
        <n-input-group>
          <n-input v-model:value="editingTask.cwd" :placeholder="t('task.cwdPlaceholder')" />
          <n-button @click="selectWorkingDirectory">
            <template #icon>
              <n-icon size="16">
                <component :is="svgIcons.folderOpen" />
              </n-icon>
            </template>
          </n-button>
        </n-input-group>
      </n-form-item>
      <n-form-item :label="t('task.env')">
        <n-input 
          v-model:value="editingTask.envStr" 
          type="textarea"
          :placeholder="t('task.envPlaceholder')"
          :autosize="{ minRows: 2, maxRows: 10 }"
          class="env-textarea"
        />
      </n-form-item>
      <n-form-item :label="t('task.useSystemTerminal')">
        <n-switch v-model:value="editingTask.useSystemTerminal" />
      </n-form-item>
      
      <!-- Python Environment (Windows/macOS/Linux) -->
      <n-form-item :label="t('task.pythonEnv')">
        <n-input 
          v-model:value="editingTask.pythonEnv" 
          :placeholder="t('task.pythonEnvPlaceholder')"
        >
          <template #suffix>
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-icon size="16" style="cursor: help;">
                  <component :is="svgIcons.info" />
                </n-icon>
              </template>
              {{ t('task.pythonEnvHint') }}
            </n-tooltip>
          </template>
        </n-input>
      </n-form-item>
      
      <!-- Run as Administrator (Windows only) -->
      <n-form-item v-if="isWindowsPlatform" :label="t('task.runAsAdmin')">
        <n-switch v-model:value="editingTask.runAsAdmin" />
        <span class="form-hint">{{ t('task.runAsAdminHint') }}</span>
      </n-form-item>
      
      <n-form-item v-if="isUserTask" :label="t('task.group')">
        <n-select
          v-model:value="selectedGroupId"
          :options="groupOptionsWithNew"
        />
      </n-form-item>
      <n-form-item v-if="isUserTask && selectedGroupId === '__new__'" :label="t('task.newGroupName')">
        <n-input v-model:value="newGroupName" :placeholder="t('task.newGroupPlaceholder')" />
      </n-form-item>
    </n-form>
  </n-modal>
  
  <!-- Command Plaza Dialog -->
  <CommandPlazaDialog
    v-model:show="showCommandPlaza"
    @select="handleCommandSelect"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NSelect,
  NSwitch,
  NButton,
  NIcon,
  NTooltip,
  type FormRules,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { getAdapter } from '../../../adapters';
import { svgIcons } from '../../../utils/icons';
import { isWindows } from '../../../utils/platform';
import type { TaskGroup } from '../../../providers/types';
import CommandPlazaDialog from './CommandPlazaDialog.vue';

interface EditingTask {
  id: string;
  name: string;
  command: string;
  cwd: string;
  group: TaskGroup;
  type: 'shell' | 'process';
  sourceFile: string;
  useSystemTerminal: boolean;
  envStr: string;
  pythonEnv?: string;
  runAsAdmin?: boolean;
}

const props = defineProps<{
  show: boolean;
  isEditMode: boolean;
  isUserTask: boolean;
  task: EditingTask;
  groupId: string;
  groupOptions: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'update:task', task: EditingTask): void;
  (e: 'update:groupId', groupId: string): void;
  (e: 'save', task: EditingTask, groupId: string, newGroupName: string): void;
}>();

const { t } = useI18n();

const taskFormRef = ref<any>(null);
const newGroupName = ref('');
const showCommandPlaza = ref(false);
const isWindowsPlatform = ref(false);

// Check platform on mount
onMounted(async () => {
  isWindowsPlatform.value = await isWindows();
});

const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

const editingTask = computed({
  get: () => props.task,
  set: (value) => emit('update:task', value),
});

const selectedGroupId = computed({
  get: () => props.groupId,
  set: (value) => emit('update:groupId', value),
});

const groupOptionsWithNew = computed(() => [
  ...props.groupOptions,
  { label: t('task.createNewGroup'), value: '__new__' },
]);

const taskRules: FormRules = {
  name: [{ required: true, message: () => t('task.nameRequired') }],
  command: [{ required: true, message: () => t('task.commandRequired') }],
};

const selectWorkingDirectory = async () => {
  try {
    const adapter = await getAdapter();
    const selected = await adapter.dialog.selectFolder({
      title: t('task.selectWorkingDirectory'),
    });
    
    if (selected) {
      editingTask.value.cwd = selected;
    }
  } catch (error) {
    console.error('[TaskEditDialog] Failed to select working directory:', error);
  }
};

const handleSave = async () => {
  try {
    await taskFormRef.value?.validate();
    emit('save', editingTask.value, selectedGroupId.value, newGroupName.value);
    return true;
  } catch (error) {
    console.error('[TaskEditDialog] Validation failed:', error);
    return false;
  }
};

// Handle command selection from Command Plaza
const handleCommandSelect = (command: string, name: string) => {
  editingTask.value.command = command;
  // If name is empty, use the command plaza item name
  if (!editingTask.value.name.trim()) {
    editingTask.value.name = name;
  }
};

// Reset new group name when dialog closes
watch(showDialog, (show) => {
  if (!show) {
    newGroupName.value = '';
  }
});
</script>

<style scoped>
.command-textarea :deep(textarea) {
  font-family: monospace;
  font-size: 13px;
  line-height: 1.5;
}

.env-textarea :deep(textarea) {
  font-family: monospace;
  font-size: 13px;
  line-height: 1.5;
}
</style>
