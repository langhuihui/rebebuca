<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 -->

<template>
  <n-modal
    :show="show"
    preset="card"
    :title="t('aiCollab.editSession') || 'Edit AI Task'"
    style="width: 640px; max-width: 90vw;"
    :mask-closable="false"
    @update:show="$emit('update:show', $event)"
  >
    <n-tabs v-model:value="activeTab" type="line" size="small">
      <n-tab-pane name="goal" :tab="t('aiCollab.stepGoal')">
        <n-form
          ref="goalFormRef"
          :model="formData"
          :rules="goalRules"
          label-placement="top"
          size="small"
        >
          <!-- 任务名称 -->
          <n-form-item :label="t('task.name')" path="name">
            <n-input v-model:value="formData.name" :placeholder="t('task.namePlaceholder')" />
          </n-form-item>

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

          <!-- 任务目标 -->
          <n-form-item :label="t('aiCollab.taskObjective')" path="objective">
            <n-input
              v-model:value="formData.objective"
              type="textarea"
              :placeholder="t('aiCollab.taskObjectivePlaceholder')"
              :autosize="{ minRows: 3, maxRows: 6 }"
            />
          </n-form-item>

          <!-- 验收标准 -->
          <n-form-item :label="t('aiCollab.acceptanceCriteria')" path="criteria">
            <div class="criteria-list">
              <div
                v-for="(_criterion, index) in formData.criteria"
                :key="index"
                class="criterion-item"
              >
                <n-input
                  v-model:value="formData.criteria[index]"
                  :placeholder="`${t('aiCollab.criterion')} ${index + 1}`"
                />
                <n-button
                  v-if="formData.criteria.length > 1"
                  quaternary
                  size="small"
                  @click="removeCriterion(index)"
                >
                  <template #icon>
                    <n-icon><component :is="svgIcons.close" /></n-icon>
                  </template>
                </n-button>
              </div>
              <n-button dashed block size="small" @click="addCriterion">
                {{ t('aiCollab.addCriterion') }}
              </n-button>
            </div>
          </n-form-item>

          <!-- 上下文（可选） -->
          <n-collapse>
            <n-collapse-item :title="t('aiCollab.advancedOptions')">
              <n-form-item :label="t('aiCollab.context')">
                <n-input
                  v-model:value="formData.context"
                  type="textarea"
                  :placeholder="t('aiCollab.contextPlaceholder')"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                />
              </n-form-item>

              <n-form-item :label="t('aiCollab.constraints')">
                <n-input
                  v-model:value="formData.constraints"
                  type="textarea"
                  :placeholder="t('aiCollab.constraintsPlaceholder')"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                />
              </n-form-item>
            </n-collapse-item>
          </n-collapse>
        </n-form>
      </n-tab-pane>

      <n-tab-pane name="provider" :tab="t('aiCollab.stepProvider')">
        <n-form
          ref="providerFormRef"
          :model="formData"
          label-placement="left"
          label-width="100"
          size="small"
        >
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
      </n-tab-pane>
    </n-tabs>

    <template #footer>
      <n-space justify="end" :size="8">
        <n-button size="small" @click="$emit('update:show', false)">
          {{ t('common.cancel') }}
        </n-button>
        <n-button type="primary" size="small" :loading="isSaving" @click="handleSave">
          {{ t('common.save') }}
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
  NTabs,
  NTabPane,
  NCollapse,
  NCollapseItem,
  NIcon,
  useMessage,
  type FormInst,
  type FormRules,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { getAdapter } from '../../../adapters';
import { useTaskManagerStore } from '../../../stores/taskManager';
import { getModelsForProvider } from '../../../services/ai/provider/models';
import type { ProviderType } from '../../../services/ai/types';
import type { Task } from '../../../providers/types';
import { TaskType } from '../../../providers/types';
import { svgIcons } from '../../../utils/icons';

const props = defineProps<{
  show: boolean;
  task?: Task | null;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'save', taskData: any): void;
}>();

const { t } = useI18n();
const message = useMessage();
const taskManager = useTaskManagerStore();

const goalFormRef = ref<FormInst | null>(null);
const providerFormRef = ref<FormInst | null>(null);
const isSaving = ref(false);
const activeTab = ref('goal');

const formData = ref({
  name: '',
  projectPath: '',
  objective: '',
  criteria: [''],
  context: '',
  constraints: '',
  providerType: 'opencode' as ProviderType,
  model: 'gpt-5-nano',
  apiKey: '',
  baseUrl: '',
  tools: ['read', 'write', 'edit', 'bash', 'glob', 'grep'],
});

