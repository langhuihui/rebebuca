<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * Agent Status Header - Shows real-time status of Supervisor and Worker agents.
 * Features:
 * - Pulsing indicator when agent is active
 * - Token usage per agent
 * - Round progress
 * - Quick action buttons
 -->

<template>
  <div class="agent-status-header">
    <!-- Supervisor Status -->
    <div class="agent-card supervisor" :class="{ active: supervisorActive }">
      <div class="agent-icon">
        <div class="icon-circle" :class="supervisorStateClass">
          <span>S</span>
        </div>
        <div v-if="supervisorActive" class="pulse-ring"></div>
      </div>
      <div class="agent-info">
        <div class="agent-name">{{ t("aiCollab.supervisor") }}</div>
        <div class="agent-state">
          <span class="state-indicator" :class="supervisorStateClass"></span>
          {{ supervisorStateText }}
        </div>
        <div v-if="supervisorContextLimit > 0" class="context-usage">
          <div class="context-usage-header">
            <span class="context-usage-label">{{ t("aiCollab.contextUsage") }}</span>
            <span class="context-usage-value">
              {{ formatTokens(supervisorUsageTokens) }}/{{ formatTokens(supervisorContextLimit) }}
            </span>
          </div>
          <div class="context-usage-bar">
            <div
              class="context-usage-fill supervisor"
              :style="{ width: `${supervisorContextPercent}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Progress Section -->
    <div class="progress-section">
      <div class="round-info">
        <span class="round-label">{{ t("aiCollab.round") }}</span>
        <span class="round-value">{{ currentRound }}/{{ maxRounds }}</span>
      </div>
      <div class="progress-bar-container">
        <div
          class="progress-bar-fill"
          :style="{ width: `${progressPercent}%` }"
          :class="progressClass"
        ></div>
      </div>
      <div class="action-text">
        {{ session?.progress?.currentAction || t("aiCollab.waiting") }}
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <n-tooltip
          v-if="session?.status === 'running' || session?.status === 'paused'"
          placement="bottom"
        >
          <template #trigger>
            <n-button
              :type="session?.status === 'paused' ? 'primary' : undefined"
              size="tiny"
              circle
              :quaternary="session?.status === 'running'"
              @click="
                session?.status === 'running' ? $emit('pause') : $emit('resume')
              "
            >
              <template #icon>
                <component
                  :is="
                    session?.status === 'running'
                      ? iconComponents.pause
                      : iconComponents.play
                  "
                />
              </template>
            </n-button>
          </template>
          {{
            session?.status === "running"
              ? t("aiCollab.pause")
              : t("aiCollab.resume")
          }}
        </n-tooltip>
        <n-tooltip placement="bottom">
          <template #trigger>
            <n-button
              size="tiny"
              circle
              quaternary
              type="error"
              :disabled="
                session?.status !== 'running' && session?.status !== 'paused'
              "
              @click="$emit('stop')"
            >
              <template #icon>
                <component :is="stopIcon" />
              </template>
            </n-button>
          </template>
          {{ t("aiCollab.stop") }}
        </n-tooltip>
      </div>
    </div>

    <!-- Worker Status -->
    <div class="agent-card worker" :class="{ active: workerActive }">
      <div class="agent-info align-right">
        <div class="agent-name">{{ t("aiCollab.worker") }}</div>
        <div class="agent-state">
          {{ workerStateText }}
          <span class="state-indicator" :class="workerStateClass"></span>
        </div>
        <div v-if="workerContextLimit > 0" class="context-usage align-right">
          <div class="context-usage-header">
            <span class="context-usage-label">{{ t("aiCollab.contextUsage") }}</span>
            <span class="context-usage-value">
              {{ formatTokens(workerUsageTokens) }}/{{ formatTokens(workerContextLimit) }}
            </span>
          </div>
          <div class="context-usage-bar">
            <div
              class="context-usage-fill worker"
              :style="{ width: `${workerContextPercent}%` }"
            ></div>
          </div>
        </div>
      </div>
      <div class="agent-icon">
        <div class="icon-circle" :class="workerStateClass">
          <span>W</span>
        </div>
        <div v-if="workerActive" class="pulse-ring"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NButton, NTooltip } from "naive-ui";
