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
    :title="title || t('task.selectFolder')"
    :positive-text="t('common.confirm')"
    :negative-text="t('common.cancel')"
    style="width: 600px;"
    :positive-button-props="{ disabled: !currentPath }"
    to="body"
    @positive-click="handleConfirm"
    @negative-click="handleCancel"
  >
    <div class="server-directory-picker">
      <!-- Current path display and navigation -->
      <div class="path-bar">
        <n-input-group>
          <n-button 
            :disabled="loading || currentPath === '/'"
            @click="navigateUp"
          >
            <template #icon>
              <n-icon size="18">
                <component :is="svgIcons.arrowUp" />
              </n-icon>
            </template>
          </n-button>
          <n-button 
            :disabled="loading"
            @click="navigateHome"
          >
            <template #icon>
              <n-icon size="18">
                <component :is="svgIcons.home" />
              </n-icon>
            </template>
          </n-button>
          <n-input 
            v-model:value="inputPath"
            :placeholder="t('task.enterPath')"
            @keyup.enter="navigateToPath"
          />
          <n-button 
            :loading="loading"
            @click="navigateToPath"
          >
            {{ t('task.go') }}
          </n-button>
        </n-input-group>
      </div>

      <!-- Error display -->
      <div v-if="errorMessage" class="error-message">
        <n-alert type="error" :title="t('common.error')">
          {{ errorMessage }}
        </n-alert>
      </div>

      <!-- Directory listing -->
      <div class="directory-list">
        <n-spin :show="loading">
          <n-scrollbar style="max-height: 400px;">
            <div v-if="entries.length === 0 && !loading" class="empty-dir">
              {{ t('task.emptyDirectory') }}
            </div>
            <div
              v-for="entry in sortedEntries"
              :key="entry.path"
              class="directory-entry"
              :class="{ selected: entry.path === selectedPath }"
              @click="handleEntryClick(entry)"
              @dblclick="handleEntryDoubleClick(entry)"
            >
              <n-icon size="18" class="entry-icon" :class="{ 'file-icon': !entry.isDirectory }">
                <component :is="entry.isDirectory ? svgIcons.folder : svgIcons.file" />
              </n-icon>
              <span class="entry-name">{{ entry.name }}</span>
            </div>
          </n-scrollbar>
        </n-spin>
      </div>

      <!-- Selected path -->
      <div class="selected-path">
        <n-text depth="3">{{ t('task.selectedPath') }}:</n-text>
        <n-text strong>{{ currentPath || '/' }}</n-text>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  NModal,
  NInputGroup,
  NInput,
  NButton,
  NIcon,
  NScrollbar,
  NSpin,
  NText,
  NAlert,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { svgIcons } from '../utils/icons';
import type { DirEntry } from '../adapters/types';

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

const props = defineProps<{
  show: boolean;
  title?: string;
  defaultPath?: string;
  fsAdapter: {
    readDir: (path: string) => Promise<DirEntry[]>;
  };
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'select', path: string | null): void;
}>();

const { t } = useI18n();

const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

const loading = ref(false);
const errorMessage = ref<string | null>(null);
const currentPath = ref('/');
const inputPath = ref('/');
const selectedPath = ref<string | null>(null);
const entries = ref<DirectoryEntry[]>([]);

// Sort entries: directories first, then alphabetically
const sortedEntries = computed(() => {
  return [...entries.value].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
});

// Load directory contents
const loadDirectory = async (path: string) => {
  loading.value = true;
  errorMessage.value = null;

  try {
    const result = await props.fsAdapter.readDir(path);
    // Handle both snake_case (from server) and camelCase (from types)
    const filtered = result.filter(entry => entry.isDirectory || (entry as any).is_directory);
    entries.value = filtered.map(entry => ({
        name: entry.name,
        path: path === '/' ? `/${entry.name}` : `${path}/${entry.name}`,
        isDirectory: entry.isDirectory || (entry as any).is_directory || false,
      }));
    currentPath.value = path;
    inputPath.value = path;
    selectedPath.value = null;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
    entries.value = [];
  } finally {
    loading.value = false;
  }
};

// Navigate up one directory
const navigateUp = () => {
  if (currentPath.value === '/') return;
  const parts = currentPath.value.split('/').filter(Boolean);
  parts.pop();
  const newPath = '/' + parts.join('/');
  loadDirectory(newPath || '/');
};

// Navigate to home directory
const navigateHome = () => {
  loadDirectory('/');
};

// Navigate to typed path
const navigateToPath = () => {
  const path = inputPath.value.trim() || '/';
  loadDirectory(path);
};

// Handle entry click (select directory)
const handleEntryClick = (entry: DirectoryEntry) => {
  if (entry.isDirectory) {
    selectedPath.value = entry.path;
    currentPath.value = entry.path;
    inputPath.value = entry.path;
  }
};

// Handle entry double-click (navigate into directory)
const handleEntryDoubleClick = (entry: DirectoryEntry) => {
  if (entry.isDirectory) {
    loadDirectory(entry.path);
  }
};

// Handle confirm
const handleConfirm = () => {
  emit('select', currentPath.value);
  return true;
};

// Handle cancel
const handleCancel = () => {
  emit('select', null);
};

// Initialize when dialog opens
watch(() => props.show, async (show) => {
  if (show && props.fsAdapter) {
    const initialPath = props.defaultPath || '/';
    await loadDirectory(initialPath);
  }
}, { immediate: true });
</script>

<style scoped>
.server-directory-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.path-bar {
  margin-bottom: 8px;
}

.error-message {
  margin-bottom: 8px;
}

.directory-list {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.1);
  min-height: 200px;
}

.empty-dir {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: rgba(255, 255, 255, 0.4);
}

.directory-entry {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
  gap: 8px;
}

.directory-entry:hover {
  background: rgba(255, 255, 255, 0.05);
}

.directory-entry.selected {
  background: rgba(24, 160, 88, 0.2);
}

.entry-icon {
  flex-shrink: 0;
  color: #f5a623;
}

.entry-icon.file-icon {
  color: #8a8a8a;
}

.entry-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-path {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

/* Light theme */
:global(.n-config-provider--light) .directory-list {
  border-color: rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.02);
}

:global(.n-config-provider--light) .empty-dir {
  color: rgba(0, 0, 0, 0.4);
}

:global(.n-config-provider--light) .directory-entry:hover {
  background: rgba(0, 0, 0, 0.05);
}

:global(.n-config-provider--light) .directory-entry.selected {
  background: rgba(24, 160, 88, 0.15);
}

:global(.n-config-provider--light) .selected-path {
  background: rgba(0, 0, 0, 0.02);
}
</style>
