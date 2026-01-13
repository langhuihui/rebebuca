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
    :title="t('aiCollab.editSession')"
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
      <n-tabs type="line" animated>
        <!-- 基本信息标签 -->
        <n-tab-pane name="basic" :tab="t('aiCollab.basicInfo')">
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

          <!-- 会话名称 -->
          <n-form-item :label="t('aiCollab.sessionName')" path="sessionName">
            <n-input
              v-model:value="formData.sessionName"
              :placeholder="t('aiCollab.sessionNamePlaceholder')"
            />
          </n-form-item>

          <!-- 任务分组 -->
          <n-form-item :label="t('task.group')">
            <n-select
              v-model:value="selectedGroupId"
              :options="groupOptionsWithNew"
            />
          </n-form-item>
          <n-form-item v-if="selectedGroupId === '__new__'" :label="t('task.newGroupName')">
            <n-input v-model:value="newGroupName" :placeholder="t('task.newGroupPlaceholder')" />
          </n-form-item>
        </n-tab-pane>

        <!-- 监工配置标签 -->
        <n-tab-pane name="supervisor" :tab="t('aiCollab.supervisorConfig')">
          <n-form-item :label="t('aiCollab.agentType')" path="supervisorType">
            <n-radio-group v-model:value="formData.supervisorType" size="small">
              <n-radio value="ai-tool">{{ t('aiCollab.agentTypeAITool') }}</n-radio>
              <n-radio value="custom-cli">{{ t('aiCollab.agentTypeCustomCLI') }}</n-radio>
            </n-radio-group>
          </n-form-item>

          <n-form-item v-if="formData.supervisorType === 'ai-tool'" :label="t('aiCollab.selectAITool')" path="supervisorAITool">
            <n-select
              v-model:value="formData.supervisorAITool"
              :options="aiToolOptions"
              :render-label="renderAIToolLabel"
            />
          </n-form-item>

          <n-form-item v-else :label="t('aiCollab.customCommand')" path="supervisorCommand">
            <n-input
              v-model:value="formData.supervisorCommand"
              :placeholder="t('task.commandPlaceholder')"
            />
          </n-form-item>
        </n-tab-pane>

        <!-- Worker 配置标签 -->
        <n-tab-pane name="worker" :tab="t('aiCollab.workerConfig')">
          <n-form-item :label="t('aiCollab.agentType')" path="workerType">
            <n-radio-group v-model:value="formData.workerType" size="small">
              <n-radio value="ai-tool">{{ t('aiCollab.agentTypeAITool') }}</n-radio>
              <n-radio value="custom-cli">{{ t('aiCollab.agentTypeCustomCLI') }}</n-radio>
            </n-radio-group>
          </n-form-item>

          <n-form-item v-if="formData.workerType === 'ai-tool'" :label="t('aiCollab.selectAITool')" path="workerAITool">
            <n-select
              v-model:value="formData.workerAITool"
              :options="aiToolOptions"
              :render-label="renderAIToolLabel"
            />
          </n-form-item>

          <n-form-item v-else :label="t('aiCollab.customCommand')" path="workerCommand">
            <n-input
              v-model:value="formData.workerCommand"
              :placeholder="t('task.commandPlaceholder')"
            />
          </n-form-item>
        </n-tab-pane>

        <!-- 高级设置标签 -->
        <n-tab-pane name="advanced" :tab="t('aiCollab.advancedSettings')">
          <!-- 高级设置 -->
          <n-form-item :label="t('aiCollab.autoDecisionCountdown')" path="decisionTimeout">
            <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
              <n-slider
                v-model:value="formData.decisionTimeout"
                :min="0"
                :max="30"
                :step="1"
                style="flex: 1;"
              />
              <span style="min-width: 40px; text-align: right; font-size: 12px;">{{ formData.decisionTimeout === 0 ? t('aiCollab.manual') : `${formData.decisionTimeout}s` }}</span>
            </div>
          </n-form-item>

          <!-- 环境变量 -->
          <n-form-item :label="t('aiCollab.envVars')" path="envVars">
            <n-input
              v-model:value="formData.envVars"
              type="textarea"
              :placeholder="t('aiCollab.envVarsPlaceholder')"
              :rows="6"
            />
          </n-form-item>
        </n-tab-pane>
      </n-tabs>
    </n-form>

    <template #footer>
      <n-space justify="end" :size="8">
        <n-button size="small" @click="$emit('update:show', false)">
          {{ t('aiCollab.cancel') }}
        </n-button>
        <n-button type="primary" size="small" :loading="isSaving" @click="handleSave">
          {{ t('task.save') }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, h, watch } from 'vue';
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NSlider,
  NButton,
  NSpace,
  NRadio,
  NRadioGroup,
  NSelect,
  NTabs,
  NTabPane,
  useMessage,
  type FormInst,
  type FormRules,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { getAdapter } from '../../../adapters';
