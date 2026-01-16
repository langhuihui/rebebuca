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
    style="width: 640px; max-width: 90vw;"
    :mask-closable="false"
    @update:show="$emit('update:show', $event)"
  >
    <!-- Task Limit Warning -->
    <n-alert 
      v-if="!limitInfo.canCreateTask" 
      type="warning" 
      :show-icon="true"
      style="margin-bottom: 16px;"
    >
      <template #header>
        {{ t('aiCollab.taskLimitReached') }}
      </template>
      <template v-if="!limitInfo.isLoggedIn">
        {{ t('aiCollab.taskLimitAnonymousDesc', { current: limitInfo.currentCount, max: limitInfo.maxLimit }) }}
        <n-button text type="primary" @click="handleLogin" style="margin-left: 8px;">
          {{ t('user.login') }}
        </n-button>
      </template>
      <template v-else>
        {{ t('aiCollab.taskLimitDesc', { current: limitInfo.currentCount, max: limitInfo.maxLimit, plan: limitInfo.planType }) }}
      </template>
    </n-alert>

    <!-- Task Limit Info -->
    <n-alert 
      v-else-if="limitInfo.remainingSlots <= 3" 
      type="info" 
      :show-icon="true"
      style="margin-bottom: 16px;"
    >
      {{ t('aiCollab.taskSlotsRemaining', { remaining: limitInfo.remainingSlots, max: limitInfo.maxLimit }) }}
    </n-alert>

    <!-- Steps -->
    <n-steps :current="currentStep" size="small" class="steps-container">
      <n-step :title="t('aiCollab.stepBasic')" />
      <n-step :title="t('aiCollab.stepGoal')">
        <template #icon>
          <n-icon v-if="goalSkipped" color="#999">
            <component :is="svgIcons.chevronRight" />
          </n-icon>
        </template>
      </n-step>
      <n-step :title="t('aiCollab.stepProvider')" />
    </n-steps>
    
    <div class="step-content">
      <!-- Step 1: Basic Info -->
      <div v-show="currentStep === 1" class="basic-step">
        <n-form
          ref="basicFormRef"
          :model="basicForm"
          :rules="basicRules"
          label-placement="top"
          size="small"
        >
          <!-- Task Name -->
          <n-form-item :label="t('task.name')" path="taskName">
            <n-input
              v-model:value="basicForm.taskName"
              :placeholder="t('task.namePlaceholder')"
            />
          </n-form-item>

          <!-- Group Selection -->
          <n-form-item :label="t('task.group')" path="groupId">
            <n-select
              v-model:value="basicForm.groupId"
              :options="groupOptionsWithNew"
              :placeholder="t('task.selectGroup')"
            />
          </n-form-item>

          <!-- New Group Name -->
          <n-form-item v-if="basicForm.groupId === '__new__'" :label="t('task.newGroupName')" path="newGroupName">
            <n-input
              v-model:value="basicForm.newGroupName"
              :placeholder="t('task.newGroupNamePlaceholder')"
            />
          </n-form-item>

          <!-- Project Path -->
          <n-form-item :label="t('aiCollab.projectPath')" path="projectPath">
            <n-input-group>
              <n-input
                v-model:value="basicForm.projectPath"
                :placeholder="t('task.cwdPlaceholder')"
                readonly
              />
              <n-button @click="handleSelectProjectPath">
                {{ t('task.browse') }}
              </n-button>
            </n-input-group>
          </n-form-item>
        </n-form>
      </div>

      <!-- Step 2: Task Goal (Optional) -->
      <div v-show="currentStep === 2" class="goal-step">
        <n-alert type="info" :show-icon="true" style="margin-bottom: 16px;">
          {{ t('aiCollab.goalStepHint') }}
        </n-alert>
        
        <n-form
          ref="goalFormRef"
          :model="goalForm"
          label-placement="top"
          size="small"
        >
          <!-- Task Objective -->
          <n-form-item :label="t('aiCollab.taskObjective')">
            <n-input
              v-model:value="goalForm.objective"
              type="textarea"
              :placeholder="t('aiCollab.taskObjectivePlaceholder')"
              :autosize="{ minRows: 3, maxRows: 6 }"
            />
          </n-form-item>
          
          <!-- Acceptance Criteria -->
          <n-form-item :label="t('aiCollab.acceptanceCriteria')">
            <div class="criteria-list">
              <div
                v-for="(_criterion, index) in goalForm.criteria"
                :key="index"
                class="criterion-item"
              >
                <n-input
                  v-model:value="goalForm.criteria[index]"
                  :placeholder="`${t('aiCollab.criterion')} ${index + 1}`"
                />
                <n-button
                  v-if="goalForm.criteria.length > 1"
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
          
          <!-- Context & Constraints (Optional) -->
          <n-collapse>
            <n-collapse-item :title="t('aiCollab.advancedOptions')">
              <n-form-item :label="t('aiCollab.context')">
                <n-input
                  v-model:value="goalForm.context"
                  type="textarea"
                  :placeholder="t('aiCollab.contextPlaceholder')"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                />
              </n-form-item>
              
              <n-form-item :label="t('aiCollab.constraints')">
                <n-input
                  v-model:value="goalForm.constraints"
                  type="textarea"
                  :placeholder="t('aiCollab.constraintsPlaceholder')"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                />
              </n-form-item>
            </n-collapse-item>
          </n-collapse>
        </n-form>
      </div>

      <!-- Step 3: Provider Configuration -->
      <div v-show="currentStep === 3" class="provider-step">
        <n-form label-placement="left" label-width="120" size="small">
          <!-- Provider Type -->
          <n-form-item :label="t('aiCollab.providerType')">
            <n-select
              v-model:value="providerForm.type"
              :options="providerTypeOptions"
            />
          </n-form-item>

          <!-- Model -->
          <n-form-item :label="t('aiCollab.model')">
            <n-select
              v-model:value="providerForm.model"
              :options="modelOptions"
              filterable
              tag
            />
          </n-form-item>

          <!-- API Key -->
          <n-form-item 
            v-if="providerForm.type !== 'opencode'"
            :label="t('aiCollab.apiKey')"
          >
            <n-input
              v-model:value="providerForm.apiKey"
              type="password"
              show-password-on="click"
              :placeholder="t('aiCollab.apiKeyPlaceholder')"
            />
          </n-form-item>
          
          <!-- OpenCode Hint -->
          <n-form-item v-if="providerForm.type === 'opencode'">
            <n-alert type="success" :show-icon="true">
              {{ t('aiCollab.opencodeHint') }}
            </n-alert>
          </n-form-item>

          <!-- Base URL (Optional) -->
          <n-form-item :label="t('aiCollab.baseUrl')">
            <n-input
              v-model:value="providerForm.baseUrl"
              :placeholder="t('aiCollab.baseUrlPlaceholder')"
            />
          </n-form-item>

          <!-- Enabled Tools -->
          <n-form-item :label="t('aiCollab.enabledTools')">
            <n-checkbox-group v-model:value="providerForm.tools">
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
      </div>
    </div>

    <template #footer>
      <n-space justify="space-between">
        <n-space :size="8">
          <n-button
            v-if="currentStep > 1"
            size="small"
            @click="handlePrevStep"
          >
            {{ t('common.previous') }}
          </n-button>
        </n-space>
        
        <n-space :size="8">
          <n-button size="small" @click="$emit('update:show', false)">
            {{ t('common.cancel') }}
          </n-button>
          
          <!-- Skip button for step 2 -->
          <n-button
            v-if="currentStep === 2"
            size="small"
            @click="handleSkipGoal"
          >
            {{ t('aiCollab.skipStep') }}
          </n-button>
          
          <n-button
            v-if="currentStep < 3"
            type="primary"
            size="small"
            @click="handleNextStep"
          >
            {{ t('common.next') }}
          </n-button>
          <n-button
            v-else
            type="primary"
            size="small"
            :loading="isCreating"
            :disabled="!limitInfo.canCreateTask"
            @click="handleCreate"
          >
            {{ t('aiCollab.create') }}
          </n-button>
        </n-space>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  NModal,
  NSteps,
  NStep,
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
import { useTerminalStore } from '../../../stores/terminal';
import { useAICollabNativeStore } from '../../../stores/aiCollabNative';
import { useAuthStore } from '../../../stores/auth';
import { useAITaskLimit } from '../../../services/aiTaskLimitService';
import { getModelsForProvider } from '../../../services/ai/provider/models';
import { TaskType } from '../../../providers/types';
import type { ProviderType } from '../../../services/ai/types';
import { svgIcons } from '../../../utils/icons';

