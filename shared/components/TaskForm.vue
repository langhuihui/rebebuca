<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * Shared TaskForm component for both main app and website demo
 -->

<template>
  <n-form ref="formRef" :model="formData" :rules="formRules" label-placement="left" label-width="auto">
    <n-form-item :label="labels.name" path="name">
      <n-input v-model:value="formData.name" :placeholder="placeholders.name" />
    </n-form-item>
    <n-form-item :label="labels.command" path="command">
      <n-input 
        v-model:value="formData.command" 
        type="textarea"
        :placeholder="placeholders.command" 
        :autosize="{ minRows: 1, maxRows: 5 }"
        class="command-textarea"
      />
    </n-form-item>
    <n-form-item :label="labels.cwd">
      <n-input-group>
        <n-input v-model:value="formData.cwd" :placeholder="placeholders.cwd" />
        <n-button v-if="showFolderButton" @click="$emit('selectCwd')">
          <template #icon>
            <slot name="folder-icon">
              <span>📁</span>
            </slot>
          </template>
        </n-button>
      </n-input-group>
    </n-form-item>
    <n-form-item v-if="showEnv" :label="labels.env">
      <n-input 
        v-model:value="formData.envStr" 
        type="textarea"
        :placeholder="placeholders.env"
        :autosize="{ minRows: 2, maxRows: 10 }"
        class="env-textarea"
      />
    </n-form-item>
    <n-form-item :label="labels.useSystemTerminal">
      <n-switch v-model:value="formData.useSystemTerminal" />
    </n-form-item>
    <n-form-item v-if="showGroup" :label="labels.group">
      <n-select
        v-model:value="formData.group"
        :options="groupOptions"
      />
    </n-form-item>
    <slot name="extra-fields"></slot>
  </n-form>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import {
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NButton,
  NSwitch,
  NSelect,
  type FormRules,
} from 'naive-ui';

export interface TaskFormData {
  id?: string;
  name: string;
  command: string;
  cwd: string;
  envStr: string;
  group: string;
  useSystemTerminal: boolean;
}

export interface TaskFormLabels {
  name: string;
  command: string;
  cwd: string;
  env: string;
  useSystemTerminal: string;
  group: string;
}

export interface TaskFormPlaceholders {
  name: string;
  command: string;
  cwd: string;
  env: string;
}

interface Props {
  modelValue: TaskFormData;
  labels?: Partial<TaskFormLabels>;
  placeholders?: Partial<TaskFormPlaceholders>;
  groupOptions?: Array<{ label: string; value: string }>;
  showGroup?: boolean;
  showEnv?: boolean;
  showFolderButton?: boolean;
  nameRequired?: string;
  commandRequired?: string;
}

const props = withDefaults(defineProps<Props>(), {
  labels: () => ({}),
  placeholders: () => ({}),
  groupOptions: () => [
    { label: 'None', value: 'none' },
    { label: 'Build', value: 'build' },
    { label: 'Test', value: 'test' },
    { label: 'Clean', value: 'clean' },
  ],
  showGroup: true,
  showEnv: true,
  showFolderButton: true,
  nameRequired: 'Name is required',
  commandRequired: 'Command is required',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: TaskFormData): void;
  (e: 'selectCwd'): void;
}>();

const formRef = ref<any>(null);

// Default labels
const defaultLabels: TaskFormLabels = {
  name: 'Name',
  command: 'Command',
  cwd: 'Working Directory',
  env: 'Environment Variables',
  useSystemTerminal: 'Use System Terminal',
  group: 'Group',
};

// Default placeholders
const defaultPlaceholders: TaskFormPlaceholders = {
  name: 'Enter task name',
  command: 'e.g., npm run dev --port 3000',
  cwd: 'Enter working directory path',
  env: 'One variable per line, format: KEY=VALUE\n# Lines starting with # are comments',
};

// Merged labels and placeholders
const labels = computed(() => ({ ...defaultLabels, ...props.labels }));
const placeholders = computed(() => ({ ...defaultPlaceholders, ...props.placeholders }));

// Local form data
const formData = reactive<TaskFormData>({
  id: props.modelValue.id || '',
  name: props.modelValue.name || '',
  command: props.modelValue.command || '',
  cwd: props.modelValue.cwd || '',
  envStr: props.modelValue.envStr || '',
  group: props.modelValue.group || 'none',
  useSystemTerminal: props.modelValue.useSystemTerminal || false,
});

// Watch for external changes
watch(() => props.modelValue, (newVal) => {
  formData.id = newVal.id || '';
  formData.name = newVal.name || '';
  formData.command = newVal.command || '';
  formData.cwd = newVal.cwd || '';
  formData.envStr = newVal.envStr || '';
  formData.group = newVal.group || 'none';
  formData.useSystemTerminal = newVal.useSystemTerminal || false;
}, { deep: true });

// Watch for internal changes and emit
watch(formData, (newVal) => {
  emit('update:modelValue', { ...newVal });
}, { deep: true });

// Form rules
const formRules: FormRules = {
  name: [{ required: true, message: props.nameRequired }],
  command: [{ required: true, message: props.commandRequired }],
};

// Expose validate method
const validate = async () => {
  return await formRef.value?.validate();
};

defineExpose({
  validate,
  formRef,
});
</script>

<style scoped>
.command-textarea :deep(.n-input__textarea-el) {
  font-family: monospace;
}

.env-textarea :deep(.n-input__textarea-el) {
  font-family: monospace;
  font-size: 12px;
}
</style>
