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
  <div class="status-bar" :class="{ 'light-theme': effectiveTheme === 'light' }">
    <!-- Left section: Command info -->
    <div class="status-section status-left">
      <template v-if="terminalStore.activeTab">
        <!-- Only show status indicators for task/shell tabs, not for settings/notifications -->
        <template v-if="terminalStore.activeTab.type === 'task' || terminalStore.activeTab.type === 'shell'">
          <!-- Running indicator -->
          <span v-if="terminalStore.activeTab.status === 'running'" class="status-indicator running">
            <span class="pulse-dot"></span>
          </span>
          <span v-else-if="terminalStore.activeTab.status === 'success'" class="status-indicator success">
            <component :is="iconComponents.check" />
          </span>
          <span v-else-if="terminalStore.activeTab.status === 'error'" class="status-indicator error">
            <component :is="iconComponents.close" />
          </span>

          <!-- Task location (group or folder) -->
          <span v-if="taskLocation" class="status-location" :title="taskLocation">
            {{ taskLocation }}
          </span>
          <span v-if="taskLocation" class="status-separator">/</span>

          <!-- Command -->
          <span class="status-command" :title="terminalStore.activeTab.command || terminalStore.activeTab.label">
            {{ terminalStore.activeTab.command || terminalStore.activeTab.label }}
          </span>
        </template>
        <template v-else>
          <!-- For settings/notifications tabs, just show the label -->
          <span class="status-command" :title="terminalStore.activeTab.label">
            {{ terminalStore.activeTab.label }}
          </span>
        </template>
      </template>
      <template v-else>
        <span class="status-placeholder">{{ t('statusBar.noActiveTask') }}</span>
      </template>
    </div>

    <!-- Right section: Process stats -->
    <div class="status-section status-right">
      <template v-if="terminalStore.activeTab">
        <!-- Only show status info for task/shell tabs -->
        <template v-if="terminalStore.activeTab.type === 'task' || terminalStore.activeTab.type === 'shell'">
          <!-- Exit code (when not running) -->
          <span 
            v-if="terminalStore.activeTab.status !== 'running'" 
            class="status-item exit-code"
            :class="terminalStore.activeTab.status"
          >
            Exit: {{ terminalStore.activeTab.status === 'success' ? '0' : (terminalStore.activeTab.exitCode ?? 'N/A') }}
          </span>

          <!-- Process stats (when running) -->
          <template v-if="terminalStore.activeTab.status === 'running'">
            <span v-if="terminalStore.activeTab.cpuUsage" class="status-item cpu">
              <component :is="svgIcons.cpu" />
              {{ terminalStore.activeTab.cpuUsage }}
            </span>
            <span v-if="terminalStore.activeTab.memoryUsage" class="status-item memory">
              <component :is="svgIcons.memory" />
              {{ terminalStore.activeTab.memoryUsage }}
            </span>
            <span v-if="terminalStore.activeTab.pid" class="status-item pid">
              PID: {{ terminalStore.activeTab.pid }}
            </span>
          </template>

          <!-- Tab type indicator -->
          <span class="status-item tab-type">
            <template v-if="terminalStore.activeTab.type === 'shell'">Shell</template>
            <template v-else-if="terminalStore.activeTab.shellName">{{ terminalStore.activeTab.shellName }}</template>
            <template v-else>Task</template>
          </span>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTerminalStore } from '../stores/terminal';
import { useTaskManagerStore } from '../stores/taskManager';
import { useTheme } from '../composables/useTheme';
import { iconComponents, createSvgIcon } from '../utils/icons';

const { t } = useI18n();
const terminalStore = useTerminalStore();
const taskManager = useTaskManagerStore();
const { effectiveTheme } = useTheme();

// Get task location (group name or folder name)
const taskLocation = computed(() => {
  const activeTab = terminalStore.activeTab;
  if (!activeTab || activeTab.type === 'shell') return null;
  
  const taskId = activeTab.taskId;
  if (!taskId) return null;
  
  // Check if task is in a user group
  for (const group of taskManager.userGroups) {
    if (group.tasks.some(t => t.id === taskId)) {
      return group.name;
    }
  }
  
  // Check if task is from a folder
  const task = taskManager.combinedTasks.find(t => t.id === taskId);
  if (task?.sourceFile || task?.cwd) {
    const path = task.sourceFile || task.cwd || '';
    // Extract folder name from path
    const parts = path.split(/[/\\]/).filter(p => p && p !== '.vscode' && !p.endsWith('.json'));
    if (parts.length > 0) {
      // Return the last meaningful folder name
      return parts[parts.length - 1];
    }
  }
  
  return null;
});

