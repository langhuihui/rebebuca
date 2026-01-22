<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * Timeline View - Displays the orchestration progress as a vertical timeline.
 * Groups messages and tool executions by round.
 -->

<template>
  <div
    class="timeline-view"
    style="
      user-select: text;
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
    "
  >
    <n-scrollbar
      ref="scrollbarRef"
      style="user-select: text !important; -webkit-user-select: text !important"
    >
      <div
        class="timeline-container"
        ref="containerRef"
        style="
          user-select: text !important;
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
        "
      >
        <!-- Goal Section -->
        <div
          v-if="session?.goal"
          class="goal-section"
          @click="goalExpanded = !goalExpanded"
        >
          <div class="goal-header">
            <n-icon size="16">
              <component :is="svgIcons.target" />
            </n-icon>
            <span class="goal-title">{{ session.goal.objective }}</span>
            <n-icon
              size="12"
              class="expand-icon"
              :class="{ expanded: goalExpanded }"
            >
              <component :is="svgIcons.chevronRight" />
            </n-icon>
          </div>
          <n-collapse-transition :show="goalExpanded">
            <div class="goal-details">
              <div class="criteria-section">
                <div class="criteria-label">
                  {{ t("aiCollab.acceptanceCriteria") }}
                </div>
                <ul class="criteria-list">
                  <li
                    v-for="(criterion, index) in session.goal
                      .acceptanceCriteria"
                    :key="index"
                  >
                    {{ criterion }}
                  </li>
                </ul>
              </div>
              <div v-if="session.goal.context" class="context-section">
                <div class="context-label">{{ t("aiCollab.context") }}</div>
                <p class="context-text">{{ session.goal.context }}</p>
              </div>
            </div>
          </n-collapse-transition>
        </div>

        <!-- Rounds -->
        <div class="rounds-container">
          <RoundSection
            v-for="(round, index) in rounds"
            :key="round.number"
            :round-number="round.number"
            :is-active="round.isActive"
            :is-completed="round.isCompleted"
            :system-message="round.systemMessage"
            :supervisor-message="round.supervisorMessage"
            :worker-message="round.workerMessage"
            :tool-executions="round.toolExecutions"
            :duration="round.duration"
            :default-expanded="index === rounds.length - 1"
            :worker-step="session?.progress?.currentStep"
            :worker-max-steps="session?.progress?.totalSteps"
            :project-path="session?.projectPath"
          />

          <!-- Running Indicator -->
          <div v-if="session?.status === 'running'" class="running-indicator">
            <n-spin size="small" />
            <span>{{ getRunningText() }}</span>
          </div>

          <!-- Empty State -->
          <div
            v-if="rounds.length === 0 && session?.status !== 'running'"
            class="empty-state"
          >
            <n-empty :description="t('aiCollab.noConversation')">
              <template #extra>
                <n-text depth="3">{{ t("aiCollab.waitingToStart") }}</n-text>
              </template>
            </n-empty>
          </div>
        </div>

        <!-- Completion Summary -->
        <div v-if="session?.status === 'completed'" class="completion-summary">
          <n-icon size="24" color="#52c41a">
            <component :is="svgIcons.checkCircle" />
          </n-icon>
          <div class="completion-content">
            <div class="completion-title">
              {{ t("aiCollab.taskCompleted") }}
            </div>
            <div class="completion-stats">
              <span>{{ rounds.length }} {{ t("aiCollab.rounds") }}</span>
              <span
                >{{ totalToolExecutions }} {{ t("aiCollab.toolsUsed") }}</span
              >
              <span
                >{{
                  formatTokens(session.usage?.total?.totalTokens || 0)
                }}
                tokens</span
              >
            </div>
          </div>
        </div>

        <!-- Error Summary -->
        <div v-if="session?.status === 'error'" class="error-summary">
          <n-icon size="24" color="#ff4d4f">
            <component :is="svgIcons.warning" />
          </n-icon>
          <div class="error-content">
            <div class="error-title">{{ t("aiCollab.taskFailed") }}</div>
            <div v-if="lastErrorMessage" class="error-message">
              {{ lastErrorMessage }}
            </div>
          </div>
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import {
  NScrollbar,
  NSpin,
  NEmpty,
  NText,
  NIcon,
  NCollapseTransition,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import type {
  ExtendedDualAgentSession,
  ToolExecution,
} from "../../stores/dualAgent";
import type { AgentMessage } from "../../services/ai/agents/types";
import RoundSection from "./RoundSection.vue";
import { svgIcons } from "../../utils/icons";

interface Round {
  number: number;
  isActive: boolean;
  isCompleted: boolean;
  systemMessage?: AgentMessage;
  supervisorMessage?: AgentMessage;
  workerMessage?: AgentMessage;
  toolExecutions: ToolExecution[];
  duration?: number;
}

const props = defineProps<{
  session: ExtendedDualAgentSession | null;
}>();

const { t } = useI18n();

const scrollbarRef = ref<InstanceType<typeof NScrollbar> | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const goalExpanded = ref(false);

// Parse conversation into rounds
const rounds = computed<Round[]>(() => {
  if (!props.session) return [];

  const conversation = props.session.conversation || [];
  const toolExecutions = props.session.toolExecutions || [];
  const roundsMap = new Map<number, Round>();

  // Determine round number from message order or metadata
  let currentRound = 1;
  let lastFrom: "supervisor" | "worker" | "system" | null = null;

  for (const message of conversation) {
    // Increment round when we see a new supervisor instruction after a worker report
    if (
      (message.from === "supervisor" || message.from === "system") &&
      message.type === "instruction"
    ) {
      if (lastFrom === "worker") {
        currentRound++;
      }
    }

    if (!roundsMap.has(currentRound)) {
      roundsMap.set(currentRound, {
        number: currentRound,
        isActive: false,
        isCompleted: false,
        toolExecutions: [],
      });
    }

    const round = roundsMap.get(currentRound)!;

    if (message.from === "system") {
      round.systemMessage = message;
    } else if (message.from === "supervisor") {
      round.supervisorMessage = message;
    } else if (message.from === "worker") {
      round.workerMessage = message;
      round.isCompleted = true;
    }

    lastFrom = message.from;
  }

  // Distribute tool executions to rounds based on timestamp
  // Find the round that was active when the tool execution happened
  const roundsList = Array.from(roundsMap.values());
  if (roundsList.length > 0 && toolExecutions.length > 0) {
    for (const tool of toolExecutions) {
      const toolTime = tool.startTime;
      let assignedRound = roundsList[0];

      // Find the round that was active when this tool was executed
      // The tool should be assigned to a round where:
      // - supervisorMessage exists and toolTime >= supervisorMessage.timestamp
      // - If workerMessage exists, toolTime <= workerMessage.timestamp (or after it for error tools)
      for (const round of roundsList) {
        const supervisorTime = round.supervisorMessage?.timestamp || 0;
        const workerTime = round.workerMessage?.timestamp || Infinity;

        if (toolTime >= supervisorTime && toolTime <= workerTime) {
          assignedRound = round;
          break;
        }
        // If tool time is before this round's supervisor message, it belongs to previous round
        if (toolTime < supervisorTime) {
          break;
        }
      }

      assignedRound.toolExecutions.push(tool);
    }
  }

  // Mark active round
  if (props.session?.status === "running" && roundsList.length > 0) {
    const lastRound = roundsList[roundsList.length - 1];
    if (!lastRound.isCompleted) {
      lastRound.isActive = true;
    }
  }

  // Calculate durations
  for (const round of roundsList) {
    if (round.supervisorMessage && round.workerMessage) {
      round.duration =
        round.workerMessage.timestamp - round.supervisorMessage.timestamp;
    }
  }

  return roundsList;
});

const totalToolExecutions = computed(() => {
  return props.session?.toolExecutions?.length || 0;
});

const lastErrorMessage = computed(() => {
  if (!props.session) return null;
  const conversation = props.session.conversation || [];
  const errorMessage = [...conversation]
    .reverse()
    .find((m) => m.type === "error");
  return errorMessage?.content;
});

// Helpers
const getRunningText = (): string => {
  if (!props.session) return "";
  const { supervisorState, workerState } = props.session;
  if (workerState === "running") {
    return t("aiCollab.workerExecuting");
  }
  if (supervisorState === "running") {
    return t("aiCollab.supervisorThinking");
  }
  return t("aiCollab.processing");
};

const formatTokens = (tokens: number): string => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
};

