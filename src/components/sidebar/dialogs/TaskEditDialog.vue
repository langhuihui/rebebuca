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
      
      <!-- Task Type Selection (only for user tasks) -->
      <n-form-item v-if="isUserTask" :label="t('task.type')">
        <n-radio-group v-model:value="editingTask.type">
          <n-radio value="shell">{{ t('task.typeShell') }}</n-radio>
          <n-radio value="macro">{{ t('task.typeMacro') }}</n-radio>
        </n-radio-group>
        <n-tooltip v-if="editingTask.type === 'macro'" trigger="hover" placement="top">
          <template #trigger>
            <n-icon size="16" style="margin-left: 8px; cursor: help; vertical-align: middle;">
              <component :is="svgIcons.info" />
            </n-icon>
          </template>
          {{ t('task.macroTaskHelp') }}
        </n-tooltip>
      </n-form-item>
      
      <!-- Command field (hidden for macro tasks) -->
      <n-form-item v-if="editingTask.type !== 'macro'" :label="t('task.command')" path="command">
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
              <n-dropdown
                trigger="click"
                :options="aiToolOptions"
                @select="handleAIToolSelect"
                to="body"
              >
                <n-button>
                  <template #icon>
                    <n-icon size="16">
                      <component :is="svgIcons.ai" />
                    </n-icon>
                  </template>
                </n-button>
              </n-dropdown>
            </template>
            {{ t('aiTools.selectTool') }}
          </n-tooltip>
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
      
      <!-- Macro Task Configuration -->
      <template v-if="editingTask.type === 'macro'">
        <n-form-item :label="t('task.executionMode')" path="executionMode">
          <n-radio-group v-model:value="editingTask.executionMode">
            <n-space vertical :size="8">
              <n-radio value="serial">
                <n-space :size="8">
                  <span>{{ t('task.executionModeSerial') }}</span>
                  <n-tooltip trigger="hover" placement="right">
                    <template #trigger>
                      <n-icon size="14" style="cursor: help;">
                        <component :is="svgIcons.info" />
                      </n-icon>
                    </template>
                    {{ t('task.executionModeSerialDesc') }}
                  </n-tooltip>
                </n-space>
              </n-radio>
              <n-radio value="parallel">
                <n-space :size="8">
                  <span>{{ t('task.executionModeParallel') }}</span>
                  <n-tooltip trigger="hover" placement="right">
                    <template #trigger>
                      <n-icon size="14" style="cursor: help;">
                        <component :is="svgIcons.info" />
                      </n-icon>
                    </template>
                    {{ t('task.executionModeParallelDesc') }}
                  </n-tooltip>
                </n-space>
              </n-radio>
            </n-space>
          </n-radio-group>
        </n-form-item>
        
        <n-form-item :label="t('task.subTasks')" path="subTasks">
          <n-select
            v-model:value="selectedSubTaskIds"
            multiple
            filterable
            :options="availableTaskOptions"
            :placeholder="t('task.selectSubTasks')"
            :max-tag-count="3"
            style="width: 100%;"
          />
          <div v-if="selectedSubTaskIds.length === 0" style="margin-top: 8px; color: var(--n-text-color-3); font-size: 12px;">
            {{ t('task.noSubTasksSelected') }}
          </div>
        </n-form-item>
      </template>
      
      <n-form-item v-if="editingTask.type !== 'macro'" :label="t('task.cwd')">
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
      <n-form-item v-if="editingTask.type !== 'macro'" :label="t('task.env')">
        <n-input 
          v-model:value="editingTask.envStr" 
          type="textarea"
          :placeholder="t('task.envPlaceholder')"
          :autosize="{ minRows: 2, maxRows: 10 }"
          class="env-textarea"
        />
      </n-form-item>
      <n-form-item v-if="editingTask.type !== 'macro'" :label="t('task.useSystemTerminal')">
        <n-space align="center" :size="12">
          <n-switch v-model:value="editingTask.useSystemTerminal" />
          <!-- Terminal selection when using system terminal -->
          <n-select
            v-if="editingTask.useSystemTerminal && terminalOptions.length > 0"
            v-model:value="editingTask.systemTerminalId"
            :options="terminalOptions"
            :placeholder="t('settings.preferredTerminalPlaceholder')"
            :loading="loadingTerminals"
            clearable
            style="min-width: 180px;"
          />
          <!-- Shell selection for built-in terminal -->
          <n-select
            v-if="!editingTask.useSystemTerminal"
            v-model:value="editingTask.shellPath"
            :options="shellOptions"
            :placeholder="t('settings.preferredShellPlaceholder')"
            :loading="loadingShells"
            clearable
            style="min-width: 180px;"
          />
        </n-space>
      </n-form-item>
      
      <!-- Python Environment (Windows/macOS/Linux) -->
      <n-form-item v-if="editingTask.type !== 'macro'" :label="t('task.pythonEnv')">
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
      <n-form-item v-if="isWindowsPlatform && editingTask.type !== 'macro'" :label="t('task.runAsAdmin')">
        <n-switch v-model:value="editingTask.runAsAdmin" />
        <span class="form-hint">{{ t('task.runAsAdminHint') }}</span>
      </n-form-item>
      
      <!-- SSH Remote Execution -->
      <n-form-item v-if="editingTask.type !== 'macro'" :label="t('task.useSsh')">
        <n-switch v-model:value="editingTask.useSsh" />
      </n-form-item>
      
      <!-- SSH Configuration (shown when useSsh is enabled) -->
      <template v-if="editingTask.useSsh && editingTask.type !== 'macro'">
        <n-divider>{{ t('task.sshConfig') }}</n-divider>
        
        <n-form-item :label="t('task.sshHost')" path="sshConfig.host">
          <n-input 
            v-model:value="editingTask.sshConfig!.host" 
            :placeholder="t('task.sshHostPlaceholder')"
          />
        </n-form-item>
        
        <n-form-item :label="t('task.sshPort')" path="sshConfig.port">
          <n-input-number 
            v-model:value="editingTask.sshConfig!.port" 
            :min="1" 
            :max="65535"
            style="width: 100%;"
          />
        </n-form-item>
        
        <n-form-item :label="t('task.sshUsername')" path="sshConfig.username">
          <n-input 
            v-model:value="editingTask.sshConfig!.username" 
            :placeholder="t('task.sshUsernamePlaceholder')"
          />
        </n-form-item>
        
        <n-form-item :label="t('task.sshAuthMethod')">
          <n-radio-group v-model:value="editingTask.sshAuthType">
            <n-space vertical :size="8">
              <n-radio value="password">{{ t('task.sshAuthPassword') }}</n-radio>
              <n-radio value="privateKey">{{ t('task.sshAuthPrivateKey') }}</n-radio>
            </n-space>
          </n-radio-group>
        </n-form-item>
        
        <n-form-item 
          v-if="editingTask.sshAuthType === 'password'" 
          :label="t('task.sshPassword')"
          path="sshConfig.auth.password"
        >
          <n-input 
            v-model:value="editingTask.sshPassword" 
            type="password"
            show-password-on="click"
            :placeholder="t('task.sshPasswordPlaceholder')"
          />
        </n-form-item>
        
        <template v-if="editingTask.sshAuthType === 'privateKey'">
          <n-form-item :label="t('task.sshPrivateKey')" path="sshConfig.auth.key_path">
            <n-input-group>
              <n-input 
                v-model:value="editingTask.sshKeyPath" 
                :placeholder="t('task.sshPrivateKeyPlaceholder')"
              />
              <n-button @click="selectSshKeyFile">
                <template #icon>
                  <n-icon size="16">
                    <component :is="svgIcons.folderOpen" />
                  </n-icon>
                </template>
              </n-button>
            </n-input-group>
          </n-form-item>
          
          <n-form-item :label="t('task.sshPassphrase')">
            <n-input 
              v-model:value="editingTask.sshPassphrase" 
              type="password"
              show-password-on="click"
              :placeholder="t('task.sshPassphrasePlaceholder')"
            />
          </n-form-item>
        </template>
        
        <n-form-item>
          <n-button @click="testSshConnection" :loading="testingSsh">
            {{ t('task.sshTestConnection') }}
          </n-button>
        </n-form-item>
      </template>
      
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
import { ref, computed, watch, onMounted, h } from 'vue';
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NInputNumber,
  NSelect,
  NSwitch,
  NButton,
  NIcon,
  NTooltip,
  NDropdown,
  NSpace,
  NRadio,
  NRadioGroup,
  NDivider,
  type FormRules,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { getAdapter } from '../../../adapters';