// Custom SVG icons for status bar
const svgIcons = {
  cpu: createSvgIcon([
    h('rect', { x: '4', y: '4', width: '16', height: '16', rx: '2', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }),
    h('rect', { x: '9', y: '9', width: '6', height: '6', fill: 'currentColor' }),
    h('line', { x1: '9', y1: '1', x2: '9', y2: '4', stroke: 'currentColor', 'stroke-width': '1.5' }),
    h('line', { x1: '15', y1: '1', x2: '15', y2: '4', stroke: 'currentColor', 'stroke-width': '1.5' }),
    h('line', { x1: '9', y1: '20', x2: '9', y2: '23', stroke: 'currentColor', 'stroke-width': '1.5' }),
    h('line', { x1: '15', y1: '20', x2: '15', y2: '23', stroke: 'currentColor', 'stroke-width': '1.5' }),
    h('line', { x1: '20', y1: '9', x2: '23', y2: '9', stroke: 'currentColor', 'stroke-width': '1.5' }),
    h('line', { x1: '20', y1: '15', x2: '23', y2: '15', stroke: 'currentColor', 'stroke-width': '1.5' }),
    h('line', { x1: '1', y1: '9', x2: '4', y2: '9', stroke: 'currentColor', 'stroke-width': '1.5' }),
    h('line', { x1: '1', y1: '15', x2: '4', y2: '15', stroke: 'currentColor', 'stroke-width': '1.5' }),
  ]),
  memory: createSvgIcon([
    h('rect', { x: '3', y: '6', width: '18', height: '12', rx: '1', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }),
    h('line', { x1: '7', y1: '10', x2: '7', y2: '14', stroke: 'currentColor', 'stroke-width': '1.5' }),
    h('line', { x1: '11', y1: '10', x2: '11', y2: '14', stroke: 'currentColor', 'stroke-width': '1.5' }),
    h('line', { x1: '15', y1: '10', x2: '15', y2: '14', stroke: 'currentColor', 'stroke-width': '1.5' }),
    h('line', { x1: '19', y1: '10', x2: '19', y2: '14', stroke: 'currentColor', 'stroke-width': '1.5' }),
  ]),
};
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  padding: 0 12px;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  user-select: none;
}

.status-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-left {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.status-right {
  flex-shrink: 0;
}

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.status-indicator.running .pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #00d084;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}

.status-indicator.success {
  color: #52c41a;
  font-size: 12px;
}

.status-indicator.error {
  color: #ff4d4f;
  font-size: 12px;
}

.status-location {
  color: rgba(255, 255, 255, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150px;
}

.status-separator {
  color: rgba(255, 255, 255, 0.3);
  margin: 0 2px;
  flex-shrink: 0;
}

.status-command {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 400px;
}

.status-placeholder {
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 11px;
  white-space: nowrap;
}

.status-item svg {
  width: 12px;
  height: 12px;
}

.status-item.cpu {
  color: #36cfc9;
}

.status-item.memory {
  color: #9254de;
}

.status-item.pid {
  color: rgba(255, 255, 255, 0.6);
}

.status-item.exit-code {
  font-weight: 500;
}

.status-item.exit-code.success {
  color: #52c41a;
  background: rgba(82, 196, 26, 0.15);
}

.status-item.exit-code.error {
  color: #ff4d4f;
  background: rgba(255, 77, 79, 0.15);
}

.status-item.tab-type {
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.05);
}

/* Light theme */
:global(.n-config-provider--light) .status-bar,
.status-bar.light-theme {
  background: rgba(0, 0, 0, 0.05);
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.65);
}

:global(.n-config-provider--light) .status-placeholder,
.status-bar.light-theme .status-placeholder {
  color: rgba(0, 0, 0, 0.35);
}

:global(.n-config-provider--light) .status-location,
.status-bar.light-theme .status-location {
  color: rgba(0, 0, 0, 0.45);
}

:global(.n-config-provider--light) .status-separator,
.status-bar.light-theme .status-separator {
  color: rgba(0, 0, 0, 0.25);
}

:global(.n-config-provider--light) .status-item,
.status-bar.light-theme .status-item {
  background: rgba(0, 0, 0, 0.06);
}

:global(.n-config-provider--light) .status-item.pid,
.status-bar.light-theme .status-item.pid {
  color: rgba(0, 0, 0, 0.45);
}

:global(.n-config-provider--light) .status-item.tab-type,
.status-bar.light-theme .status-item.tab-type {
  color: rgba(0, 0, 0, 0.4);
  background: rgba(0, 0, 0, 0.04);
}

:global(.n-config-provider--light) .status-indicator.running .pulse-dot,
.status-bar.light-theme .status-indicator.running .pulse-dot {
  background-color: #18a058;
}
</style>
