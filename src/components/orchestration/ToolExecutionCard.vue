<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * Tool Execution Card - Visualizes tool calls (read/write/bash/glob/grep).
 * Features:
 * - Tool icon based on type
 * - Status indicator (running/success/error)
 * - Collapsed args (expandable)
 * - Result preview (collapsible)
 * - Duration badge
 -->

<template>
  <div class="tool-execution-card" :class="[`status-${execution.status}`, { expanded: expanded || shouldAutoExpand }]">
    <div class="tool-header" @click="toggleExpanded">
      <!-- Tool Icon -->
      <div class="tool-icon" :class="`tool-${execution.toolName}`">
        <n-icon size="14">
          <component :is="getToolIcon(execution.toolName)" />
        </n-icon>
      </div>
      
      <!-- Tool Info -->
      <div class="tool-info">
        <span class="tool-name">{{ execution.toolName }}</span>
        <span v-if="execution.args?.path" class="tool-path">{{ truncatePath(String(execution.args.path)) }}</span>
        <span v-else-if="execution.args?.command" class="tool-command">{{ truncateCommand(String(execution.args.command)) }}</span>
        <span v-else-if="execution.args?.pattern" class="tool-pattern">{{ String(execution.args.pattern) }}</span>
      </div>
      
      <!-- Status & Duration -->
      <div class="tool-meta">
        <span v-if="execution.status === 'running'" class="status-running">
          <n-spin size="small" />
        </span>
        <n-icon v-else-if="execution.status === 'success'" class="status-success" size="14">
          <component :is="svgIcons.check" />
        </n-icon>
        <n-icon v-else class="status-error" size="14">
          <component :is="svgIcons.close" />
        </n-icon>
        
        <span v-if="execution.durationMs" class="duration">
          {{ formatDuration(execution.durationMs) }}
        </span>
        
        <n-icon size="12" class="expand-icon">
          <component :is="expanded ? svgIcons.chevronDown : svgIcons.chevronRight" />
        </n-icon>
      </div>
    </div>
    
    <!-- Expanded Content -->
    <n-collapse-transition :show="expanded || shouldAutoExpand">
      <div class="tool-content">
        <!-- Args -->
        <div v-if="execution.args && Object.keys(execution.args).length > 0" class="tool-args">
          <div class="section-label">Arguments</div>
          <div class="args-list">
            <div v-for="(value, key) in execution.args" :key="key" class="arg-item">
              <span class="arg-key">{{ key }}:</span>
              <code class="arg-value">{{ formatArgValue(value) }}</code>
            </div>
          </div>
        </div>
        
        <!-- Result -->
        <div v-if="execution.result" class="tool-result">
          <div class="section-label">Result</div>
          <div class="result-content">
            <n-scrollbar style="max-height: 200px;">
              <pre class="result-text">{{ truncateResult(execution.result) }}</pre>
            </n-scrollbar>
          </div>
        </div>
        
        <!-- Error -->
        <div v-if="execution.status === 'error' && !execution.result" class="tool-error">
          <n-icon size="14" color="#ff4d4f"><component :is="svgIcons.warning" /></n-icon>
          <span>Execution failed</span>
        </div>
      </div>
    </n-collapse-transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { NIcon, NSpin, NScrollbar, NCollapseTransition } from 'naive-ui';
import type { ToolExecution } from '../../stores/dualAgent';
import { svgIcons } from '../../utils/icons';

const props = defineProps<{
  execution: ToolExecution;
  defaultExpanded?: boolean;
}>();

const expanded = ref(props.defaultExpanded ?? false);

// 如果有执行结果，自动展开显示
const shouldAutoExpand = computed(() => {
  return !!props.execution.result;
});

// 切换展开状态（如果有结果则保持展开）
const toggleExpanded = () => {
  if (shouldAutoExpand.value) {
    expanded.value = true;
  } else {
    expanded.value = !expanded.value;
  }
};

// Tool icons
const getToolIcon = (toolName: string) => {
  switch (toolName) {
    case 'read': return svgIcons.file;
    case 'write': return svgIcons.edit;
    case 'bash': return svgIcons.terminal;
    case 'glob': return svgIcons.search;
    case 'grep': return svgIcons.search;
    default: return svgIcons.tool;
  }
};

// Formatters
const truncatePath = (path: string): string => {
  if (path.length <= 40) return path;
  const parts = path.split('/');
  if (parts.length <= 2) return path;
  return `.../${parts.slice(-2).join('/')}`;
};

const truncateCommand = (command: string): string => {
  if (command.length <= 50) return command;
  return command.slice(0, 47) + '...';
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const formatArgValue = (value: unknown): string => {
  if (typeof value === 'string') {
    if (value.length > 100) return value.slice(0, 97) + '...';
    return value;
  }
  return JSON.stringify(value);
};

const truncateResult = (result: string): string => {
  const maxLines = 50;
  const lines = result.split('\n');
  if (lines.length <= maxLines) return result;
  return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
};
</script>

<style scoped>
.tool-execution-card {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.tool-execution-card:hover {
  border-color: var(--n-text-color-3);
}

.tool-execution-card.status-running {
  border-color: #1890ff;
  background: rgba(24, 144, 255, 0.02);
}

.tool-execution-card.status-error {
  border-color: #ff4d4f;
  background: rgba(255, 77, 79, 0.02);
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
}

.tool-header:hover {
  background: var(--n-color-embedded);
}

.tool-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tool-icon.tool-read {
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
}

.tool-icon.tool-write {
  background: rgba(24, 144, 255, 0.1);
  color: #1890ff;
}

.tool-icon.tool-bash {
  background: rgba(250, 173, 20, 0.1);
  color: #faad14;
}

.tool-icon.tool-glob,
.tool-icon.tool-grep {
  background: rgba(114, 46, 209, 0.1);
  color: #722ed1;
}

.tool-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.tool-name {
  font-weight: 600;
  font-size: 12px;
  color: var(--n-text-color);
}

.tool-path,
.tool-command,
.tool-pattern {
  font-size: 11px;
  color: var(--n-text-color-3);
  font-family: 'Menlo', 'Monaco', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-running {
  display: flex;
  align-items: center;
}

.status-success {
  color: #52c41a;
}

.status-error {
  color: #ff4d4f;
}

.duration {
  font-size: 10px;
  color: var(--n-text-color-3);
  background: var(--n-color-embedded);
  padding: 2px 6px;
  border-radius: 4px;
}

.expand-icon {
  color: var(--n-text-color-3);
  transition: transform 0.2s ease;
}

.tool-execution-card.expanded .expand-icon {
  transform: rotate(90deg);
}

/* Content */
.tool-content {
  padding: 0 12px 12px;
  border-top: 1px solid var(--n-border-color);
}

.section-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--n-text-color-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 12px 0 6px;
}

.tool-args {
  margin-bottom: 8px;
}

.args-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.arg-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 11px;
}

.arg-key {
  color: var(--n-text-color-3);
  flex-shrink: 0;
}

.arg-value {
  color: var(--n-text-color);
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 11px;
  background: var(--n-color-embedded);
  padding: 1px 4px;
  border-radius: 3px;
  word-break: break-all;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.result-content {
  background: var(--n-color-embedded);
  border-radius: 6px;
  padding: 8px;
}

.result-text {
  font-size: 11px;
  font-family: 'Menlo', 'Monaco', monospace;
  color: var(--n-text-color);
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.tool-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 77, 79, 0.05);
  border-radius: 6px;
  margin-top: 12px;
  font-size: 12px;
  color: #ff4d4f;
}
</style>
