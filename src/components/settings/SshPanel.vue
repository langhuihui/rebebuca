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
  <div class="ssh-panel">
    <div class="ssh-header">
      <n-space justify="space-between" align="center">
        <div>
          <h3 style="margin: 0;">{{ t('ssh.title') }}</h3>
          <div style="font-size: 12px; color: var(--n-text-color-3); margin-top: 4px;">
            {{ t('ssh.description') }}
          </div>
        </div>
        <n-space :size="8">
          <n-button @click="showImportDialog = true">
            <template #icon>
              <n-icon size="16">
                <component :is="svgIcons.import" />
              </n-icon>
            </template>
            {{ t('ssh.importFromConfig') }}
          </n-button>
          <n-button type="primary" @click="showAddDialog = true">
            <template #icon>
              <n-icon size="16">
                <component :is="svgIcons.plus" />
              </n-icon>
            </template>
            {{ t('ssh.addConfig') }}
          </n-button>
        </n-space>
      </n-space>
    </div>

    <n-divider />

    <!-- SSH Configs Table -->
    <div class="ssh-configs-table">
      <n-empty v-if="sshStore.configs.length === 0" style="margin-top: 40px;" :description="t('ssh.noConfigs')" />

      <n-data-table
        v-else
        :columns="tableColumns"
        :data="sshStore.configs"
        :row-key="(row: SshConfig) => row.id"
        size="small"
        striped
      />
    </div>

    <!-- Add/Edit Dialog -->
    <n-modal
      v-model:show="showConfigDialog"
      preset="dialog"
      :title="showEditDialog ? t('ssh.editConfig') : t('ssh.addConfig')"
      :positive-text="t('common.save')"
      :negative-text="t('common.cancel')"
      style="width: 600px;"
      to="body"
      @positive-click="handleSave"
    >
      <n-form
        ref="configFormRef"
        :model="editingConfig"
        :rules="configRules"
        label-placement="left"
        label-width="auto"
      >
        <n-form-item :label="t('ssh.name')" path="name">
          <n-input v-model:value="editingConfig.name" :placeholder="t('ssh.namePlaceholder')" />
        </n-form-item>
        
        <n-form-item :label="t('ssh.host')" path="host">
          <n-input v-model:value="editingConfig.host" :placeholder="t('ssh.hostPlaceholder')" />
        </n-form-item>
        
        <n-form-item :label="t('ssh.port')" path="port">
          <n-input-number
            v-model:value="editingConfig.port"
            :min="1"
            :max="65535"
            style="width: 100%;"
          />
        </n-form-item>
        
        <n-form-item :label="t('ssh.username')" path="username">
          <n-input v-model:value="editingConfig.username" :placeholder="t('ssh.usernamePlaceholder')" />
        </n-form-item>
        
        <n-form-item :label="t('ssh.authMethod')">
          <n-radio-group v-model:value="editingConfig.authType">
            <n-space vertical :size="8">
              <n-radio value="password">{{ t('ssh.authPassword') }}</n-radio>
              <n-radio value="privateKey">{{ t('ssh.authPrivateKey') }}</n-radio>
            </n-space>
          </n-radio-group>
        </n-form-item>
        
        <n-form-item
          v-if="editingConfig.authType === 'password'"
          :label="t('ssh.password')"
          path="password"
        >
          <n-input
            v-model:value="editingConfig.password"
            type="password"
            show-password-on="click"
            :placeholder="t('ssh.passwordPlaceholder')"
          />
        </n-form-item>
        
        <template v-if="editingConfig.authType === 'privateKey'">
          <n-form-item :label="t('ssh.privateKey')" path="keyPath">
            <n-input-group>
              <n-input
                v-model:value="editingConfig.keyPath"
                :placeholder="t('ssh.privateKeyPlaceholder')"
              />
              <n-button @click="selectKeyFile">
                <template #icon>
                  <n-icon size="16">
                    <component :is="svgIcons.folderOpen" />
                  </n-icon>
                </template>
              </n-button>
            </n-input-group>
          </n-form-item>
          
          <n-form-item :label="t('ssh.passphrase')">
            <n-input
              v-model:value="editingConfig.passphrase"
              type="password"
              show-password-on="click"
              :placeholder="t('ssh.passphrasePlaceholder')"
            />
          </n-form-item>
        </template>
        
        <n-divider>{{ t('ssh.advanced') }}</n-divider>
        
        <n-form-item :label="t('ssh.keepAliveInterval')">
          <n-input-number
            v-model:value="editingConfig.keepAliveInterval"
            :min="10"
            :max="300"
            style="width: 100%;"
          >
            <template #suffix>秒</template>
          </n-input-number>
          <div style="font-size: 12px; color: var(--n-text-color-3); margin-top: 4px;">
            {{ t('ssh.keepAliveIntervalHint') }}
          </div>
        </n-form-item>
        
        <n-form-item :label="t('ssh.keepConnection')">
          <n-switch v-model:value="editingConfig.keepConnection" />
          <div style="font-size: 12px; color: var(--n-text-color-3); margin-top: 4px; margin-left: 8px; display: inline-block;">
            {{ t('ssh.keepConnectionHint') }}
          </div>
        </n-form-item>
      </n-form>
    </n-modal>
    
    <!-- Import from SSH Config Dialog -->
    <n-modal
      v-model:show="showImportDialog"
      preset="dialog"
      :title="t('ssh.importFromConfig')"
      :positive-text="t('ssh.importSelected')"
      :negative-text="t('common.cancel')"
      style="width: 600px;"
      to="body"
      :positive-button-props="{ disabled: selectedImportHosts.length === 0 }"
      @positive-click="handleImport"
    >
      <div style="margin-bottom: 16px;">
        <n-space align="center" :size="8">
          <n-input
            v-model:value="sshConfigPath"
            :placeholder="t('ssh.configPathPlaceholder')"
            style="flex: 1;"
          />
          <n-button @click="selectSshConfigFile">
            <template #icon>
              <n-icon size="16">
                <component :is="svgIcons.folderOpen" />
              </n-icon>
            </template>
          </n-button>
          <n-button
            type="primary"
            :loading="parsingConfig"
            @click="parseSshConfigFile"
          >
            {{ t('ssh.parseConfig') }}
          </n-button>
        </n-space>
        <div style="font-size: 12px; color: var(--n-text-color-3); margin-top: 8px;">
          {{ t('ssh.configPathHint') }}
        </div>
      </div>
      
      <n-divider />
      
      <div v-if="parsedHosts.length === 0 && !parsingConfig" style="text-align: center; color: var(--n-text-color-3); padding: 20px;">
        {{ t('ssh.noHostsFound') }}
      </div>
      
      <template v-else>
        <!-- Select All / Deselect All -->
        <div style="margin-bottom: 8px;">
          <n-space :size="8">
            <n-button size="small" @click="selectAllHosts">
              {{ t('ssh.selectAll') }}
            </n-button>
            <n-button size="small" @click="deselectAllHosts">
              {{ t('ssh.deselectAll') }}
            </n-button>
            <span style="font-size: 12px; color: var(--n-text-color-3); line-height: 28px;">
              {{ t('ssh.selectedCount', { selected: selectedImportHosts.length, total: parsedHosts.length }) }}
            </span>
          </n-space>
        </div>
        
        <!-- Host List with scroll -->
        <n-checkbox-group v-model:value="selectedImportHosts">
          <n-list bordered style="max-height: 300px; overflow-y: auto;">
            <n-list-item v-for="host in parsedHosts" :key="host.host">
              <template #prefix>
                <n-checkbox :value="host.host" />
              </template>
              <n-thing>
                <template #header>
                  <strong>{{ host.host }}</strong>
                </template>
                <template #description>
                  <div style="font-size: 12px; color: var(--n-text-color-3);">
                    {{ host.user || 'root' }}@{{ host.hostname }}:{{ host.port }}
                    <span v-if="host.identityFile">
                      · {{ t('ssh.authPrivateKey') }}: {{ host.identityFile }}
                    </span>
                  </div>
                </template>
              </n-thing>
            </n-list-item>
          </n-list>
        </n-checkbox-group>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import {
  NButton,
  NIcon,
  NSpace,
  NTag,
  NDataTable,
  NTooltip,
  NEmpty,
  NDivider,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NInputNumber,
  NRadioGroup,
  NRadio,
  NSwitch,
  NCheckbox,
  NCheckboxGroup,
  useMessage,
  type FormRules,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useSshStore, type SshConfig, type SshAuthMethod } from '../../stores/ssh';