// 目标表单验证规则
const goalRules = computed<FormRules>(() => ({
  name: {
    required: true,
    message: t('task.nameRequired'),
    trigger: 'blur',
  },
  projectPath: {
    required: true,
    message: t('aiCollab.projectPathRequired'),
    trigger: 'blur',
  },
  objective: {
    required: true,
    message: t('aiCollab.objectiveRequired'),
    trigger: 'blur',
  },
  criteria: {
    required: true,
    validator: (_rule: any, value: string[]) => {
      const validCriteria = value.filter(c => c.trim());
      if (validCriteria.length === 0) {
        return new Error(t('aiCollab.criteriaRequired'));
      }
      return true;
    },
    trigger: 'blur',
  },
}));

// 添加验收标准
const addCriterion = () => {
  formData.value.criteria.push('');
};

// 删除验收标准
const removeCriterion = (index: number) => {
  formData.value.criteria.splice(index, 1);
};

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
    console.error('[AICollabTaskEditDialog] Failed to select folder:', error);
  }
};

// 保存任务
const handleSave = async () => {
  try {
    await goalFormRef.value?.validate();
  } catch {
    activeTab.value = 'goal';
    return;
  }

  isSaving.value = true;
  try {
    // 构造任务数据
    const taskData: any = {
      name: formData.value.name,
      cwd: formData.value.projectPath,
      type: TaskType.AI_COLLAB,
      definition: {
        goal: {
          objective: formData.value.objective,
          acceptanceCriteria: formData.value.criteria.filter(c => c.trim()),
          context: formData.value.context || undefined,
          constraints: formData.value.constraints
            ? formData.value.constraints.split('\n').filter(c => c.trim())
            : undefined,
        },
        provider: {
          type: formData.value.providerType,
          model: formData.value.model,
          apiKey: formData.value.apiKey,
          baseUrl: formData.value.baseUrl || undefined,
        },
        tools: formData.value.tools,
      }
    };
    
    emit('save', taskData);
    message.success(t('common.saveSuccess'));
    emit('update:show', false);
  } catch (error) {
    message.error(t('common.saveFailed', { error: String(error) }));
  } finally {
    isSaving.value = false;
  }
};

// 监听 Provider 变化，更新默认模型
// 只在非初始化时更新，避免覆盖加载的数据
watch(() => formData.value.providerType, (newType, oldType) => {
  if (oldType && newType !== oldType) {
    const models = getModelsForProvider(newType);
    if (models.length > 0) {
        // 如果当前模型不在新Provider的列表里，才切换默认
        const currentModelValid = models.some((m: any) => m.id === formData.value.model);
        if (!currentModelValid) {
            formData.value.model = models[0].id;
        }
    }
  }
});

// 监听显示状态，初始化表单
watch(() => props.show, (show) => {
  if (show && props.task) {
    // 加载任务数据
    const def = props.task.definition || {};
    const provider = def.provider || {};
    const goal = def.goal || {};
    
    formData.value.name = props.task.name;
    formData.value.projectPath = props.task.cwd || '';
    formData.value.objective = goal.objective || '';
    formData.value.criteria = goal.acceptanceCriteria?.length ? [...goal.acceptanceCriteria] : [''];
    formData.value.context = goal.context || '';
    formData.value.constraints = Array.isArray(goal.constraints) ? goal.constraints.join('\n') : (goal.constraints || '');
    formData.value.providerType = provider.type || 'opencode';
    formData.value.model = provider.model || 'gpt-5-nano';
    formData.value.apiKey = provider.apiKey || '';
    formData.value.baseUrl = provider.baseUrl || '';
    formData.value.tools = def.tools || ['read', 'write', 'edit', 'bash', 'glob', 'grep'];
    activeTab.value = 'goal';
  } else if (show) {
    // 新建模式
    formData.value.name = '';
    if (taskManager.folders.length > 0) {
      formData.value.projectPath = taskManager.folders[0].path;
    } else {
      formData.value.projectPath = '';
    }
    formData.value.objective = '';
    formData.value.criteria = [''];
    formData.value.context = '';
    formData.value.constraints = '';
    formData.value.providerType = 'opencode';
    formData.value.model = 'gpt-5-nano';
    formData.value.apiKey = '';
    formData.value.baseUrl = '';
    formData.value.tools = ['read', 'write', 'edit', 'bash', 'glob', 'grep'];
    activeTab.value = 'goal';
  }
});
</script>

<style scoped>
.criteria-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.criterion-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.criterion-item .n-input {
  flex: 1;
}
</style>