const props = defineProps<{
  show: boolean;
  groupOptions: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'created', sessionId: string, taskId: string): void;
}>();

const { t } = useI18n();
const message = useMessage();
const taskManager = useTaskManagerStore();
const terminalStore = useTerminalStore();
const nativeStore = useAICollabNativeStore();
const authStore = useAuthStore();
const { limitInfo } = useAITaskLimit();

const currentStep = ref(1);
const basicFormRef = ref<FormInst | null>(null);
const goalFormRef = ref<FormInst | null>(null);
const isCreating = ref(false);
const goalSkipped = ref(false);

// Handle login button click
const handleLogin = () => {
  authStore.openAuthPortal('/login');
};

// Group options with "Create New" option
const groupOptionsWithNew = computed(() => [
  ...props.groupOptions,
  { label: t('task.createNewGroup'), value: '__new__' },
]);

// Basic form (Step 1)
const basicForm = ref({
  taskName: '',
  groupId: '',
  newGroupName: '',
  projectPath: '',
});

// Goal form (Step 2 - Optional)
const goalForm = ref({
  objective: '',
  criteria: [''],
  context: '',
  constraints: '',
});

// Provider form (Step 3)
const providerForm = ref({
  type: 'opencode' as ProviderType,
  model: 'gpt-5-nano',
  apiKey: '',
  baseUrl: '',
  tools: ['read', 'write', 'edit', 'bash', 'glob', 'grep'],
});

