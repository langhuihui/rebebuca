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
    :show="show"
    preset="card"
    :title="t('aiCollab.createNativeSession')"
    style="width: 560px; max-width: 90vw;"
    :mask-closable="false"
    @update:show="$emit('update:show', $event)"
  >
    <n-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-placement="left"
      label-width="100"
      size="small"
    >
      <!-- 项目路径 -->
      <n-form-item :label="t('aiCollab.projectPath')" path="projectPath">
        <n-input-group>
          <n-input
            v-model:value="formData.projectPath"
            :placeholder="t('task.cwdPlaceholder')"
            readonly
          />
          <n-button @click="handleSelectProjectPath">
            {{ t('task.browse') }}
          </n-button>
        </n-input-group>
      </n-form-item>

      <!-- Provider 选择 -->
      <n-form-item :label="t('aiCollab.providerType')" path="providerType">
        <n-select
          v-model:value="formData.providerType"
          :options="providerTypeOptions"
        />
      </n-form-item>

      <!-- 模型选择 -->
      <n-form-item :label="t('aiCollab.model')" path="model">
        <n-select
          v-model:value="formData.model"
          :options="modelOptions"
          filterable
          tag
        />
      </n-form-item>

      <!-- API Key (OpenCode 免费模式可选) -->
      <n-form-item 
        :label="t('aiCollab.apiKey')" 
        path="apiKey"
        v-if="formData.providerType !== 'opencode'"
      >
        <n-input
          v-model:value="formData.apiKey"
          type="password"
          show-password-on="click"
          :placeholder="t('aiCollab.apiKeyPlaceholder')"
        />
      </n-form-item>
      
      <!-- OpenCode 免费说明 -->
      <n-form-item v-if="formData.providerType === 'opencode'">
        <n-alert type="success" :show-icon="true">
          {{ t('aiCollab.opencodeHint') }}
        </n-alert>
      </n-form-item>

      <!-- Base URL (可选) -->
      <n-form-item :label="t('aiCollab.baseUrl')">
        <n-input
          v-model:value="formData.baseUrl"
          :placeholder="t('aiCollab.baseUrlPlaceholder')"
        />
      </n-form-item>

      <!-- 启用的工具 -->
      <n-form-item :label="t('aiCollab.enabledTools')">
        <n-checkbox-group v-model:value="formData.tools">
          <n-space>
            <n-checkbox value="read">Read</n-checkbox>
            <n-checkbox value="write">Write</n-checkbox>
            <n-checkbox value="edit">Edit</n-checkbox>
            <n-checkbox value="bash">Bash</n-checkbox>
            <n-checkbox value="glob">Glob</n-checkbox>
            <n-checkbox value="grep">Grep</n-checkbox>
          </n-space>
        </n-checkbox-group>
      </n-form-item>
    </n-form>

    <template #footer>
      <n-space justify="end" :size="8">
        <n-button size="small" @click="$emit('update:show', false)">
          {{ t('common.cancel') }}
        </n-button>
        <n-button type="primary" size="small" :loading="isCreating" @click="handleCreate">
          {{ t('aiCollab.create') }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NButton,
  NSpace,
  NSelect,
  NCheckbox,
  NCheckboxGroup,
  NAlert,
  useMessage,
  type FormInst,
  type FormRules,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { getAdapter } from '../../../adapters';
import { useTaskManagerStore } from '../../../stores/taskManager';
import { useTerminalStore } from '../../../stores/terminal';
import { useAICollabNativeStore } from '../../../stores/aiCollabNative';
import { getModelsForProvider } from '../../../services/ai/provider/models';
import type { ProviderType } from '../../../services/ai/types';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'created', sessionId: string): void;
}>();

const { t } = useI18n();
const message = useMessage();
const taskManager = useTaskManagerStore();
const terminalStore = useTerminalStore();
const nativeStore = useAICollabNativeStore();

const formRef = ref<FormInst | null>(null);
const isCreating = ref(false);

const formData = ref({
  projectPath: '',
  providerType: 'opencode' as ProviderType,
  model: 'gpt-5-nano',
  apiKey: '',
  baseUrl: '',
  tools: ['read', 'write', 'edit', 'bash', 'glob', 'grep'],
});

// 表单验证规则
const formRules = computed<FormRules>(() => ({
  projectPath: {
    required: true,
    message: t('aiCollab.projectPathRequired'),
    trigger: 'blur',
  },
  apiKey: {
    required: formData.value.providerType !== 'opencode',
    message: t('aiCollab.apiKeyRequired'),
    trigger: 'blur',
  },
  model: {
    required: true,
    message: t('aiCollab.modelRequired'),
    trigger: 'blur',
  },
}));

// Provider 类型选项
const providerTypeOptions = computed(() => [
  { label: 'OpenCode Zen (免费)', value: 'opencode' },
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Google (Gemini)', value: 'google' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'GLM (智谱)', value: 'glm' },
  { label: 'Kimi (Moonshot)', value: 'kimi' },
]);

// 模型选项
const modelOptions = computed(() => {
  const models = getModelsForProvider(formData.value.providerType);
  return models.map((m: { name: string; contextWindow: number; id: string }) => ({
    label: `${m.name} (${m.contextWindow.toLocaleString()} tokens)`,
    value: m.id,
  }));
});

// 选择项目路径
const handleSelectProjectPath = async () => {
  try {
    const adapter = await getAdapter();
    const result = await adapter.dialog.selectFolder({
      title: t('task.selectWorkingDirectory'),
    });
    
    if (result && typeof result === 'string') {
      formData.value.projectPath = result;
    }
  } catch (error) {
    console.error('[AICollabNativeCreateDialog] Failed to select folder:', error);
  }
};

// 创建会话
const handleCreate = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  isCreating.value = true;
  try {
    // 创建原生 AI 会话
    const session = await nativeStore.createSession({
      projectPath: formData.value.projectPath,
      provider: {
        type: formData.value.providerType,
        model: formData.value.model,
        apiKey: formData.value.apiKey,
        baseUrl: formData.value.baseUrl || undefined,
      },
      tools: formData.value.tools,
    });
    
    // 创建 Tab
    const projectName = formData.value.projectPath.split(/[/\\]/).pop() || 'AI Native';
    terminalStore.createAICollabNativeTab(session.id, `AI: ${projectName}`, formData.value.projectPath);
    
    emit('created', session.id);
    emit('update:show', false);
    message.success(t('aiCollab.createSuccess'));
  } catch (error) {
    message.error(t('aiCollab.createFailed', { error: String(error) }));
  } finally {
    isCreating.value = false;
  }
};

// 监听 Provider 变化，更新默认模型
watch(() => formData.value.providerType, (newType) => {
  const models = getModelsForProvider(newType);
  if (models.length > 0) {
    formData.value.model = models[0].id;
  }
});

// 监听显示状态，重置表单
watch(() => props.show, (show) => {
  if (show) {
    // 使用第一个文件夹作为默认项目路径
    if (taskManager.folders.length > 0) {
      formData.value.projectPath = taskManager.folders[0].path;
    } else {
      formData.value.projectPath = '';
    }
    // 默认使用 OpenCode 免费模式
    formData.value.providerType = 'opencode';
    formData.value.model = 'gpt-5-nano';
    formData.value.apiKey = '';
    formData.value.baseUrl = '';
    formData.value.tools = ['read', 'write', 'edit', 'bash', 'glob', 'grep'];
  }
});
</script>