import { useTerminalStore } from '../../stores/terminal';
import { svgIcons } from '../../utils/icons';
import { getAdapter } from '../../adapters';

// Helper to get home directory (works in both Tauri and server modes)
async function getHomeDir(): Promise<string> {
  const adapter = await getAdapter();
  return adapter.system.getHomeDir();
}

const { t } = useI18n();
const message = useMessage();
const sshStore = useSshStore();
const terminalStore = useTerminalStore();

const showAddDialog = ref(false);
const showEditDialog = ref(false);
const showImportDialog = ref(false);
const configFormRef = ref<any>(null);
const testingConnection = ref<Record<string, boolean>>({});
const testingAgent = ref<Record<string, boolean>>({});

// Import from SSH config state
const sshConfigPath = ref('');
const parsingConfig = ref(false);
const parsedHosts = ref<Array<{
  host: string;
  hostname: string;
  port: number;
  user: string;
  identityFile?: string;
}>>([]);
const selectedImportHosts = ref<string[]>([]);

// Computed map for connection statuses to ensure reactivity
const connectionStatusMap = computed(() => {
  // Access the object to create reactive dependency
  const statuses = sshStore.connectionStatuses;
  const result: Record<string, boolean> = {};
  for (const config of sshStore.configs) {
    const status = statuses[config.id];
    result[config.id] = status?.status === 'connected' || status?.status === 'agent_ready';
  }
  return result;
});

