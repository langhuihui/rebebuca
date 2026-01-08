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
        <n-button type="primary" @click="showAddDialog = true">
          <template #icon>
            <n-icon size="16">
              <component :is="svgIcons.plus" />
            </n-icon>
          </template>
          {{ t('ssh.addConfig') }}
        </n-button>
      </n-space>
    </div>

    <n-divider />

    <!-- SSH Configs List -->
    <div class="ssh-configs-list">
      <n-empty v-if="sshStore.configs.length === 0" style="margin-top: 40px;" :description="t('ssh.noConfigs')" />

      <n-list v-else bordered>
        <n-list-item v-for="config in sshStore.configs" :key="config.id">
          <template #prefix>
            <n-icon size="20" :style="{ color: getStatusColor(config.id) }">
              <component :is="svgIcons.server" />
            </n-icon>
          </template>
          
          <n-thing>
            <template #header>
              <n-space justify="space-between" align="center">
                <div>
                  <strong>{{ config.name }}</strong>
                  <n-tag
                    :type="getStatusTagType(config.id)"
                    size="small"
                    style="margin-left: 8px"
                  >
                    {{ getStatusLabel(config.id) }}
                  </n-tag>
                  <n-tag
                    v-if="getConnectionStatus(config.id)?.task_count"
                    type="info"
                    size="small"
                    style="margin-left: 4px"
                  >
                    {{ getConnectionStatus(config.id)?.task_count }} {{ t('ssh.tasks') }}
                  </n-tag>
                </div>
                
                <n-space :size="8">
                  <n-button
                    size="small"
                    :loading="testingConnection[config.id] || testingAgent[config.id]"
                    @click="testConnection(config)"
                  >
                    {{ t('ssh.testConnection') }}
                  </n-button>
                  <n-button
                    v-if="!isConnected(config.id)"
                    size="small"
                    type="primary"
                    :loading="sshStore.loading"
                    @click="connect(config.id)"
                  >
                    {{ t('ssh.connect') }}
                  </n-button>
                  <n-button
                    v-else
                    size="small"
                    :loading="sshStore.loading"
                    @click="disconnect(config.id)"
                  >
                    {{ t('ssh.disconnect') }}
                  </n-button>
                  <n-button
                    size="small"
                    @click="editConfig(config)"
                  >
                    {{ t('ssh.edit') }}
                  </n-button>
                  <n-button
                    size="small"
                    type="error"
                    @click="deleteConfig(config.id)"
                  >
                    {{ t('ssh.delete') }}
                  </n-button>
                </n-space>
              </n-space>
            </template>
            
            <template #description>
              <div style="font-size: 12px; color: var(--n-text-color-3); margin-top: 4px;">
                {{ config.username }}@{{ config.host }}:{{ config.port }}
                <span v-if="config.keepAliveInterval">
                  · {{ t('ssh.keepAliveInterval') }}: {{ config.keepAliveInterval }}s
                </span>
                <span v-if="config.keepConnection">
                  · {{ t('ssh.keepConnection') }}
                </span>
              </div>
            </template>
          </n-thing>
        </n-list-item>
      </n-list>
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
          path="auth.password"
        >
          <n-input
            v-model:value="editingConfig.password"
            type="password"
            show-password-on="click"
            :placeholder="t('ssh.passwordPlaceholder')"
          />
        </n-form-item>
        
        <template v-if="editingConfig.authType === 'privateKey'">
          <n-form-item :label="t('ssh.privateKey')" path="auth.key_path">
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  NButton,
  NIcon,
  NSpace,
  NTag,
  NList,
  NListItem,
  NThing,
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
  useMessage,
  type FormRules,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useSshStore, type SshConfig, type SshAuthMethod } from '../../stores/ssh';
import { svgIcons } from '../../utils/icons';
import { getAdapter } from '../../adapters';

const { t } = useI18n();
const message = useMessage();
const sshStore = useSshStore();

const showAddDialog = ref(false);
const showEditDialog = ref(false);
const configFormRef = ref<any>(null);
const testingConnection = ref<Record<string, boolean>>({});
const testingAgent = ref<Record<string, boolean>>({});

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

const configRules: FormRules = {
  name: [{ required: true, message: () => t('ssh.nameRequired') }],
  host: [{ required: true, message: () => t('ssh.hostRequired') }],
  port: [{ required: true, message: () => t('ssh.portRequired') }],
  username: [{ required: true, message: () => t('ssh.usernameRequired') }],
  'auth.password': [
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
  'auth.key_path': [
    {
      required: true,
      validator: () => {
        if (editingConfig.value.authType === 'privateKey' && !editingConfig.value.keyPath) {
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

const isConnected = (id: string): boolean => {
  return sshStore.isConnected(id);
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

.ssh-configs-list {
  margin-top: 16px;
}
</style>