// Validation rules for basic form
const basicRules = computed<FormRules>(() => ({
  taskName: {
    required: true,
    message: t('task.nameRequired'),
    trigger: 'blur',
  },
  groupId: {
    required: true,
    message: t('task.groupRequired'),
    trigger: 'blur',
  },
  newGroupName: {
    required: basicForm.value.groupId === '__new__',
    message: t('task.newGroupNameRequired'),
    trigger: 'blur',
  },
  projectPath: {
    required: true,
    message: t('aiCollab.projectPathRequired'),
    trigger: 'blur',
  },
}));

// Provider type options
const providerTypeOptions = computed(() => [
  { label: 'OpenCode Zen (免费)', value: 'opencode' },
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Google (Gemini)', value: 'google' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'GLM (智谱)', value: 'glm' },
  { label: 'Kimi (Moonshot)', value: 'kimi' },
  { label: t('settings.custom') + ' (OpenAI 兼容)', value: 'custom' },
]);

// Model options
const modelOptions = computed(() => {
  const models = getModelsForProvider(providerForm.value.type);
  return models.map((m: { name: string; contextWindow: number; id: string }) => ({
    label: `${m.name} (${m.contextWindow.toLocaleString()} tokens)`,
    value: m.id,
  }));
});

// Check if goal is configured
const isGoalConfigured = computed(() => {
  return goalForm.value.objective.trim() !== '' || 
         goalForm.value.criteria.some(c => c.trim() !== '');
});

// Select project path
const handleSelectProjectPath = async () => {
  try {
    const adapter = await getAdapter();
    const result = await adapter.dialog.selectFolder({
      title: t('task.selectWorkingDirectory'),
    });
    
    if (result && typeof result === 'string') {
      basicForm.value.projectPath = result;
    }
  } catch (error) {
    console.error('[AICollabNativeCreateDialog] Failed to select folder:', error);
  }
};

// Criteria management
const addCriterion = () => {
  goalForm.value.criteria.push('');
};

const removeCriterion = (index: number) => {
  goalForm.value.criteria.splice(index, 1);
};

// Navigation
const handlePrevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--;
    if (currentStep.value === 2) {
      goalSkipped.value = false;
    }
  }
};

