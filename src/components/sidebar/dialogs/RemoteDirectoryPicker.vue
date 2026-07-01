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
    :title="t('task.selectRemoteDirectory')"
    :positive-text="t('common.confirm')"
    :negative-text="t('common.cancel')"
    style="width: 600px;"
    :positive-button-props="{ disabled: !currentPath }"
    to="body"
    @positive-click="handleConfirm"
  >
    <div class="remote-directory-picker">
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
            clearable
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

      <!-- Connection status -->
      <div v-if="connectionError" class="connection-error">
        <n-alert type="error" :title="t('task.connectionError')">
          {{ connectionError }}
        </n-alert>
        <n-button size="small" style="margin-top: 8px;" @click="reconnect">{{ t('task.reconnect') }}</n-button>
      </div>

      <!-- Directory listing -->
      <div class="directory-list">
        <n-spin :show="loading || isNavigatingFromInput || pendingInputNavigation">
          <n-scrollbar style="max-height: 400px;">
            <div v-if="displayedEntries.length === 0 && !loading" class="empty-dir">
              {{ entryFilter ? t('task.noMatchingDirectories') : t('task.emptyDirectory') }}
            </div>
            <div
              v-for="entry in displayedEntries"
              :key="entry.path"
              class="directory-entry"
              @click="handleEntryClick(entry)"
              @dblclick="handleEntryDoubleClick(entry)"
            >
              <n-icon size="18" class="entry-icon">
                <component :is="svgIcons.folder" />
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
import { useSshStore } from '../../../stores/ssh';
import { svgIcons } from '../../../utils/icons';
import { getDirectoryEntryFilter, hasPendingDirectoryNavigation } from '../../../utils/pathUtils';
import { useDirectoryInputNavigation } from '../../../composables/useDirectoryInputNavigation';

export interface RemoteDirectoryEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
}

const props = defineProps<{
  show: boolean;
  sshConfigId: string;
  initialPath?: string;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'select', path: string): void;
}>();

const { t } = useI18n();
const sshStore = useSshStore();

const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

const loading = ref(false);
const connectionError = ref<string | null>(null);
const currentPath = ref('/');
const inputPath = ref('/');
const entries = ref<RemoteDirectoryEntry[]>([]);
const homeDir = ref('/');

const sortedEntries = computed(() => {
  return [...entries.value].sort((a, b) => a.name.localeCompare(b.name));
});

const pickerEntries = computed(() =>
  entries.value.map(entry => ({ name: entry.name, path: entry.path }))
);

let continueInputNavigation: () => Promise<void> = async () => {};

// Load directory contents
const loadDirectory = async (path: string, options?: { preserveInput?: boolean }) => {
  if (!props.sshConfigId) {
    connectionError.value = t('task.noSshConfigSelected');
    return;
  }

  loading.value = true;
  connectionError.value = null;

  try {
    const result = await sshStore.listDirectory(props.sshConfigId, path);
    entries.value = result;
    currentPath.value = path;
    if (!options?.preserveInput) {
      inputPath.value = path;
    }
  } catch (error) {
    connectionError.value = error instanceof Error ? error.message : String(error);
    entries.value = [];
  } finally {
    loading.value = false;
    if (options?.preserveInput) {
      await continueInputNavigation();
    }
  }
};

const { isNavigatingFromInput, applyInputNavigation } = useDirectoryInputNavigation({
  currentPath,
  inputPath,
  entries: pickerEntries,
  loading,
  loadDirectory,
});
continueInputNavigation = applyInputNavigation;

const entryFilter = computed(() => getDirectoryEntryFilter(inputPath.value, currentPath.value));

const pendingInputNavigation = computed(() =>
  hasPendingDirectoryNavigation(inputPath.value, currentPath.value, pickerEntries.value)
);

const displayedEntries = computed(() => {
  if (pendingInputNavigation.value || isNavigatingFromInput.value) return [];
  const filter = entryFilter.value.toLowerCase();
  if (!filter) return sortedEntries.value;
  return sortedEntries.value.filter(entry => entry.name.toLowerCase().includes(filter));
});

// Load home directory
const loadHomeDirectory = async () => {
  if (!props.sshConfigId) return;

  try {
    homeDir.value = await sshStore.getHomeDirectory(props.sshConfigId);
  } catch (error) {
    console.error('[RemoteDirectoryPicker] Failed to get home directory:', error);
    homeDir.value = '/';
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
  loadDirectory(homeDir.value);
};

// Navigate to typed path or filter match
const navigateToPath = () => {
  const input = inputPath.value.trim();
  const filter = entryFilter.value;

  if (filter) {
    const exactMatch = entries.value.find(
      entry => entry.name.toLowerCase() === filter.toLowerCase()
    );
    if (exactMatch) {
      loadDirectory(exactMatch.path);
      return;
    }

    if (displayedEntries.value.length === 1) {
      loadDirectory(displayedEntries.value[0].path);
      return;
    }
  }

  loadDirectory(input || '/');
};

// Handle entry click (select directory)
const handleEntryClick = (entry: RemoteDirectoryEntry) => {
  currentPath.value = entry.path;
  inputPath.value = entry.path;
};

// Handle entry double-click (navigate into directory)
const handleEntryDoubleClick = (entry: RemoteDirectoryEntry) => {
  loadDirectory(entry.path);
};

// Reconnect SSH
const reconnect = async () => {
  connectionError.value = null;
  try {
    await sshStore.connect(props.sshConfigId);
    await loadDirectory(currentPath.value);
  } catch (error) {
    connectionError.value = error instanceof Error ? error.message : String(error);
  }
};

// Handle confirm
const handleConfirm = () => {
  emit('select', currentPath.value);
  return true;
};

// Initialize when dialog opens
watch(() => props.show, async (show) => {
  if (show && props.sshConfigId) {
    await loadHomeDirectory();
    const initialPath = props.initialPath || homeDir.value || '/';
    await loadDirectory(initialPath);
  }
}, { immediate: true });

// Watch for sshConfigId changes
watch(() => props.sshConfigId, async (newId) => {
  if (newId && props.show) {
    await loadHomeDirectory();
    await loadDirectory(homeDir.value || '/');
  }
});
</script>

<style scoped>
.remote-directory-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.path-bar {
  margin-bottom: 8px;
}

.connection-error {
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

.entry-icon {
  flex-shrink: 0;
  color: #f5a623;
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

:global(.n-config-provider--light) .selected-path {
  background: rgba(0, 0, 0, 0.02);
}
</style>
