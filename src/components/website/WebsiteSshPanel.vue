<!--
 * Rebebuca Website Demo - SSH Panel
 * Copyright (C) 2025 rebebuca contributors
 -->

<template>
  <div class="ssh-panel">
    <!-- Header -->
    <div class="ssh-header">
      <h3>{{ t("settings.ssh") }}</h3>
      <n-button type="primary" size="small" @click="handleAddConnection">
        <template #icon>
          <n-icon><add-outline /></n-icon>
        </template>
        {{ t("ssh.addConnection") }}
      </n-button>
    </div>

    <!-- SSH Connections List -->
    <div class="ssh-list">
      <div
        v-for="config in sshConfigs"
        :key="config.id"
        class="ssh-item"
        :class="{ connected: config.status === 'connected' }"
      >
        <div class="ssh-item-header">
          <div class="ssh-item-info">
            <n-icon size="20" :color="config.status === 'connected' ? '#18a058' : 'rgba(255,255,255,0.5)'">
              <server-outline />
            </n-icon>
            <span class="ssh-item-name">{{ config.name }}</span>
            <n-tag v-if="config.status === 'connected'" type="success" size="small">
              {{ t("ssh.connected") }}
            </n-tag>
          </div>
          <n-space>
            <n-button
              v-if="config.status === 'connected'"
              size="small"
              quaternary
              @click="handleDisconnect(config.id)"
            >
              {{ t("ssh.disconnect") }}
            </n-button>
            <n-button
              v-else
              size="small"
              type="primary"
              quaternary
              @click="handleConnect(config.id)"
            >
              {{ t("ssh.connect") }}
            </n-button>
            <n-button size="small" quaternary @click="handleEdit(config.id)">
              <template #icon>
                <n-icon size="14"><settings-outline /></n-icon>
              </template>
            </n-button>
          </n-space>
        </div>
        <div class="ssh-item-details">
          {{ config.username }}@{{ config.host }}:{{ config.port }}
        </div>
      </div>
    </div>

    <!-- Quick Connect Form -->
    <n-divider>{{ t("ssh.quickConnect") }}</n-divider>
    <n-form label-placement="left" :label-width="80">
      <n-form-item :label="t('ssh.name')">
        <n-input
          v-model:value="newSshForm.name"
          :placeholder="t('ssh.namePlaceholder')"
          size="small"
        />
      </n-form-item>
      <n-form-item :label="t('ssh.host')">
        <n-input-group>
          <n-input
            v-model:value="newSshForm.host"
            placeholder="example.com"
            size="small"
            style="flex: 3"
          />
          <n-input-number
            v-model:value="newSshForm.port"
            :min="1"
            :max="65535"
            size="small"
            style="width: 100px"
          />
        </n-input-group>
      </n-form-item>
      <n-form-item :label="t('ssh.username')">
        <n-input
          v-model:value="newSshForm.username"
          placeholder="root"
          size="small"
        />
      </n-form-item>
      <n-form-item :label="t('ssh.authType')">
        <n-radio-group v-model:value="newSshForm.authType" size="small">
          <n-radio value="password">{{ t("ssh.password") }}</n-radio>
          <n-radio value="key">{{ t("ssh.privateKey") }}</n-radio>
        </n-radio-group>
      </n-form-item>
      <n-form-item v-if="newSshForm.authType === 'password'" :label="t('ssh.password')">
        <n-input
          v-model:value="newSshForm.password"
          type="password"
          show-password-on="click"
          placeholder="********"
          size="small"
        />
      </n-form-item>
      <n-form-item v-if="newSshForm.authType === 'key'" :label="t('ssh.privateKey')">
        <n-input-group>
          <n-input
            v-model:value="newSshForm.privateKeyPath"
            placeholder="~/.ssh/id_rsa"
            size="small"
          />
          <n-button size="small" @click="handleBrowseKey">
            {{ t("task.browse") }}
          </n-button>
        </n-input-group>
      </n-form-item>
      <div class="ssh-form-actions">
        <n-button size="small" @click="handleTestConnection">
          {{ t("ssh.testConnection") }}
        </n-button>
        <n-button type="primary" size="small" @click="handleSave">
          {{ t("common.save") }}
        </n-button>
      </div>
    </n-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import {
  NButton,
  NIcon,
  NTag,
  NSpace,
  NDivider,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NInputNumber,
  NRadio,
  NRadioGroup,
  useMessage,
} from "naive-ui";
import { AddOutline, ServerOutline, SettingsOutline } from "@vicons/ionicons5";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const message = useMessage();

const sshConfigs = ref([
  { id: "dev-server", name: "开发服务器", host: "dev.example.com", port: 22, username: "admin", status: "connected" },
  { id: "prod-server", name: "生产服务器", host: "prod.example.com", port: 22, username: "deploy", status: "disconnected" },
  { id: "test-server", name: "测试服务器", host: "test.example.com", port: 2222, username: "tester", status: "disconnected" },
]);

const newSshForm = reactive({
  name: "",
  host: "",
  port: 22,
  username: "",
  authType: "password" as "password" | "key",
  password: "",
  privateKeyPath: "",
});

const handleAddConnection = () => {
  message.info(t("website.demo.settingsSaved"));
};

const handleConnect = (id: string) => {
  const config = sshConfigs.value.find((c) => c.id === id);
  if (config) {
    config.status = "connected";
    message.success(t("ssh.connected"));
  }
};

const handleDisconnect = (id: string) => {
  const config = sshConfigs.value.find((c) => c.id === id);
  if (config) {
    config.status = "disconnected";
    message.info(t("ssh.disconnected"));
  }
};

const handleEdit = (_id: string) => {
  message.info(t("website.demo.settingsSaved"));
};

const handleBrowseKey = () => {
  newSshForm.privateKeyPath = "~/.ssh/id_rsa";
  message.info(t("website.demo.folderHint"));
};

const handleTestConnection = () => {
  message.info(t("ssh.testConnection"));
};

const handleSave = () => {
  message.success(t("ssh.saved"));
};
</script>

<style scoped>
.ssh-panel {
  padding: 24px;
}

.ssh-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.ssh-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.ssh-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.ssh-item {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s;
}

.ssh-item.connected {
  border-color: rgba(24, 160, 88, 0.5);
}

.ssh-item:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.ssh-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ssh-item-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ssh-item-name {
  font-weight: 500;
  font-size: 14px;
}

.ssh-item-details {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.ssh-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