import type { SystemTerminalInfo, ShellInfo } from '../../../adapters/types';
import { svgIcons } from '../../../utils/icons';
import { isWindows } from '../../../utils/platform';
import type { TaskGroup } from '../../../providers/types';
import CommandPlazaDialog from './CommandPlazaDialog.vue';
import { useAIToolsStore, type AIToolType } from '../../../stores/aiTools';
import { createAIToolQuickLaunchTask } from '../../../utils/aiToolLauncher';
import { useTaskManagerStore } from '../../../stores/taskManager';

interface EditingTask {
  id: string;
  name: string;
  command: string;
  cwd: string;
  group: TaskGroup;
  type: 'shell' | 'process' | 'macro';
  sourceFile: string;
  useSystemTerminal: boolean;
  systemTerminalId?: string | null;  // Selected terminal ID for system terminal
  shellPath?: string | null;  // Selected shell path for built-in terminal
  envStr: string;
  pythonEnv?: string;
  runAsAdmin?: boolean;
  // Macro task fields
  executionMode?: 'serial' | 'parallel';
  dependsOn?: string[];
  subTasks?: string[];
  // SSH remote execution fields
  useSsh?: boolean;
  sshConfig?: {
    host: string;
    port: number;
    username: string;
    auth?: any;
  };
  sshAuthType?: 'password' | 'privateKey';
  sshPassword?: string;
  sshKeyPath?: string;
  sshPassphrase?: string;
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
const aiToolsStore = useAIToolsStore();
const taskManager = useTaskManagerStore();

const taskFormRef = ref<any>(null);
const newGroupName = ref('');
const showCommandPlaza = ref(false);
const isWindowsPlatform = ref(false);

// Terminal selection
const loadingTerminals = ref(false);
const availableTerminals = ref<SystemTerminalInfo[]>([]);

const terminalOptions = computed(() => {
  return availableTerminals.value.map(terminal => ({
    label: terminal.is_default ? `${terminal.name} (${t('settings.default')})` : terminal.name,
    value: terminal.id,
  }));
});

const loadAvailableTerminals = async () => {
  loadingTerminals.value = true;
  try {
    const adapter = await getAdapter();
    const terminals = await adapter.system.getAvailableTerminals();
    availableTerminals.value = terminals;
  } catch (error) {
    console.error('[TaskEditDialog] Failed to load available terminals:', error);
  } finally {
    loadingTerminals.value = false;
  }
};

// Shell selection for built-in terminal
const loadingShells = ref(false);
const availableShells = ref<ShellInfo[]>([]);

const shellOptions = computed(() => {
  return availableShells.value.map(shell => ({
    label: shell.is_default ? `${shell.name} (${t('settings.default')})` : shell.name,
    value: shell.path,
  }));
});

const loadAvailableShells = async () => {
  loadingShells.value = true;
  try {
    const adapter = await getAdapter();
    const shells = await adapter.system.getAvailableShells();
    availableShells.value = shells;
  } catch (error) {
    console.error('[TaskEditDialog] Failed to load available shells:', error);
  } finally {
    loadingShells.value = false;
  }
};

// AI Tool options for dropdown - get from store to keep consistent with AI tools configuration
const aiToolOptions = computed(() => {
  // Ensure toolConfigs exists and is not empty
  if (!aiToolsStore.toolConfigs || Object.keys(aiToolsStore.toolConfigs).length === 0) {
    return [];
  }
  
  // Get all tools from store's toolConfigs to ensure consistency
  const allTools = Object.keys(aiToolsStore.toolConfigs) as AIToolType[];
  return allTools
    .filter(toolType => aiToolsStore.toolConfigs[toolType]) // Filter out any null/undefined configs
    .map(toolType => {
      const logoUrl = aiToolsStore.getToolLogoUrl(toolType);
      const displayName = aiToolsStore.getToolDisplayName(toolType);
      
      return {
        label: () => {
          if (logoUrl) {
            return h('div', { style: 'display: flex; align-items: center; gap: 8px;' }, [
              h('img', {
                src: logoUrl,
                alt: displayName,
                style: 'width: 16px; height: 16px; object-fit: contain; flex-shrink: 0;',
                onError: (e: Event) => {
                  const img = e.target as HTMLImageElement;
                  if (img) img.style.display = 'none';
                },
              }),
              h('span', displayName),
            ]);
          }
          return displayName;
        },
        key: toolType,
      };
    });
});

// Handle AI tool selection
const handleAIToolSelect = (key: string) => {
  const toolType = key as AIToolType;
  const config = aiToolsStore.toolConfigs[toolType];
  
  // Check if config exists
  if (!config) {
    console.warn(`[TaskEditDialog] Config not found for tool type: ${toolType}`);
    return;
  }
  
  const launchTask = createAIToolQuickLaunchTask(toolType, config);
  editingTask.value.command = launchTask.command;
  if (!editingTask.value.name.trim()) {
    editingTask.value.name = launchTask.name;
  }
};

// Check platform on mount
onMounted(async () => {
  isWindowsPlatform.value = await isWindows();
  await Promise.all([
    aiToolsStore.loadConfigurations(),
    loadAvailableTerminals(),
    loadAvailableShells(),
  ]);
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

// Get available tasks for sub-task selection (exclude macro tasks and current task)
const availableTaskOptions = computed(() => {
  const allTasks = taskManager.allTasks;
  return allTasks
    .filter(task => {
      // Exclude macro tasks and current task being edited
      return task.type !== 'macro' && task.id !== editingTask.value.id;
    })
    .map(task => ({
      label: `${task.name} (${task.source})`,
      value: task.id,
    }));
});

// Handle sub-task selection
const selectedSubTaskIds = computed({
  get: () => {
    if (editingTask.value.executionMode === 'parallel') {
      return editingTask.value.subTasks || [];
    } else {
      return editingTask.value.dependsOn || [];
    }
  },
  set: (value: string[]) => {
    if (editingTask.value.executionMode === 'parallel') {
      editingTask.value.subTasks = value;
      editingTask.value.dependsOn = undefined;
    } else {
      editingTask.value.dependsOn = value;
      editingTask.value.subTasks = undefined;
    }
  },
});

// Dynamic form rules based on task type
const taskRules = computed<FormRules>(() => {
  const rules: FormRules = {
    name: [{ required: true, message: () => t('task.nameRequired') }],
  };
  
  // Only require command for non-macro tasks
  if (editingTask.value.type !== 'macro') {
    rules.command = [{ required: true, message: () => t('task.commandRequired') }];
  }
  
  // Require execution mode for macro tasks
  if (editingTask.value.type === 'macro') {
    rules.executionMode = [{ required: true, message: () => t('task.executionMode') + ' ' + (t('task.nameRequired').includes('必填') ? '必填' : 'is required') }];
    rules.subTasks = [
      { 
        required: true, 
        message: () => t('task.subTasks') + ' ' + (t('task.nameRequired').includes('必填') ? '必填' : 'is required'),
        validator: () => {
          const hasSubTasks = editingTask.value.executionMode === 'parallel' 
            ? (editingTask.value.subTasks?.length || 0) > 0
            : (editingTask.value.dependsOn?.length || 0) > 0;
          return hasSubTasks;
        },
        trigger: 'change'
      }
    ];
  }
  
  return rules;
});

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

// SSH key file selection
const selectSshKeyFile = async () => {
  try {
    const adapter = await getAdapter();
    const selected = await adapter.dialog.selectFile({
      title: t('task.sshPrivateKey'),
      filters: [{
        name: 'SSH Private Key',
        extensions: ['', 'pem', 'ppk'],
      }],
    });
    
    if (selected) {
      editingTask.value.sshKeyPath = selected;
    }
  } catch (error) {
    console.error('[TaskEditDialog] Failed to select SSH key file:', error);
  }
};

// SSH connection test
const testingSsh = ref(false);
const testSshConnection = async () => {
  if (!editingTask.value.sshConfig) {
    return;
  }
  
  testingSsh.value = true;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    
    // Build SSH config with auth
    const sshConfig = {
      host: editingTask.value.sshConfig.host,
      port: editingTask.value.sshConfig.port,
      username: editingTask.value.sshConfig.username,
      auth: editingTask.value.sshAuthType === 'password'
        ? { type: 'password', password: editingTask.value.sshPassword || '' }
        : { 
            type: 'privateKey', 
            key_path: editingTask.value.sshKeyPath || '',
            passphrase: editingTask.value.sshPassphrase || undefined,
          },
    };
    
    const result = await invoke<string>('test_ssh_connection', { config: sshConfig });
    
    const { useMessage } = await import('naive-ui');
    const message = useMessage();
    message.success(t('task.sshTestSuccess') + ': ' + result);
  } catch (error) {
    const { useMessage } = await import('naive-ui');
    const message = useMessage();
    message.error(t('task.sshTestFailed') + ': ' + (error instanceof Error ? error.message : String(error)));
    console.error('[TaskEditDialog] SSH connection test failed:', error);
  } finally {
    testingSsh.value = false;
  }
};

const handleSave = async () => {
  try {
    await taskFormRef.value?.validate();
    
    // Build SSH auth object if SSH is enabled
    if (editingTask.value.useSsh && editingTask.value.sshConfig) {
      editingTask.value.sshConfig.auth = editingTask.value.sshAuthType === 'password'
        ? { type: 'password', password: editingTask.value.sshPassword || '' }
        : { 
            type: 'privateKey', 
            key_path: editingTask.value.sshKeyPath || '',
            passphrase: editingTask.value.sshPassphrase || undefined,
          };
    }
    
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

// Watch task type changes to reset macro-specific fields
watch(() => editingTask.value.type, (newType, oldType) => {
  if (newType !== 'macro' && oldType === 'macro') {
    // Switching from macro to regular task
    editingTask.value.executionMode = undefined;
    editingTask.value.dependsOn = undefined;
    editingTask.value.subTasks = undefined;
  } else if (newType === 'macro' && oldType !== 'macro') {
    // Switching to macro task
    editingTask.value.command = '';
    editingTask.value.executionMode = 'serial'; // Default to serial
    editingTask.value.dependsOn = [];
    editingTask.value.subTasks = undefined;
  }
});

// Watch execution mode changes to sync dependsOn/subTasks
watch(() => editingTask.value.executionMode, (newMode, oldMode) => {
  if (editingTask.value.type === 'macro' && newMode !== oldMode) {
    const currentIds = newMode === 'parallel' 
      ? (editingTask.value.subTasks || [])
      : (editingTask.value.dependsOn || []);
    
    if (newMode === 'parallel') {
      editingTask.value.subTasks = currentIds;
      editingTask.value.dependsOn = undefined;
    } else {
      editingTask.value.dependsOn = currentIds;
      editingTask.value.subTasks = undefined;
    }
  }
});

// Watch useSsh changes to initialize SSH config
watch(() => editingTask.value.useSsh, (useSsh) => {
  if (useSsh && !editingTask.value.sshConfig) {
    editingTask.value.sshConfig = {
      host: '',
      port: 22,
      username: '',
    };
    editingTask.value.sshAuthType = 'password';
    editingTask.value.sshPassword = '';
    editingTask.value.sshKeyPath = '';
    editingTask.value.sshPassphrase = '';
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