// Computed property for dialog visibility
const showConfigDialog = computed({
  get: () => showAddDialog.value || showEditDialog.value,
  set: (value: boolean) => {
    if (!value) {
      showAddDialog.value = false;
      showEditDialog.value = false;
    }
  },
});

interface EditingConfig {
  id?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'privateKey';
  password?: string;
  keyPath?: string;
  passphrase?: string;
  keepAliveInterval?: number;
  keepConnection?: boolean;
}

const editingConfig = ref<EditingConfig>({
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password',
  keepAliveInterval: 60,
  keepConnection: false,
});

// Table columns definition
const tableColumns = computed(() => [
  {
    title: t('ssh.name'),
    key: 'name',
    width: 150,
    render: (row: SshConfig) => {
      return h('div', { class: 'ssh-name-cell' }, [
        h(NIcon, { size: 16, style: { color: getStatusColor(row.id), marginRight: '8px', verticalAlign: 'middle' } }, {
          default: () => h(svgIcons.server)
        }),
        h('span', { style: { fontWeight: '500' } }, row.name)
      ]);
    }
  },
  {
    title: t('ssh.host'),
    key: 'connection',
    width: 200,
    render: (row: SshConfig) => {
      return h('span', { style: { fontSize: '12px' } }, `${row.username}@${row.host}:${row.port}`);
    }
  },
  {
    title: t('ssh.statusLabel'),
    key: 'status',
    width: 120,
    render: (row: SshConfig) => {
      const status = getConnectionStatus(row.id);
      const taskCount = status?.task_count;
      return h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } }, [
        h(NTag, { type: getStatusTagType(row.id), size: 'small' }, { default: () => getStatusLabel(row.id) }),
        taskCount ? h(NTag, { type: 'info', size: 'small' }, { default: () => `${taskCount} ${t('ssh.tasks')}` }) : null
      ].filter(Boolean));
    }
  },
  {
    title: t('ssh.actions'),
    key: 'actions',
    width: 220,
    render: (row: SshConfig) => {
      const isConnected = connectionStatusMap.value[row.id];
      const isTesting = testingConnection.value[row.id] || testingAgent.value[row.id];
      
      return h('div', { class: 'ssh-actions-cell' }, [
        // Test connection button
        h(NTooltip, { trigger: 'hover' }, {
          trigger: () => h(NButton, {
            size: 'small',
            quaternary: true,
            circle: true,
            loading: isTesting,
            onClick: () => testConnection(row)
          }, {
            icon: () => h(NIcon, { size: 16 }, { default: () => h(svgIcons.network) })
          }),
          default: () => t('ssh.testConnection')
        }),
        // Connect/Disconnect button
        isConnected
          ? h(NTooltip, { trigger: 'hover' }, {
              trigger: () => h(NButton, {
                size: 'small',
                quaternary: true,
                circle: true,
                loading: sshStore.loading,
                onClick: () => disconnect(row.id)
              }, {
                icon: () => h(NIcon, { size: 16 }, { default: () => h(svgIcons.stop) })
              }),
              default: () => t('ssh.disconnect')
            })
          : h(NTooltip, { trigger: 'hover' }, {
              trigger: () => h(NButton, {
                size: 'small',
                quaternary: true,
                circle: true,
                type: 'primary',
                loading: sshStore.loading,
                onClick: () => connect(row.id)
              }, {
                icon: () => h(NIcon, { size: 16 }, { default: () => h(svgIcons.play) })
              }),
              default: () => t('ssh.connect')
            }),
        // Open terminal button
        h(NTooltip, { trigger: 'hover' }, {
          trigger: () => h(NButton, {
            size: 'small',
            quaternary: true,
            circle: true,
            onClick: () => openSshTerminal(row)
          }, {
            icon: () => h(NIcon, { size: 16 }, { default: () => h(svgIcons.terminal) })
          }),
          default: () => t('ssh.openTerminal')
        }),
        // Edit button
        h(NTooltip, { trigger: 'hover' }, {
          trigger: () => h(NButton, {
            size: 'small',
            quaternary: true,
            circle: true,
            onClick: () => editConfig(row)
          }, {
            icon: () => h(NIcon, { size: 16 }, { default: () => h(svgIcons.edit) })
          }),
          default: () => t('ssh.edit')
        }),
        // Delete button
        h(NTooltip, { trigger: 'hover' }, {
          trigger: () => h(NButton, {
            size: 'small',
            quaternary: true,
            circle: true,
            type: 'error',
            onClick: () => deleteConfig(row.id)
          }, {
            icon: () => h(NIcon, { size: 16 }, { default: () => h(svgIcons.clean) })
          }),
          default: () => t('ssh.delete')
        })
      ]);
    }
  }
]);

