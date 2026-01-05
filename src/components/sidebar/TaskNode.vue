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
  <n-tooltip
    trigger="hover"
    placement="right"
    :delay="500"
  >
    <template #trigger>
      <div
        class="tree-node task-node"
        :class="[
          nodeClass,
          { 
            'task-running': isRunning,
            'is-dragging': isDragging,
            'drag-over-top': dragPosition === 'top',
            'drag-over-bottom': dragPosition === 'bottom',
          }
        ]"
        :draggable="draggable"
        @click="$emit('click', task)"
        @dragstart="$emit('dragstart', $event, task)"
        @dragend="$emit('dragend')"
        @mousedown="$emit('mousedown', $event, task)"
      >
        <n-icon v-if="showIcon" size="14" class="tree-icon task-type-icon">
          <component :is="taskIcon" />
        </n-icon>
        <span class="tree-label task-label">
          {{ task.name }}
          <span v-if="folderHint" class="folder-hint">({{ folderHint }})</span>
        </span>
        <!-- Floating action buttons -->
        <div class="task-actions-float">
          <n-button
            v-if="!isRunning"
            size="tiny"
            quaternary
            class="action-btn"
            @click.stop="$emit('run', task)"
          >
            <template #icon>
              <n-icon size="12">
                <component :is="svgIcons.play" />
              </n-icon>
            </template>
          </n-button>
          <n-button
            v-if="isRunning"
            size="tiny"
            quaternary
            class="action-btn stop-btn"
            @click.stop="$emit('stop', task)"
          >
            <template #icon>
              <n-icon size="12">
                <component :is="svgIcons.stop" />
              </n-icon>
            </template>
          </n-button>
          <n-button
            v-if="isRunning"
            size="tiny"
            quaternary
            class="action-btn restart-btn"
            @click.stop="$emit('run', task)"
          >
            <template #icon>
              <n-icon size="12">
                <component :is="svgIcons.refresh" />
              </n-icon>
            </template>
          </n-button>
          <n-button
            size="tiny"
            quaternary
            :class="['action-btn', 'favorite-btn', { active: isFavorite }]"
            @click.stop="$emit('toggle-favorite', task)"
          >
            <template #icon>
              <n-icon size="12">
                <component :is="isFavorite ? svgIcons.starFilled : svgIcons.star" />
              </n-icon>
            </template>
          </n-button>
          <n-button
            v-if="canEdit"
            size="tiny"
            quaternary
            class="action-btn"
            @click.stop="$emit('edit', task)"
          >
            <template #icon>
              <n-icon size="12">
                <component :is="svgIcons.edit" />
              </n-icon>
            </template>
          </n-button>
          <n-button
            v-if="showDelete"
            size="tiny"
            quaternary
            class="action-btn delete-btn"
            @click.stop="$emit('delete', task)"
          >
            <template #icon>
              <n-icon size="12">
                <component :is="svgIcons.close" />
              </n-icon>
            </template>
          </n-button>
        </div>
      </div>
    </template>
    <div class="task-tooltip">
      <div v-if="task.type === 'macro'" class="tooltip-macro-info">
        <div class="tooltip-label">
          {{ task.executionMode === 'parallel' ? 'Parallel Macro Task' : 'Serial Macro Task' }}
        </div>
        <div v-if="task.subTasks && task.subTasks.length > 0" class="tooltip-subtasks">
          Sub-tasks: {{ task.subTasks.join(', ') }}
        </div>
        <div v-else-if="task.dependsOn && task.dependsOn.length > 0" class="tooltip-subtasks">
          Dependencies: {{ task.dependsOn.join(', ') }}
        </div>
      </div>
      <div v-else>
        <div class="tooltip-command">{{ fullCommand }}</div>
        <div v-if="task.cwd" class="tooltip-cwd">{{ task.cwd }}</div>
      </div>
    </div>
  </n-tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NTooltip, NIcon, NButton } from 'naive-ui';
import { svgIcons, getCommandIconName } from '../../utils/icons';
import { useSettingsStore } from '../../stores/settings';
import type { Task } from '../../providers/types';

const props = defineProps<{
  task: Task;
  isRunning: boolean;
  isFavorite: boolean;
  showIcon?: boolean;
  showDelete?: boolean;
  showEdit?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  dragPosition?: 'top' | 'bottom' | null;
  nodeClass?: string;
  folderHint?: string | null;
}>();

defineEmits<{
  (e: 'click', task: Task): void;
  (e: 'run', task: Task): void;
  (e: 'stop', task: Task): void;
  (e: 'edit', task: Task): void;
  (e: 'delete', task: Task): void;
  (e: 'toggle-favorite', task: Task): void;
  (e: 'dragstart', event: DragEvent, task: Task): void;
  (e: 'dragend'): void;
  (e: 'mousedown', event: MouseEvent, task: Task): void;
}>();

