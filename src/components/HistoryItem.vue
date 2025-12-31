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
  <div class="history-item-content">
    <!-- Icon and main content -->
    <div class="history-main-row">
      <!-- Program icon with status indicator -->
      <div class="history-icon">
        <div class="program-icon">
          {{ getProgramIcon(item.command) }}
        </div>
        <!-- Status indicator - animated spinner for running, dot for others -->
        <div v-if="item.status === 'running'" class="status-spinner">
          <svg viewBox="0 0 24 24" class="spinner-svg">
            <circle cx="12" cy="12" r="10" fill="none" stroke="#00d084" stroke-width="2" stroke-dasharray="31.4 31.4" stroke-linecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>
        <div
          v-else
          class="status-dot"
          :style="{
            backgroundColor: getHistoryStatusColor(item),
          }"
        ></div>
      </div>

      <!-- History info -->
      <div class="history-info">
        <div class="history-header">
          <div class="history-name-row">
            <n-tooltip trigger="hover" placement="top">
              <template #trigger>
                <span class="history-name">
                  {{ truncateText(item.name, 20) }}
                </span>
              </template>
              <div class="history-tooltip">
                <div class="tooltip-title">{{ item.name }}</div>
                <div class="tooltip-command">{{ getHistoryCommand(item) }}</div>
              </div>
            </n-tooltip>
          </div>
          <div
            class="history-actions"
            :class="{ visible: hovered || selected || item.status === 'running' }"
            @click.stop
          >
            <n-button
              size="small"
              text
              @click="handlePin"
              class="action-button pin-button"
              :title="isPinned ? '取消置顶' : '置顶'"
            >
              <template #icon>
                <component
                  :is="
                    isPinned ? iconComponents.pin : iconComponents.pinOutline
                  "
                />
              </template>
            </n-button>
            <n-button
              v-if="item.status === 'running'"
              size="small"
              text
              @click="handleRestart"
              class="action-button restart-button"
              title="重启"
            >
              <template #icon>
                <component :is="iconComponents.replay" />
              </template>
            </n-button>
            <n-button
              v-if="item.status === 'running'"
              size="small"
              text
              @click="handleStop"
              class="action-button stop-button"
              title="停止"
            >
              <template #icon>
                <component :is="iconComponents.stop(true)" />
              </template>
            </n-button>
            <n-button
              v-if="item.status !== 'running'"
              size="small"
              text
              @click="handleRerun"
              class="action-button rerun-button"
              title="重新运行"
            >
              <template #icon>
                <component :is="iconComponents.replayHistory" />
              </template>
            </n-button>
            <n-button
              size="small"
              text
              @click="handleDelete"
              class="action-button delete-button"
              title="删除"
            >
              <template #icon>
                <component :is="iconComponents.delete" />
              </template>
            </n-button>
          </div>
        </div>
        <div class="history-meta">
          <n-text depth="3" class="history-time">
            {{ formatTime(item.timestamp) }}
            <span
              v-if="item.status !== 'running' && item.duration"
              class="duration-text"
            >
              · {{ formatDuration(item.startTime, item.duration) }}
            </span>
          </n-text>
          <div v-if="item.status === 'running'" class="process-stats">
            <span class="stat-item running-indicator">
              <span class="running-dot"></span>
              运行中
            </span>
            <span class="stat-item"
              >时长: {{ formatDuration(item.startTime) }}</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NTooltip, NText } from "naive-ui";
import { iconComponents } from "../utils/icons";
import type { RunHistory } from "../stores/runConfig";

interface Props {
  item: RunHistory;
  hovered: boolean;
  selected: boolean;
  getProgramIcon: (command: string) => string;
  getHistoryStatusColor: (item: RunHistory) => string;
  getHistoryCommand: (item: RunHistory) => string;
  truncateText: (text: string, maxLength: number) => string;
  formatTime: (timestamp: Date) => string;
  formatDuration: (startTime?: number, duration?: number) => string;
}

interface Emits {
  (e: "pin", item: RunHistory): void;
  (e: "stop", item: RunHistory): void;
  (e: "rerun", item: RunHistory): void;
  (e: "restart", item: RunHistory): void;
  (e: "delete", item: RunHistory): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isPinned = props.item.pinned;

const handlePin = () => {
  emit("pin", props.item);
};

const handleStop = () => {
  emit("stop", props.item);
};

const handleRerun = () => {
  emit("rerun", props.item);
};

const handleRestart = () => {
  emit("restart", props.item);
};

const handleDelete = () => {
  emit("delete", props.item);
};
</script>

<style scoped>
.duration-text {
  color: var(--text-color-3);
  font-size: 0.9em;
  margin-left: 4px;
}

.status-spinner {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 14px;
  height: 14px;
}

.spinner-svg {
  width: 100%;
  height: 100%;
}

.running-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #00d084;
}

.running-dot {
  width: 6px;
  height: 6px;
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

.restart-button {
  color: #00d084;
}

.restart-button:hover {
  color: #00b871;
}
</style>