import { useI18n } from "vue-i18n";
import type { ExtendedDualAgentSession } from "../../stores/dualAgent";
import { getModelInfo } from "../../services/ai/provider/models";
import { iconComponents } from "../../utils/icons";

const props = defineProps<{
  session: ExtendedDualAgentSession | null;
}>();

defineEmits<{
  (e: "pause"): void;
  (e: "resume"): void;
  (e: "stop"): void;
}>();

const { t } = useI18n();

// 缓存 stop 图标，避免每次渲染都创建新实例
const stopIcon = iconComponents.stop(false);

// Supervisor state
const supervisorActive = computed(
  () => props.session?.supervisorState === "running",
);
const supervisorStateClass = computed(() => {
  switch (props.session?.supervisorState) {
    case "running":
      return "state-running";
    case "waiting":
      return "state-waiting";
    case "completed":
      return "state-completed";
    case "error":
      return "state-error";
    default:
      return "state-idle";
  }
});
const supervisorStateText = computed(() => {
  switch (props.session?.supervisorState) {
    case "running":
      return t("aiCollab.thinking");
    case "waiting":
      return t("aiCollab.waiting");
    case "completed":
      return t("aiCollab.done");
    case "error":
      return t("aiCollab.error");
    default:
      return t("aiCollab.idle");
  }
});

// Worker state
const workerActive = computed(() => props.session?.workerState === "running");
const workerStateClass = computed(() => {
  switch (props.session?.workerState) {
    case "running":
      return "state-running";
    case "waiting":
      return "state-waiting";
    case "completed":
      return "state-completed";
    case "error":
      return "state-error";
    default:
      return "state-idle";
  }
});
const workerStateText = computed(() => {
  switch (props.session?.workerState) {
    case "running":
      return t("aiCollab.executing");
    case "waiting":
      return t("aiCollab.waiting");
    case "completed":
      return t("aiCollab.done");
    case "error":
      return t("aiCollab.error");
    default:
      return t("aiCollab.idle");
  }
});

// Context usage
const supervisorModelInfo = computed(() => {
  if (!props.session) return undefined;
  return getModelInfo(props.session.supervisorProvider.model);
});
const workerModelInfo = computed(() => {
  if (!props.session) return undefined;
  return getModelInfo(props.session.workerProvider.model);
});
const supervisorContextLimit = computed(() => supervisorModelInfo.value?.contextWindow || 0);
const workerContextLimit = computed(() => workerModelInfo.value?.contextWindow || 0);
const supervisorUsageTokens = computed(() => props.session?.usage?.supervisor?.totalTokens || 0);
const workerUsageTokens = computed(() => props.session?.usage?.worker?.totalTokens || 0);
const supervisorContextPercent = computed(() => {
  if (!supervisorContextLimit.value) return 0;
  return Math.min(100, Math.round((supervisorUsageTokens.value / supervisorContextLimit.value) * 100));
});
const workerContextPercent = computed(() => {
  if (!workerContextLimit.value) return 0;
  return Math.min(100, Math.round((workerUsageTokens.value / workerContextLimit.value) * 100));
});

const formatTokens = (tokens: number): string => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
};

// Progress
const currentRound = computed(() => props.session?.loop?.currentRound || 0);
const maxRounds = computed(() => props.session?.loop?.maxRounds || 10);
const progressPercent = computed(() => {
  if (!props.session) return 0;
  return Math.min(
    100,
    Math.round((currentRound.value / maxRounds.value) * 100),
  );
});
const progressClass = computed(() => {
  if (props.session?.status === "completed") return "progress-success";
  if (props.session?.status === "error") return "progress-error";
  if (props.session?.progress?.isStuck) return "progress-warning";
  return "progress-default";
});
</script>

