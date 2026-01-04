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
    v-model:show="show"
    preset="dialog"
    :title="t('import.title')"
    style="width: 700px"
    to="body"
  >
    <template #action>
      <n-space>
        <n-button @click="handleCancel">
          {{ t('import.cancel') }}
        </n-button>
        <n-button 
          type="primary" 
          @click="handleImport"
          :disabled="selectedTasks.length === 0"
        >
          {{ t('import.importSelected') }} ({{ selectedTasks.length }})
        </n-button>
      </n-space>
    </template>

    <n-space vertical size="large">
      <!-- File selection -->
      <n-space vertical>
        <n-text strong>{{ t('import.selectFile') }}</n-text>
        <n-space>
          <n-button @click="selectTasksFile">
            <template #icon>
              <n-icon size="16">
                <component :is="svgIcons.file" />
              </n-icon>
            </template>
            {{ t('import.browse') }}
          </n-button>
          <n-text v-if="selectedFilePath" depth="3">
            {{ selectedFilePath }}
          </n-text>
        </n-space>
      </n-space>

      <!-- Workspace folder (optional) -->
      <n-space vertical>
        <n-text strong>{{ t('import.workspaceFolder') }}</n-text>
        <n-text depth="3" style="font-size: 12px;">
          {{ t('import.workspaceFolderHint') }}
        </n-text>
        <n-input
          v-model:value="workspaceFolder"
          :placeholder="t('import.workspaceFolderPlaceholder')"
        >
          <template #suffix>
            <n-button text @click="selectWorkspaceFolder">
              <template #icon>
                <n-icon size="16">
                  <component :is="svgIcons.folderOpen" />
                </n-icon>
              </template>
            </n-button>
          </template>
        </n-input>
      </n-space>

      <!-- Errors and warnings -->
      <n-alert v-if="parseResult?.errors?.length" type="error" :title="t('import.parseError')">
        <ul style="margin: 0; padding-left: 20px;">
          <li v-for="(error, index) in parseResult.errors" :key="index">{{ error }}</li>
        </ul>
      </n-alert>

      <n-alert v-if="parseResult?.warnings?.length" type="warning" :title="t('import.warnings')">
        <ul style="margin: 0; padding-left: 20px;">
          <li v-for="(warning, index) in parseResult.warnings" :key="index">{{ warning }}</li>
        </ul>
      </n-alert>

      <!-- Task list -->
      <n-space vertical v-if="parseResult?.tasks?.length">
        <n-space justify="space-between" align="center">
          <n-text strong>{{ t('import.foundTasks') }} ({{ parseResult.tasks.length }})</n-text>
          <n-space>
            <n-button size="small" @click="selectAll">{{ t('import.selectAll') }}</n-button>
            <n-button size="small" @click="deselectAll">{{ t('import.deselectAll') }}</n-button>
          </n-space>
        </n-space>
        
        <n-scrollbar style="max-height: 300px;">
          <n-checkbox-group v-model:value="selectedTasks">
            <n-space vertical>
              <n-card 
                v-for="(task, index) in parseResult.tasks" 
                :key="index"
                size="small"
                :style="{ 
                  opacity: selectedTasks.includes(index) ? 1 : 0.6,
                  cursor: 'pointer'
                }"
                @click="toggleTask(index)"
              >
                <n-space align="center">
                  <n-checkbox :value="index" @click.stop />
                  <n-space vertical :size="0">
                    <n-text strong>{{ task.name }}</n-text>
                    <n-text depth="3" style="font-size: 12px; font-family: monospace;">
                      {{ task.command }} {{ task.arguments?.join(' ') || '' }}
                    </n-text>
                    <n-text v-if="task.workingDirectory" depth="3" style="font-size: 11px;">
                      {{ t('import.cwd') }}: {{ task.workingDirectory }}
                    </n-text>
                  </n-space>
                </n-space>
              </n-card>
            </n-space>
          </n-checkbox-group>
        </n-scrollbar>
      </n-space>

      <!-- Empty state -->
      <n-empty 
        v-else-if="selectedFilePath && !parseResult?.errors?.length" 
        :description="t('import.noTasks')" 
      />
    </n-space>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  NModal,
  NSpace,
  NButton,
  NIcon,
  NText,
  NInput,
  NAlert,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NScrollbar,
  NEmpty,
  useMessage,
} from 'naive-ui';
import { svgIcons } from '../utils/icons';
import { getAdapter } from '../adapters';
import { useI18n } from 'vue-i18n';
import { parseVSCodeTasks, convertToRunConfigs, type ParseResult } from '../utils/vscodeTasksParser';

