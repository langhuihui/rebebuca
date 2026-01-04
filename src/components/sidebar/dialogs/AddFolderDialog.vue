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
    :title="t('task.addFolder')"
    :positive-text="formData.isImportMode ? t('task.scanTasks') : t('common.confirm')"
    :negative-text="t('common.cancel')"
    style="width: 520px;"
    :positive-button-props="{ disabled: !formData.sourceFolder }"
    to="body"
    @positive-click="handleConfirm"
  >
    <n-form label-placement="top">
      <!-- Folder selection -->
      <n-form-item :label="t('task.selectFolder')">
        <n-input-group>
          <n-input 
            v-model:value="formData.sourceFolder" 
            :placeholder="t('task.selectSourceFolder')"
            clearable
          />
          <n-button @click="handleSelectFolder">{{ t('task.browse') }}</n-button>
        </n-input-group>
      </n-form-item>
      
      <!-- Mode switch -->
      <n-form-item :label="t('task.addFolderMode')">
        <n-radio-group v-model:value="formData.isImportMode">
          <n-space vertical>
            <n-radio :value="false">
              <div class="mode-option">
                <span class="mode-title">{{ t('task.modeOpen') }}</span>
                <span class="mode-desc">{{ t('task.modeOpenDesc') }}</span>
              </div>
            </n-radio>
            <n-radio :value="true">
              <div class="mode-option">
                <span class="mode-title">{{ t('task.modeImport') }}</span>
                <span class="mode-desc">{{ t('task.modeImportDesc') }}</span>
              </div>
            </n-radio>
          </n-space>
        </n-radio-group>
      </n-form-item>
      
      <!-- Import options (only shown in import mode) -->
      <template v-if="formData.isImportMode">
        <n-form-item :label="t('task.targetGroup')">
          <n-select
            v-model:value="formData.targetGroupId"
            :options="groupOptions"
          />
        </n-form-item>
        <n-form-item v-if="formData.targetGroupId === '__new__'" :label="t('task.newGroupName')">
          <n-input v-model:value="formData.newGroupName" :placeholder="t('task.newGroupPlaceholder')" />
        </n-form-item>
      </template>
    </n-form>
  </n-modal>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from 'vue';
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NButton,
  NRadio,
  NRadioGroup,
  NSelect,
  NSpace,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { getAdapter } from '../../../adapters';

export interface AddFolderFormData {
  sourceFolder: string;
  isImportMode: boolean;
  targetGroupId: string;
  newGroupName: string;
}

const props = defineProps<{
  show: boolean;
  groupOptions: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'confirm', data: AddFolderFormData): void;
}>();

const { t } = useI18n();

const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

const formData = reactive<AddFolderFormData>({
  sourceFolder: '',
  isImportMode: false,
  targetGroupId: 'default',
  newGroupName: '',
});

const groupOptions = computed(() => [
  ...props.groupOptions,
  { label: t('task.createNewGroup'), value: '__new__' },
]);

const handleSelectFolder = async () => {
  try {
    const adapter = await getAdapter();
    const selected = await adapter.dialog.selectFolder({
      title: t('task.selectFolder'),
    });
    
    if (selected) {
      formData.sourceFolder = selected;
    }
  } catch (error) {
    console.error('[AddFolderDialog] Failed to select folder:', error);
  }
};

const handleConfirm = () => {
  if (!formData.sourceFolder) {
    return false;
  }
  emit('confirm', { ...formData });
  return !formData.isImportMode; // Auto-close only in open mode
};

// Reset form when dialog opens
watch(showDialog, (show) => {
  if (show) {
    formData.sourceFolder = '';
    formData.isImportMode = false;
    formData.targetGroupId = 'default';
    formData.newGroupName = '';
  }
});
</script>

<style scoped>
.mode-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mode-title {
  font-weight: 500;
  font-size: 14px;
}

.mode-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.4;
}

/* Light theme */
:global(.n-config-provider--light) .mode-desc {
  color: rgba(0, 0, 0, 0.45);
}
</style>
