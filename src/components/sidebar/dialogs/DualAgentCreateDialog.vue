<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * Dialog for creating a new Dual Agent (Supervisor-Worker) session.
 -->

<template>
  <n-modal
    :show="show"
    preset="card"
    :title="t('aiCollab.createDualAgent')"
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

    <n-steps :current="currentStep" size="small" class="steps-container">
      <n-step :title="t('aiCollab.stepGoal')" />
      <n-step :title="t('aiCollab.stepProvider')" />
    </n-steps>
    
    <div class="step-content">
      <!-- Step 1: Task Goal -->
      <div v-show="currentStep === 1" class="goal-step">
        <n-form
          ref="goalFormRef"
          :model="goalForm"
          :rules="goalRules"
          label-placement="top"
          size="small"
        >
          <!-- Project Path -->
          <n-form-item :label="t('aiCollab.projectPath')" path="projectPath">
            <n-input-group>
              <n-input
                v-model:value="goalForm.projectPath"
                :placeholder="t('task.cwdPlaceholder')"
                readonly
              />
              <n-button @click="handleSelectProjectPath">
                {{ t('task.browse') }}
              </n-button>
            </n-input-group>
          </n-form-item>
          
          <!-- Task Objective -->
          <n-form-item :label="t('aiCollab.taskObjective')" path="objective">
            <n-input
              v-model:value="goalForm.objective"
              type="textarea"
              :placeholder="t('aiCollab.taskObjectivePlaceholder')"
              :autosize="{ minRows: 3, maxRows: 6 }"
            />
          </n-form-item>
          
          <!-- Acceptance Criteria -->
          <n-form-item :label="t('aiCollab.acceptanceCriteria')" path="criteria">
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
          
          <!-- Context (Optional) -->
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
      
      <!-- Step 2: Provider Configuration -->
      <div v-show="currentStep === 2" class="provider-step">
        <n-form label-placement="left" label-width="100" size="small">
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
          
          <!-- Worker Tools -->
          <n-form-item :label="t('aiCollab.workerTools')">
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
          
          <!-- Loop Configuration -->
          <n-form-item :label="t('aiCollab.maxRounds')">
            <n-input-number
              v-model:value="providerForm.maxRounds"
              :min="1"
              :max="50"
              :default-value="10"
            />
          </n-form-item>
        </n-form>
      </div>
    </div>

    <template #footer>
      <n-space justify="space-between">
        <n-button
          v-if="currentStep > 1"
          size="small"
          @click="currentStep--"
        >
          {{ t('common.previous') }}
        </n-button>
        <div v-else></div>
        
        <n-space :size="8">
          <n-button size="small" @click="$emit('update:show', false)">
            {{ t('common.cancel') }}
          </n-button>
          <n-button
            v-if="currentStep < 2"
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
            {{ t('aiCollab.startTask') }}
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
  NInputNumber,
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
import { useDualAgentStore } from '../../../stores/dualAgent';
import { useAuthStore } from '../../../stores/auth';
import { useAITaskLimit } from '../../../services/aiTaskLimitService';
import { getModelsForProvider } from '../../../services/ai/provider/models';
import type { ProviderType } from '../../../services/ai/types';
import { svgIcons } from '../../../utils/icons';

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
const dualAgentStore = useDualAgentStore();
const authStore = useAuthStore();
const { limitInfo } = useAITaskLimit();

const currentStep = ref(1);
const goalFormRef = ref<FormInst | null>(null);
const isCreating = ref(false);

// Handle login button click
const handleLogin = () => {
  authStore.openAuthPortal('/login');
};

// Goal form
const goalForm = ref({
  projectPath: '',
  objective: '',
  criteria: [''],
  context: '',
  constraints: '',
});

// Provider form
const providerForm = ref({
  type: 'opencode' as ProviderType,
  model: 'gpt-5-nano',
  apiKey: '',
  baseUrl: '',
  tools: ['read', 'write', 'edit', 'bash', 'glob', 'grep'],
  maxRounds: 10,
});

// Validation rules
const goalRules: FormRules = {
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
    validator: (_rule, value: string[]) => {
      const validCriteria = value.filter(c => c.trim());
      if (validCriteria.length === 0) {
        return new Error(t('aiCollab.criteriaRequired'));
      }
      return true;
    },
    trigger: 'blur',
  },
};