interface Props {
  show: boolean;
}

interface Emits {
  (e: 'update:show', value: boolean): void;
  (e: 'import', tasks: ReturnType<typeof convertToRunConfigs>): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const message = useMessage();

const selectedFilePath = ref('');
const workspaceFolder = ref('');
const parseResult = ref<ParseResult | null>(null);
const selectedTasks = ref<number[]>([]);

const show = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
});

// Select tasks.json file
const selectTasksFile = async () => {
  try {
    const adapter = await getAdapter();
    const selected = await adapter.dialog.selectFile({
      title: t('import.selectTasksJson'),
      filters: [
        { name: 'tasks.json', extensions: ['json'] }
      ]
    });
    
    if (selected) {
      selectedFilePath.value = selected;
      
      // Auto-detect workspace folder from file path
      // Always set to the parent's parent directory (e.g., /project/.vscode/tasks.json -> /project)
      const pathParts = selected.split(/[/\\]/);
      if (pathParts.length >= 3) {
        // Remove filename and its parent directory to get grandparent
        pathParts.pop(); // Remove tasks.json
        pathParts.pop(); // Remove .vscode (or whatever parent folder)
        const workspace = pathParts.join('/');
        if (workspace) {
          workspaceFolder.value = workspace;
        }
      }
      
      await parseFile();
    }
  } catch (error) {
    console.error('Failed to select file:', error);
    message.error(t('import.selectError'));
  }
};

// Select workspace folder
const selectWorkspaceFolder = async () => {
  try {
    const adapter = await getAdapter();
    const selected = await adapter.dialog.selectFolder({
      title: t('import.selectWorkspaceFolder'),
    });
    
    if (selected) {
      workspaceFolder.value = selected;
      // Re-parse if file already selected
      if (selectedFilePath.value) {
        await parseFile();
      }
    }
  } catch (error) {
    console.error('Failed to select workspace folder:', error);
  }
};

// Parse the selected file
const parseFile = async () => {
  if (!selectedFilePath.value) return;
  
  try {
    const adapter = await getAdapter();
    const content = await adapter.fs.readTextFile(selectedFilePath.value);
    parseResult.value = parseVSCodeTasks(content, workspaceFolder.value || undefined);
    
    // Auto-select all tasks
    if (parseResult.value.success) {
      selectedTasks.value = parseResult.value.tasks.map((_, index) => index);
    } else {
      selectedTasks.value = [];
    }
  } catch (error) {
    console.error('Failed to read file:', error);
    parseResult.value = {
      success: false,
      tasks: [],
      errors: [t('import.readError', { error: error instanceof Error ? error.message : String(error) })],
      warnings: [],
    };
    selectedTasks.value = [];
  }
};

// Toggle task selection
const toggleTask = (index: number) => {
  const idx = selectedTasks.value.indexOf(index);
  if (idx >= 0) {
    selectedTasks.value.splice(idx, 1);
  } else {
    selectedTasks.value.push(index);
  }
};

// Select/deselect all
const selectAll = () => {
  if (parseResult.value?.tasks) {
    selectedTasks.value = parseResult.value.tasks.map((_, index) => index);
  }
};

const deselectAll = () => {
  selectedTasks.value = [];
};

// Handle import
const handleImport = () => {
  if (!parseResult.value?.tasks || selectedTasks.value.length === 0) return;
  
  const tasksToImport = selectedTasks.value
    .sort((a, b) => a - b)
    .map(index => parseResult.value!.tasks[index]);
  
  const configs = convertToRunConfigs(tasksToImport);
  emit('import', configs);
  
  message.success(t('import.importSuccess', { count: configs.length }));
  show.value = false;
};

// Handle cancel
const handleCancel = () => {
  show.value = false;
};

// Reset state when dialog opens
watch(show, (newShow) => {
  if (newShow) {
    selectedFilePath.value = '';
    workspaceFolder.value = '';
    parseResult.value = null;
    selectedTasks.value = [];
  }
});
</script>