const settingsStore = useSettingsStore();

const fullCommand = computed(() => {
  let cmd = props.task.command || '';
  if (props.task.args && props.task.args.length > 0) {
    cmd += ' ' + props.task.args.join(' ');
  }
  return cmd;
});

const taskIcon = computed(() => {
  // Show a special icon for macro tasks
  if (props.task.type === 'macro') {
    return props.task.executionMode === 'parallel' 
      ? svgIcons.grid  // use grid for parallel
      : svgIcons.task; // use task icon for serial
  }
  
  const customIcons = settingsStore.settings.commandIcons || {};
  const iconName = getCommandIconName(props.task.command || '', customIcons);
  if (iconName !== 'task' && svgIcons[iconName as keyof typeof svgIcons]) {
    return svgIcons[iconName as keyof typeof svgIcons];
  }
  
  switch (props.task.group) {
    case 'build':
      return svgIcons.build || svgIcons.task;
    case 'test':
      return svgIcons.test || svgIcons.task;
    case 'clean':
      return svgIcons.clean || svgIcons.task;
    default:
      return svgIcons.task;
  }
});

// Determine if edit button should be shown
// Only user-created tasks are editable, folder-scanned tasks (vscode, npm) are read-only
const canEdit = computed(() => {
  // If showEdit prop is explicitly set, use it
  if (props.showEdit !== undefined) {
    return props.showEdit;
  }
  // Otherwise, only user-created tasks are editable
  return props.task.source === 'user';
});
</script>

<style scoped>
.tree-node {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
  gap: 6px;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
}

.tree-node:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.task-node {
  padding-left: 40px;
  padding-right: 8px;
}

.tree-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.tree-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  user-select: none;
}

.task-label {
  font-family: monospace;
  user-select: none;
}

.folder-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-left: 4px;
  font-family: sans-serif;
}

/* Floating action buttons */
.task-actions-float {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 0;
  background: linear-gradient(90deg, transparent 0%, var(--action-bg) 20%);
  padding-left: 16px;
  opacity: 0;
  transition: opacity 0.15s;
  --action-bg: rgba(36, 36, 36, 0.95);
}

.tree-node:hover .task-actions-float {
  opacity: 1;
}

.action-btn {
  padding: 2px !important;
  min-width: 20px !important;
  height: 20px !important;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.favorite-btn {
  opacity: 0.5;
}

.favorite-btn:hover {
  opacity: 1;
}

.favorite-btn.active {
  opacity: 1;
  color: #f5a623;
}

.stop-btn:hover {
  color: #f44336 !important;
}

.restart-btn:hover {
  color: #18a058 !important;
}

.delete-btn:hover {
  color: #f44336 !important;
}

/* Running task indicator */
.task-running {
  background-color: rgba(24, 160, 88, 0.1);
}

.task-running .task-type-icon {
  color: #18a058;
  animation: glow 1.5s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% {
    opacity: 1;
    filter: drop-shadow(0 0 2px #18a058);
  }
  50% {
    opacity: 0.6;
    filter: drop-shadow(0 0 6px #18a058) drop-shadow(0 0 10px #18a058);
  }
}

/* Drag states */
.is-dragging {
  opacity: 0.5;
  background-color: rgba(24, 160, 88, 0.1);
}

.drag-over-top {
  border-top: 2px solid #18a058;
  margin-top: -2px;
}

.drag-over-bottom {
  border-bottom: 2px solid #18a058;
  margin-bottom: -2px;
}

/* Task tooltip */
.task-tooltip {
  max-width: 400px;
}

.tooltip-command {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  white-space: pre-wrap;
}

.tooltip-cwd {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
  word-break: break-all;
}

.tooltip-macro-info {
  font-size: 12px;
}

.tooltip-label {
  font-weight: 600;
  margin-bottom: 6px;
  color: #18a058;
}

.tooltip-subtasks {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 4px;
}

/* Light theme */
:global(.n-config-provider--light) .tree-node:hover,
:global(.sidebar-layout.light-theme) .tree-node:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

:global(.n-config-provider--light) .folder-hint,
:global(.sidebar-layout.light-theme) .folder-hint {
  color: rgba(0, 0, 0, 0.4);
}

:global(.n-config-provider--light) .task-actions-float,
:global(.sidebar-layout.light-theme) .task-actions-float {
  --action-bg: rgba(255, 255, 255, 0.95);
}

:global(.n-config-provider--light) .action-btn:hover,
:global(.sidebar-layout.light-theme) .action-btn:hover {
  background: rgba(0, 0, 0, 0.08);
}

:global(.n-config-provider--light) .tooltip-cwd,
:global(.sidebar-layout.light-theme) .tooltip-cwd {
  color: rgba(0, 0, 0, 0.5);
}
</style>
