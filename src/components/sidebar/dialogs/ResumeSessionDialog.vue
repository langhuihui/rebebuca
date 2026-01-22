<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * Dialog for resuming a previous orchestration session from boulder state.
 -->

<template>
  <n-modal
    v-model:show="showDialog"
    preset="card"
    :title="t('aiCollab.resumeSession')"
    style="width: 600px; max-width: 90vw;"
    :mask-closable="false"
    @update:show="$emit('update:show', $event)"
  >
    <div class="resume-dialog-content">
      <n-alert type="info" :show-icon="true" style="margin-bottom: 16px;">
        <template #header>
          {{ t('aiCollab.foundPreviousSession') }}
        </template>
        {{ t('aiCollab.resumeSessionDesc') }}
      </n-alert>

      <div v-if="boulderState" class="session-info">
        <div class="info-item">
          <span class="info-label">{{ t('aiCollab.taskGoal') }}:</span>
          <span class="info-value">{{ boulderState.goal?.objective || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('aiCollab.currentRound') }}:</span>
          <span class="info-value">{{ boulderState.progress?.current_round || 0 }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('aiCollab.currentAction') }}:</span>
          <span class="info-value">{{ boulderState.progress?.current_action || '-' }}</span>
        </div>
        <div v-if="boulderState.updated_at" class="info-item">
          <span class="info-label">{{ t('aiCollab.lastUpdated') }}:</span>
          <span class="info-value">{{ formatTime(boulderState.updated_at) }}</span>
        </div>
      </div>

      <div class="dialog-actions">
        <n-button @click="handleResume" type="primary" style="flex: 1;">
          {{ t('aiCollab.resume') }}
        </n-button>
        <n-button @click="handleStartNew" style="flex: 1;">
          {{ t('aiCollab.startNew') }}
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NModal, NAlert, NButton } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import type { BoulderStateInfo } from '../../../adapters/types';

const props = defineProps<{
  show: boolean;
  boulderState: BoulderStateInfo | null;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'resume'): void;
  (e: 'start-new'): void;
}>();

const { t } = useI18n();

const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

const handleResume = () => {
  emit('resume');
  showDialog.value = false;
};

const handleStartNew = () => {
  emit('start-new');
  showDialog.value = false;
};

const formatTime = (timeStr: string): string => {
  try {
    const date = new Date(timeStr);
    return date.toLocaleString();
  } catch {
    return timeStr;
  }
};
</script>

<style scoped>
.resume-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--n-color-embedded);
  border-radius: 8px;
}

.info-item {
  display: flex;
  gap: 8px;
}

.info-label {
  font-weight: 600;
  color: var(--n-text-color-2);
  min-width: 100px;
}

.info-value {
  color: var(--n-text-color);
  flex: 1;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}
</style>