const configRules: FormRules = {
  name: [{ required: true, message: () => t('ssh.nameRequired') }],
  host: [{ required: true, message: () => t('ssh.hostRequired') }],
  port: [{ required: true, message: () => t('ssh.portRequired') }],
  username: [{ required: true, message: () => t('ssh.usernameRequired') }],
  password: [
    {
      required: true,
      validator: (_rule, value) => {
        if (editingConfig.value.authType === 'password' && !value) {
          return new Error(t('ssh.passwordRequired'));
        }
        return true;
      },
      trigger: 'blur',
    },
  ],
  keyPath: [
    {
      required: true,
      validator: (_rule, value) => {
        if (editingConfig.value.authType === 'privateKey' && !value) {
          return new Error(t('ssh.privateKeyRequired'));
        }
        return true;
      },
      trigger: 'blur',
    },
  ],
};

const getStatusColor = (id: string): string => {
  const status = sshStore.getConnectionStatus(id);
  if (!status) return 'var(--n-text-color-3)';
  
  switch (status.status) {
    case 'agent_ready':
      return '#18a058';
    case 'connected':
      return '#2080f0';
    case 'connecting':
      return '#f0a020';
    default:
      return 'var(--n-text-color-3)';
  }
};

const getStatusTagType = (id: string): 'default' | 'success' | 'warning' | 'error' => {
  const status = sshStore.getConnectionStatus(id);
  if (!status) return 'default';
  
  switch (status.status) {
    case 'agent_ready':
      return 'success';
    case 'connected':
      return 'default';
    case 'connecting':
      return 'warning';
    default:
      return 'default';
  }
};

const getStatusLabel = (id: string): string => {
  const status = sshStore.getConnectionStatus(id);
  if (!status) return t('ssh.status.disconnected');
  
  switch (status.status) {
    case 'agent_ready':
      return t('ssh.status.agentReady');
    case 'connected':
      return t('ssh.status.connected');
    case 'connecting':
      return t('ssh.status.connecting');
    default:
      return t('ssh.status.disconnected');
  }
};

const getConnectionStatus = (id: string) => {
  return sshStore.getConnectionStatus(id);
};