// Provider options
const providerTypeOptions = computed(() => [
  { label: 'OpenCode Zen (Free)', value: 'opencode' },
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Google (Gemini)', value: 'google' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'GLM', value: 'glm' },
  { label: 'Kimi (Moonshot)', value: 'kimi' },
  { label: t('settings.custom') + ' (OpenAI Compatible)', value: 'custom' },
]);

const modelOptions = computed(() => {
  const models = getModelsForProvider(providerForm.value.type);
  return models.map((m: { name: string; contextWindow: number; id: string }) => ({
    label: `${m.name} (${m.contextWindow.toLocaleString()} tokens)`,
    value: m.id,
  }));
});

// Methods
const handleSelectProjectPath = async () => {
  try {
    const adapter = await getAdapter();
    const result = await adapter.dialog.selectFolder({
      title: t('task.selectWorkingDirectory'),
    });
    
    if (result && typeof result === 'string') {
      goalForm.value.projectPath = result;
    }
  } catch (error) {
    console.error('[DualAgentCreateDialog] Failed to select folder:', error);
  }
};

const addCriterion = () => {
  goalForm.value.criteria.push('');
};

const removeCriterion = (index: number) => {
  goalForm.value.criteria.splice(index, 1);
};

const handleNextStep = async () => {
  if (currentStep.value === 1) {
    try {
      await goalFormRef.value?.validate();
      currentStep.value = 2;
    } catch {
      // Validation failed
    }
  }
};

const handleCreate = async () => {
  isCreating.value = true;
  
  try {
    // Build provider config
    const providerConfig = {
      type: providerForm.value.type,
      model: providerForm.value.model,
      apiKey: providerForm.value.apiKey,
      baseUrl: providerForm.value.baseUrl || undefined,
    };
    
    // Build goal
    const goal = {
      objective: goalForm.value.objective,
      acceptanceCriteria: goalForm.value.criteria.filter(c => c.trim()),
      context: goalForm.value.context || undefined,
      constraints: goalForm.value.constraints 
        ? goalForm.value.constraints.split('\n').filter(c => c.trim())
        : undefined,
    };
    
    // Create session
    const session = await dualAgentStore.createSession({
      projectPath: goalForm.value.projectPath,
      goal,
      supervisorProvider: providerConfig,
      workerProvider: providerConfig, // Use same provider for both
      workerTools: providerForm.value.tools,
      maxRounds: providerForm.value.maxRounds,
    });
    
    // Create terminal tab
    const projectName = goalForm.value.projectPath.split(/[/\\]/).pop() || 'AI';
    terminalStore.createDualAgentTab(
      session.id,
      `AI: ${projectName}`,
      goalForm.value.projectPath
    );
    
    // Start the session
    await dualAgentStore.startSession(session.id);
    
    emit('created', session.id);
    emit('update:show', false);
    message.success(t('aiCollab.sessionStarted'));
  } catch (error) {
    message.error(t('aiCollab.createFailed', { error: String(error) }));
  } finally {
    isCreating.value = false;
  }
};

// Reset form when dialog opens
watch(() => props.show, (show) => {
  if (show) {
    currentStep.value = 1;
    
    // Set default project path
    if (taskManager.folders.length > 0) {
      goalForm.value.projectPath = taskManager.folders[0].path;
    } else {
      goalForm.value.projectPath = '';
    }
    
    goalForm.value.objective = '';
    goalForm.value.criteria = [''];
    goalForm.value.context = '';
    goalForm.value.constraints = '';
    
    providerForm.value.type = 'opencode';
    providerForm.value.model = 'gpt-5-nano';
    providerForm.value.apiKey = '';
    providerForm.value.baseUrl = '';
    providerForm.value.tools = ['read', 'write', 'edit', 'bash', 'glob', 'grep'];
    providerForm.value.maxRounds = 10;
  }
});

// Update model when provider changes
watch(() => providerForm.value.type, (newType) => {
  const models = getModelsForProvider(newType);
  if (models.length > 0) {
    providerForm.value.model = models[0].id;
  }
});
</script>

<style scoped>
.steps-container {
  margin-bottom: 24px;
}

.step-content {
  min-height: 300px;
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