const handleNextStep = async () => {
  if (currentStep.value === 1) {
    try {
      await basicFormRef.value?.validate();
      currentStep.value = 2;
      goalSkipped.value = false;
    } catch {
      // Validation failed
    }
  } else if (currentStep.value === 2) {
    currentStep.value = 3;
  }
};

const handleSkipGoal = () => {
  goalSkipped.value = true;
  currentStep.value = 3;
};

// Create task
const handleCreate = async () => {
  isCreating.value = true;
  
  try {
    // Create AI session
    const session = await nativeStore.createSession({
      projectPath: basicForm.value.projectPath,
      provider: {
        type: providerForm.value.type,
        model: providerForm.value.model,
        apiKey: providerForm.value.apiKey,
        baseUrl: providerForm.value.baseUrl || undefined,
      },
      tools: providerForm.value.tools,
    });
    
    // Determine target group
    let targetGroupId = basicForm.value.groupId;
    if (basicForm.value.groupId === '__new__' && basicForm.value.newGroupName.trim()) {
      const newGroup = await taskManager.createUserGroup(basicForm.value.newGroupName.trim());
      targetGroupId = newGroup.id;
    }
    
    // Build goal data if configured
    const goalData = isGoalConfigured.value ? {
      objective: goalForm.value.objective,
      acceptanceCriteria: goalForm.value.criteria.filter(c => c.trim()),
      context: goalForm.value.context || undefined,
      constraints: goalForm.value.constraints 
        ? goalForm.value.constraints.split('\n').filter(c => c.trim())
        : undefined,
    } : undefined;
    
    // Create task and add to group
    const taskId = `ai-collab-${session.id}`;
    const taskData = {
      id: taskId,
      name: basicForm.value.taskName,
      type: TaskType.AI_COLLAB,
      cwd: basicForm.value.projectPath,
      definition: {
        sessionId: session.id,
        provider: {
          type: providerForm.value.type,
          model: providerForm.value.model,
          apiKey: providerForm.value.apiKey,
          baseUrl: providerForm.value.baseUrl || undefined,
        },
        tools: providerForm.value.tools,
        goal: goalData,
        isConfigured: isGoalConfigured.value && !goalSkipped.value,
      },
    };
    
    await taskManager.addTaskToGroup(targetGroupId, taskData);
    
    // Create terminal tab
    terminalStore.createAICollabNativeTab(session.id, basicForm.value.taskName, basicForm.value.projectPath);
    
    emit('created', session.id, taskId);
    emit('update:show', false);
    message.success(t('aiCollab.createSuccess'));
  } catch (error) {
    message.error(t('aiCollab.createFailed', { error: String(error) }));
  } finally {
    isCreating.value = false;
  }
};

// Watch provider type changes
watch(() => providerForm.value.type, (newType) => {
  const models = getModelsForProvider(newType);
  if (models.length > 0) {
    providerForm.value.model = models[0].id;
  }
});

// Reset form when dialog opens
watch(() => props.show, (show) => {
  if (show) {
    currentStep.value = 1;
    goalSkipped.value = false;
    
    // Reset basic form
    basicForm.value.taskName = '';
    basicForm.value.newGroupName = '';
    if (props.groupOptions.length > 0) {
      basicForm.value.groupId = props.groupOptions[0].value;
    } else {
      basicForm.value.groupId = '';
    }
    if (taskManager.folders.length > 0) {
      basicForm.value.projectPath = taskManager.folders[0].path;
    } else {
      basicForm.value.projectPath = '';
    }
    
    // Reset goal form
    goalForm.value.objective = '';
    goalForm.value.criteria = [''];
    goalForm.value.context = '';
    goalForm.value.constraints = '';
    
    // Reset provider form
    providerForm.value.type = 'opencode';
    providerForm.value.model = 'gpt-5-nano';
    providerForm.value.apiKey = '';
    providerForm.value.baseUrl = '';
    providerForm.value.tools = ['read', 'write', 'edit', 'bash', 'glob', 'grep'];
  }
});
</script>

<style scoped>
.steps-container {
  margin-bottom: 24px;
}

.step-content {
  min-height: 280px;
}

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