<style scoped>
.agent-status-header {
  display: flex;
  align-items: stretch;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(
    135deg,
    rgba(114, 46, 209, 0.05) 0%,
    rgba(24, 144, 255, 0.05) 100%
  );
  border-bottom: 1px solid var(--n-border-color);
}

.agent-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--n-color);
  border-radius: 10px;
  border: 1px solid var(--n-border-color);
  transition: all 0.3s ease;
  min-width: 140px;
}

.agent-card.active {
  border-color: var(--n-primary-color);
  box-shadow: 0 0 12px rgba(var(--n-primary-color-rgb), 0.2);
}

.agent-card.supervisor.active {
  border-color: #722ed1;
  box-shadow: 0 0 12px rgba(114, 46, 209, 0.2);
}

.agent-card.worker.active {
  border-color: #1890ff;
  box-shadow: 0 0 12px rgba(24, 144, 255, 0.2);
}

.agent-icon {
  position: relative;
  flex-shrink: 0;
}

.icon-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  color: #fff;
  transition: all 0.3s ease;
}

.icon-circle.state-idle {
  background: #8c8c8c;
}

.icon-circle.state-running {
  background: linear-gradient(135deg, #722ed1 0%, #1890ff 100%);
}

.icon-circle.state-waiting {
  background: #faad14;
}

.icon-circle.state-completed {
  background: #52c41a;
}

.icon-circle.state-error {
  background: #ff4d4f;
}

.pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid var(--n-primary-color);
  animation: pulse 2s ease-out infinite;
}

.supervisor .pulse-ring {
  border-color: #722ed1;
}

.worker .pulse-ring {
  border-color: #1890ff;
}

@keyframes pulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 0;
  }
}

.agent-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.agent-info.align-right {
  text-align: right;
  align-items: flex-end;
}

.agent-name {
  font-weight: 600;
  font-size: 12px;
  color: var(--n-text-color);
}

.agent-state {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--n-text-color-3);
}

.context-usage {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.context-usage.align-right {
  align-items: flex-end;
}

.context-usage-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--n-text-color-3);
}

.context-usage-value {
  font-variant-numeric: tabular-nums;
}

.context-usage-bar {
  width: 100%;
  height: 4px;
  background: var(--n-border-color);
  border-radius: 2px;
  overflow: hidden;
}

.context-usage-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.context-usage-fill.supervisor {
  background: linear-gradient(90deg, #722ed1 0%, #9254de 100%);
}

.context-usage-fill.worker {
  background: linear-gradient(90deg, #1890ff 0%, #40a9ff 100%);
}

.state-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.state-indicator.state-idle {
  background: #8c8c8c;
}

.state-indicator.state-running {
  background: #52c41a;
  animation: blink 1s ease-in-out infinite;
}

.state-indicator.state-waiting {
  background: #faad14;
}

.state-indicator.state-completed {
  background: #52c41a;
}

.state-indicator.state-error {
  background: #ff4d4f;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.agent-tokens {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--n-text-color-3);
}

/* Progress Section */
.progress-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 16px;
}

.round-info {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.round-label {
  font-size: 11px;
  color: var(--n-text-color-3);
}

.round-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--n-text-color);
}

.progress-bar-container {
  width: 100%;
  height: 4px;
  background: var(--n-border-color);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-bar-fill.progress-default {
  background: linear-gradient(90deg, #722ed1 0%, #1890ff 100%);
}

.progress-bar-fill.progress-success {
  background: #52c41a;
}

.progress-bar-fill.progress-error {
  background: #ff4d4f;
}

.progress-bar-fill.progress-warning {
  background: #faad14;
}

.action-text {
  font-size: 11px;
  color: var(--n-text-color-3);
  text-align: center;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.total-tokens {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11px;
  color: var(--n-text-color-3);
  margin-top: 4px;
}

.quick-actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}
</style>
