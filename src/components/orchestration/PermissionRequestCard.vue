<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * Permission Request Card - Enhanced permission request UI with code preview.
 * Features:
 * - Prominent warning display
 * - Code/command preview
 * - Clear action buttons
 * - Support for grouped permissions
 -->

<template>
  <div class="permission-request-card" :class="`type-${request.type}`">
    <!-- Header -->
    <div class="permission-header">
      <div class="header-icon">
        <n-icon size="20">
          <component :is="getTypeIcon()" />
        </n-icon>
      </div>
      <div class="header-content">
        <div class="header-title">{{ t('aiCollab.permissionRequired') }}</div>
        <div class="header-type">{{ getTypeText() }}</div>
      </div>
    </div>
    
    <!-- Content Preview -->
    <div class="permission-content">
      <!-- File Operations -->
      <div v-if="request.type === 'read' || request.type === 'write' || request.type === 'edit'" class="file-preview">
        <div class="preview-label">
          <n-icon size="14"><component :is="svgIcons.file" /></n-icon>
          <span>{{ request.type === 'read' ? 'Read from' : request.type === 'write' ? 'Write to' : 'Edit' }}</span>
        </div>
        <div class="preview-path">
          <code>{{ request.path }}</code>
        </div>
        
        <!-- Glob Patterns -->
        <div v-if="request.patterns && request.patterns.length > 0" class="patterns-list">
          <div class="patterns-label">Patterns:</div>
          <div class="patterns-items">
            <code v-for="pattern in request.patterns" :key="pattern">{{ pattern }}</code>
          </div>
        </div>
      </div>
      
      <!-- Bash Command -->
      <div v-else-if="request.type === 'bash'" class="command-preview">
        <div class="preview-label">
          <n-icon size="14"><component :is="svgIcons.terminal" /></n-icon>
          <span>Execute command</span>
        </div>
        <div class="command-box">
          <code class="command-text">$ {{ request.command }}</code>
          <n-button 
            size="tiny" 
            quaternary 
            class="copy-button"
            @click="copyCommand"
          >
            <template #icon>
              <n-icon size="12"><component :is="svgIcons.copy" /></n-icon>
            </template>
          </n-button>
        </div>
        
        <!-- Working Directory -->
        <div v-if="request.cwd" class="cwd-info">
          <span class="cwd-label">in</span>
          <code class="cwd-path">{{ truncatePath(request.cwd) }}</code>
        </div>
      </div>
      
      <!-- Description -->
      <div v-if="request.description" class="description">
        {{ request.description }}
      </div>
    </div>
    
    <!-- Actions -->
    <div class="permission-actions">
      <n-button 
        size="small" 
        @click="$emit('deny', request.id!)"
      >
        {{ t('common.deny') }}
      </n-button>
      <n-button 
        size="small" 
        type="info"
        @click="$emit('always', request.id!)"
      >
        {{ t('aiCollab.alwaysAllow') }}
      </n-button>
      <n-button 
        size="small" 
        type="primary"
        @click="$emit('allow', request.id!)"
      >
        {{ t('common.allow') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NIcon, NButton, useMessage } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import type { PermissionRequest } from '../../services/ai/types';
import { svgIcons } from '../../utils/icons';

const props = defineProps<{
  request: PermissionRequest;
}>();

defineEmits<{
  (e: 'allow', requestId: string): void;
  (e: 'deny', requestId: string): void;
  (e: 'always', requestId: string): void;
}>();

const { t } = useI18n();
const message = useMessage();

// Icon based on type
const getTypeIcon = () => {
  switch (props.request.type) {
    case 'read': return svgIcons.eye;
    case 'write': return svgIcons.edit;
    case 'edit': return svgIcons.edit;
    case 'bash': return svgIcons.terminal;
    default: return svgIcons.warning;
  }
};

// Type text
const getTypeText = () => {
  switch (props.request.type) {
    case 'read': return 'File Read';
    case 'write': return 'File Write';
    case 'edit': return 'File Edit';
    case 'bash': return 'Command Execution';
    default: return 'Permission Request';
  }
};

// Copy command
const copyCommand = async () => {
  if (props.request.command) {
    await navigator.clipboard.writeText(props.request.command);
    message.success('Command copied');
  }
};

// Truncate path
const truncatePath = (path: string): string => {
  if (path.length <= 50) return path;
  const parts = path.split('/');
  if (parts.length <= 3) return path;
  return `.../${parts.slice(-3).join('/')}`;
};
</script>

<style scoped>
.permission-request-card {
  background: var(--n-color);
  border: 1px solid rgba(250, 173, 20, 0.3);
  border-radius: 12px;
  overflow: hidden;
}

.permission-request-card.type-bash {
  border-color: rgba(255, 77, 79, 0.3);
}

.permission-request-card.type-write,
.permission-request-card.type-edit {
  border-color: rgba(24, 144, 255, 0.3);
}

/* Header */
.permission-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(250, 173, 20, 0.1);
}

.type-bash .permission-header {
  background: rgba(255, 77, 79, 0.1);
}

.type-write .permission-header,
.type-edit .permission-header {
  background: rgba(24, 144, 255, 0.1);
}

.header-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(250, 173, 20, 0.2);
  color: #faad14;
}

.type-bash .header-icon {
  background: rgba(255, 77, 79, 0.2);
  color: #ff4d4f;
}

.type-write .header-icon,
.type-edit .header-icon {
  background: rgba(24, 144, 255, 0.2);
  color: #1890ff;
}

.type-read .header-icon {
  background: rgba(82, 196, 26, 0.2);
  color: #52c41a;
}

.header-content {
  flex: 1;
}

.header-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--n-text-color);
}

.header-type {
  font-size: 12px;
  color: var(--n-text-color-3);
}

/* Content */
.permission-content {
  padding: 16px;
}

.preview-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--n-text-color-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.preview-path {
  padding: 10px 12px;
  background: var(--n-color-embedded);
  border-radius: 8px;
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 12px;
  color: var(--n-text-color);
  word-break: break-all;
}

.patterns-list {
  margin-top: 12px;
}

.patterns-label {
  font-size: 11px;
  color: var(--n-text-color-3);
  margin-bottom: 6px;
}

.patterns-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.patterns-items code {
  padding: 4px 8px;
  background: var(--n-color-embedded);
  border-radius: 4px;
  font-size: 11px;
}

/* Command Preview */
.command-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: #1e1e1e;
  border-radius: 8px;
}

.command-text {
  flex: 1;
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 13px;
  color: #d4d4d4;
  word-break: break-all;
  white-space: pre-wrap;
}

.copy-button {
  flex-shrink: 0;
  color: #8c8c8c;
}

.copy-button:hover {
  color: #fff;
}

.cwd-info {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 11px;
}

.cwd-label {
  color: var(--n-text-color-3);
}

.cwd-path {
  padding: 2px 6px;
  background: var(--n-color-embedded);
  border-radius: 4px;
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 11px;
}

/* Description */
.description {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--n-border-color);
  font-size: 12px;
  color: var(--n-text-color-2);
}

/* Actions */
.permission-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  background: var(--n-color-embedded);
  border-top: 1px solid var(--n-border-color);
}
</style>