import { useAIToolsStore, AI_TOOL_METADATA, type AIToolType } from '../../../stores/aiTools';
import type { Task } from '../../../providers/types';

const props = defineProps<{
  show: boolean;
  task: Task | null;
  groupId: string;
  groupOptions: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'update:groupId', groupId: string): void;
  (e: 'confirm', data: AICollabEditFormData, groupId: string, newGroupName: string): void;
}>();

export interface AICollabEditFormData {
  taskId: string;
  projectPath: string;
  sessionName: string;
  supervisorType: 'ai-tool' | 'custom-cli';
  supervisorAITool?: AIToolType;
  supervisorCommand?: string;
  workerType: 'ai-tool' | 'custom-cli';
  workerAITool?: AIToolType;
  workerCommand?: string;
  decisionTimeout: number;
  envVars: string;
  sessionId?: string;
}

const { t } = useI18n();
const message = useMessage();
const aiToolsStore = useAIToolsStore();

const formRef = ref<FormInst | null>(null);
const isSaving = ref(false);
const newGroupName = ref('');

// 分组选择
const selectedGroupId = computed({
  get: () => props.groupId,
  set: (value) => emit('update:groupId', value),
});

const groupOptionsWithNew = computed(() => [
  ...props.groupOptions,
  { label: t('task.createNewGroup'), value: '__new__' },
]);

const formData = ref<AICollabEditFormData>({
  taskId: '',
  projectPath: '',
  sessionName: '',
  supervisorType: 'ai-tool',
  supervisorAITool: 'claude-code',
  supervisorCommand: '',
  workerType: 'ai-tool',
  workerAITool: 'claude-code',
  workerCommand: '',
  decisionTimeout: 30,
  envVars: '',
  sessionId: '',
});

// 表单验证规则
const formRules: FormRules = {
  projectPath: {
    required: true,
    message: t('aiCollab.projectPathRequired'),
    trigger: 'blur',
  },
  sessionName: {
    required: true,
    message: t('aiCollab.sessionNameRequired'),
    trigger: 'blur',
  },
};

// AI 工具选项
const aiToolOptions = computed(() => {
  return Object.entries(AI_TOOL_METADATA).map(([key, meta]) => ({
    label: meta.name,
    value: key as AIToolType,
    logo: aiToolsStore.getToolLogoUrl(key as AIToolType),
  }));
});

// 渲染 AI 工具选项标签
const renderAIToolLabel = (option: { label: string; value: AIToolType; logo?: string }) => {
  const needsInvert = option.value && ['opencode', 'augment-cli', 'ampcode'].includes(option.value);
  return h('div', { style: 'display: flex; align-items: center; gap: 8px;' }, [
    option.logo
      ? h('img', {
          src: option.logo,
          class: needsInvert ? 'tool-logo-invert-dark' : '',
          style: 'width: 20px; height: 20px; border-radius: 4px; object-fit: contain;',
        })
      : null,
    h('span', option.label),
  ]);
};

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
    console.error('[AICollabEditDialog] Failed to select folder:', error);
  }
};

// 保存会话
const handleSave = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  // 验证配置
  if (formData.value.supervisorType === 'custom-cli' && !formData.value.supervisorCommand?.trim()) {
    message.error(t('aiCollab.commandRequired'));
    return;
  }
  if (formData.value.workerType === 'custom-cli' && !formData.value.workerCommand?.trim()) {
    message.error(t('aiCollab.commandRequired'));
    return;
  }

  isSaving.value = true;
  try {
    emit('confirm', { ...formData.value }, selectedGroupId.value, newGroupName.value);
    emit('update:show', false);
  } finally {
    isSaving.value = false;
  }
};

// 监听显示状态和任务变化，加载任务数据
watch([() => props.show, () => props.task], ([show, task]) => {
  if (show && task) {
    // 重置新分组名称
    newGroupName.value = '';
    
    // 从任务中加载数据
    const definition = task.definition || {};
    
    // 解析环境变量
    let envStr = '';
    if (task.env) {
      envStr = Object.entries(task.env)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    }
    
    formData.value = {
      taskId: task.id,
      projectPath: task.cwd || '',
      sessionName: task.name || '',
      supervisorType: definition.supervisorType || 'ai-tool',
      supervisorAITool: definition.supervisorAITool || 'claude-code',
      supervisorCommand: definition.supervisorCommand || '',
      workerType: definition.workerType || 'ai-tool',
      workerAITool: definition.workerAITool || 'claude-code',
      workerCommand: definition.workerCommand || '',
      decisionTimeout: definition.decisionTimeout ?? 30,
      envVars: envStr,
      sessionId: definition.sessionId || '',
    };
  }
}, { immediate: true });
</script>

<style scoped>
</style>