const testConnection = async (config: SshConfig) => {
  testingConnection.value[config.id] = true;
  try {
    const result = await sshStore.testConnection(config);
    message.success(result);
    
    // Test agent after connection test
    testingAgent.value[config.id] = true;
    try {
      const agentReady = await sshStore.testAgent(config.id);
      if (agentReady) {
        message.success(t('ssh.agentReady'));
      } else {
        message.warning(t('ssh.agentNotReady'));
      }
    } finally {
      testingAgent.value[config.id] = false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    message.error(t('ssh.testFailed') + ': ' + errorMessage);
  } finally {
    testingConnection.value[config.id] = false;
  }
};

const connect = async (id: string) => {
  try {
    await sshStore.connect(id);
    message.success(t('ssh.connected'));
    
    // Test agent after connecting
    testingAgent.value[id] = true;
    try {
      const agentReady = await sshStore.testAgent(id);
      if (agentReady) {
        message.success(t('ssh.agentReady'));
      } else {
        message.warning(t('ssh.agentNotReady'));
      }
    } finally {
      testingAgent.value[id] = false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    message.error(t('ssh.connectFailed') + ': ' + errorMessage);
  }
};

const disconnect = async (id: string) => {
  try {
    await sshStore.disconnect(id);
    message.success(t('ssh.disconnected'));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    message.error(t('ssh.disconnectFailed') + ': ' + errorMessage);
  }
};

const openSshTerminal = async (config: SshConfig) => {
  try {
    const args: string[] = ['-p', String(config.port)];

    // Avoid host key interactive prompt on first connect
    // Use 'accept-new' for OpenSSH >= 7.6, fallback to 'no' for older versions
    // When using password auth with auto-input, we need to skip prompts entirely
    if (config.auth.type === 'password') {
      // For password auth, skip host key check to avoid "yes/no" prompt interfering with password input
      args.push('-o', 'StrictHostKeyChecking=no');
      args.push('-o', 'UserKnownHostsFile=/dev/null');
    } else {
      // For key auth, use accept-new (safer, but may prompt on old SSH)
      args.push('-o', 'StrictHostKeyChecking=accept-new');
    }

    if (config.auth.type === 'privateKey' && config.auth.key_path) {
      args.push('-i', config.auth.key_path);
    }

    if (config.keepAliveInterval && config.keepAliveInterval > 0) {
      args.push('-o', `ServerAliveInterval=${config.keepAliveInterval}`);
    }

    args.push(`${config.username}@${config.host}`);

    await terminalStore.executeTask({
      label: `[SSH] ${config.name}`,
      command: 'ssh',
      args,
      // Auto-enter password when SSH prompts for it
      autoInput: config.auth.type === 'password' && config.auth.password
        ? {
            // Match common SSH password prompts (case-insensitive)
            pattern: 'password:',
            input: `${config.auth.password}\n`,
            timeout: 30000,
          }
        : undefined,
    });

    if (config.auth.type === 'password') {
      message.info(t('ssh.passwordAutoInputInTerminal'));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    message.error(t('ssh.openTerminalFailed') + ': ' + errorMessage);
  }
};

const editConfig = (config: SshConfig) => {
  editingConfig.value = {
    id: config.id,
    name: config.name,
    host: config.host,
    port: config.port,
    username: config.username,
    authType: config.auth.type,
    password: config.auth.type === 'password' ? config.auth.password : undefined,
    keyPath: config.auth.type === 'privateKey' ? config.auth.key_path : undefined,
    passphrase: config.auth.type === 'privateKey' ? config.auth.passphrase : undefined,
    keepAliveInterval: config.keepAliveInterval ?? 60,
    keepConnection: config.keepConnection ?? false,
  };
  showEditDialog.value = true;
};

const deleteConfig = async (id: string) => {
  try {
    await sshStore.deleteConfig(id);
    message.success(t('ssh.configDeleted'));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    message.error(t('ssh.deleteFailed') + ': ' + errorMessage);
  }
};

const selectKeyFile = async () => {
  try {
    const adapter = await getAdapter();
    const selected = await adapter.dialog.selectFile({
      title: t('ssh.selectPrivateKey'),
      filters: [{
        name: 'SSH Private Key',
        extensions: ['', 'pem', 'ppk', 'key'],
      }],
    });
    
    if (selected) {
      editingConfig.value.keyPath = selected;
    }
  } catch (error) {
    console.error('[SSH Panel] Failed to select key file:', error);
  }
};

const handleSave = async () => {
  try {
    await configFormRef.value?.validate();
    
    const auth: SshAuthMethod = editingConfig.value.authType === 'password'
      ? {
          type: 'password',
          password: editingConfig.value.password || '',
        }
      : {
          type: 'privateKey',
          key_path: editingConfig.value.keyPath || '',
          passphrase: editingConfig.value.passphrase,
        };
    
    if (editingConfig.value.id) {
      // Update existing
      await sshStore.updateConfig(editingConfig.value.id, {
        name: editingConfig.value.name,
        host: editingConfig.value.host,
        port: editingConfig.value.port,
        username: editingConfig.value.username,
        auth,
        keepAliveInterval: editingConfig.value.keepAliveInterval,
        keepConnection: editingConfig.value.keepConnection,
      });
      message.success(t('ssh.configUpdated'));
    } else {
      // Add new
      await sshStore.addConfig({
        name: editingConfig.value.name,
        host: editingConfig.value.host,
        port: editingConfig.value.port,
        username: editingConfig.value.username,
        auth,
        keepAliveInterval: editingConfig.value.keepAliveInterval,
        keepConnection: editingConfig.value.keepConnection,
      });
      message.success(t('ssh.configAdded'));
    }
    
    showAddDialog.value = false;
    showEditDialog.value = false;
    resetEditingConfig();
    
    return true;
  } catch (error) {
    console.error('[SSH Panel] Validation or save failed:', error);
    return false;
  }
};

const resetEditingConfig = () => {
  editingConfig.value = {
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password',
    keepAliveInterval: 60,
    keepConnection: false,
  };
};

// Watch dialog state
watch(showConfigDialog, (isOpen) => {
  if (!isOpen) {
    resetEditingConfig();
  }
});

// Watch import dialog state
watch(showImportDialog, (isOpen) => {
  if (!isOpen) {
    // Reset import state when dialog closes
    parsedHosts.value = [];
    selectedImportHosts.value = [];
  } else {
    // Set default path when dialog opens
    initDefaultSshConfigPath();
  }
});

// Initialize default SSH config path
const initDefaultSshConfigPath = async () => {
  try {
    const homeDir = await getHomeDir();
    sshConfigPath.value = `${homeDir}/.ssh/config`;
  } catch (error) {
    console.error('[SSH Panel] Failed to get home directory:', error);
    sshConfigPath.value = '~/.ssh/config';
  }
};

// Select all hosts
const selectAllHosts = () => {
  selectedImportHosts.value = parsedHosts.value.map(h => h.host);
};

// Deselect all hosts
const deselectAllHosts = () => {
  selectedImportHosts.value = [];
};

// Select SSH config file
const selectSshConfigFile = async () => {
  try {
    const adapter = await getAdapter();
    const selected = await adapter.dialog.selectFile({
      title: t('ssh.selectConfigFile'),
      filters: [{
        name: 'SSH Config',
        extensions: ['', 'config'],
      }],
    });
    
    if (selected) {
      sshConfigPath.value = selected;
    }
  } catch (error) {
    console.error('[SSH Panel] Failed to select config file:', error);
  }
};

// Parse SSH config file
const parseSshConfigFile = async () => {
  if (!sshConfigPath.value) {
    message.warning(t('ssh.configPathRequired'));
    return;
  }
  
  parsingConfig.value = true;
  try {
    const adapter = await getAdapter();
    
    // Expand ~ to home directory
    let path = sshConfigPath.value;
    if (path.startsWith('~')) {
      const homeDir = await getHomeDir();
      path = path.replace(/^~/, homeDir);
    }
    
    // Read file content
    const content = await adapter.fs.readTextFile(path);
    
    // Parse content
    const hosts = sshStore.parseSshConfigContent(content);
    parsedHosts.value = hosts;
    
    // Select all by default
    selectedImportHosts.value = hosts.map(h => h.host);
    
    if (hosts.length === 0) {
      message.info(t('ssh.noHostsFound'));
    } else {
      message.success(t('ssh.hostsFound', { count: hosts.length }));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    message.error(t('ssh.parseConfigFailed') + ': ' + errorMessage);
    console.error('[SSH Panel] Failed to parse SSH config:', error);
  } finally {
    parsingConfig.value = false;
  }
};

// Handle import
const handleImport = async () => {
  if (selectedImportHosts.value.length === 0) {
    return false;
  }
  
  try {
    const homeDir = await getHomeDir();
    
    // Filter selected hosts
    const hostsToImport = parsedHosts.value.filter(h => 
      selectedImportHosts.value.includes(h.host)
    );
    
    const result = await sshStore.importFromSshConfig(hostsToImport, homeDir);
    
    if (result.imported > 0) {
      message.success(t('ssh.importSuccess', { imported: result.imported, skipped: result.skipped }));
    } else if (result.skipped > 0) {
      message.info(t('ssh.allSkipped'));
    }
    
    showImportDialog.value = false;
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    message.error(t('ssh.importFailed') + ': ' + errorMessage);
    console.error('[SSH Panel] Failed to import SSH configs:', error);
    return false;
  }
};

onMounted(async () => {
  await sshStore.initialize();
});
</script>

<style scoped>
.ssh-panel {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
}

.ssh-header {
  margin-bottom: 16px;
}

.ssh-configs-table {
  margin-top: 16px;
}

.ssh-name-cell {
  display: flex;
  align-items: center;
}

.ssh-actions-cell {
  display: flex;
  gap: 4px;
  align-items: center;
}
</style>
