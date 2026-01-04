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
    :title="t('task.renameGroup')"
    :positive-text="t('common.save')"
    :negative-text="t('common.cancel')"
    style="width: 400px;"
    to="body"
    @positive-click="handleConfirm"
  >
    <n-form label-placement="left" label-width="auto">
      <n-form-item :label="t('task.groupName')">
        <n-input v-model:value="newName" :placeholder="t('task.groupNamePlaceholder')" />
      </n-form-item>
    </n-form>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { NModal, NForm, NFormItem, NInput } from 'naive-ui';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  show: boolean;
  groupId: string;
  groupName: string;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'confirm', groupId: string, newName: string): void;
}>();

const { t } = useI18n();

const newName = ref('');

const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

const handleConfirm = () => {
  if (!newName.value.trim()) {
    return false;
  }
  emit('confirm', props.groupId, newName.value.trim());
  return true;
};

// Initialize name when dialog opens
watch(() => props.groupName, (name) => {
  newName.value = name;
}, { immediate: true });
</script>