// Auto-scroll to bottom when new content added
const scrollToBottom = () => {
  nextTick(() => {
    if (scrollbarRef.value) {
      try {
        const scrollbarEl = scrollbarRef.value.$el;
        let container: HTMLElement | null = null;

        if (scrollbarEl && typeof scrollbarEl.querySelector === "function") {
          container = scrollbarEl.querySelector(".n-scrollbar-container");
        } else if (containerRef.value) {
          container = containerRef.value.closest(".n-scrollbar-container");
        }

        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          });
        }
      } catch (error) {
        console.warn("Failed to scroll to bottom:", error);
      }
    }
  });
};

watch(
  () => props.session?.conversation?.length,
  () => scrollToBottom(),
);

watch(
  () => props.session?.toolExecutions?.length,
  () => scrollToBottom(),
);
</script>

<style scoped>
.timeline-view {
  height: 100%;
  overflow: hidden;
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

.timeline-container {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

/* Goal Section */
.goal-section {
  background: linear-gradient(
    135deg,
    rgba(114, 46, 209, 0.05) 0%,
    rgba(24, 144, 255, 0.05) 100%
  );
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.goal-section:hover {
  border-color: var(--n-text-color-3);
}

.goal-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.goal-title {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
  color: var(--n-text-color);
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.expand-icon {
  color: var(--n-text-color-3);
  transition: transform 0.2s ease;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.goal-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--n-border-color);
}

.criteria-label,
.context-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--n-text-color-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.criteria-list {
  margin: 0;
  padding-left: 20px;
}

.criteria-list li {
  font-size: 13px;
  color: var(--n-text-color);
  margin-bottom: 4px;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.context-section {
  margin-top: 12px;
}

.context-text {
  font-size: 13px;
  color: var(--n-text-color-2);
  margin: 0;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

/* Rounds Container */
.rounds-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

/* Running Indicator */
.running-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  color: var(--n-text-color-3);
  font-size: 13px;
}

/* Empty State */
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 48px 16px;
}

/* Completion Summary */
.completion-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(82, 196, 26, 0.05);
  border: 1px solid rgba(82, 196, 26, 0.2);
  border-radius: 12px;
}

.completion-content {
  flex: 1;
}

.completion-title {
  font-weight: 600;
  font-size: 14px;
  color: #52c41a;
  margin-bottom: 4px;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.completion-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--n-text-color-3);
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

/* Error Summary */
.error-summary {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 77, 79, 0.05);
  border: 1px solid rgba(255, 77, 79, 0.2);
  border-radius: 12px;
}

.error-content {
  flex: 1;
}

.error-title {
  font-weight: 600;
  font-size: 14px;
  color: #ff4d4f;
  margin-bottom: 4px;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.error-message {
  font-size: 12px;
  color: var(--n-text-color-2);
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}
</style>
