<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * Round Section - Collapsible container for a round in the orchestration timeline.
 * Shows:
 * - Round number and status
 * - Duration
 * - Supervisor instruction
 * - Worker report and tool executions
 -->

<template>
  <div
    class="round-section"
    :class="{ expanded, completed: isCompleted, active: isActive }"
    style="
      user-select: text;
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
    "
  >
    <!-- Round Header -->
    <div class="round-header" @click="expanded = !expanded">
      <div class="round-marker" :class="statusClass">
        <span class="round-number">{{ roundNumber }}</span>
      </div>

      <div class="round-info">
        <span class="round-title"
          >{{ t("aiCollab.round") }} {{ roundNumber }}</span
        >
        <span v-if="duration" class="round-duration">{{
          formatDuration(duration)
        }}</span>
      </div>

      <div class="round-actions">
        <n-button
          size="tiny"
          tertiary
          :disabled="!progressDocDir"
          @click.stop="openProgressDoc"
        >
          {{ t("aiCollab.openProgressDoc") }}
        </n-button>
      </div>

      <div class="round-status">
        <n-tag v-if="isActive" type="info" size="small">
          {{ t("aiCollab.inProgress") }}
        </n-tag>
        <n-tag v-else-if="isCompleted" type="success" size="small">
          {{ t("aiCollab.completed") }}
        </n-tag>
      </div>

      <n-icon size="14" class="expand-icon">
        <component
          :is="expanded ? svgIcons.chevronDown : svgIcons.chevronRight"
        />
      </n-icon>
    </div>

    <!-- Round Content -->
    <n-collapse-transition :show="expanded">
      <div
        class="round-content"
        style="
          user-select: text !important;
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
        "
      >
        <!-- Timeline Items -->
        <div class="timeline">
          <div v-if="systemMessage" class="timeline-item system">
            <div class="timeline-connector">
              <div class="timeline-dot system"></div>
              <div class="timeline-line"></div>
            </div>
            <div class="timeline-content">
              <div class="message-header">
                <n-avatar
                  size="small"
                  round
                  :style="{ backgroundColor: '#8c8c8c' }"
                  >S</n-avatar
                >
                <span class="message-sender">{{ t("aiCollab.system") }}</span>
                <n-tag
                  :type="getMessageTypeTag(systemMessage.type)"
                  size="tiny"
                >
                  {{ getMessageTypeText(systemMessage.type) }}
                </n-tag>
                <span class="message-time">{{
                  formatTime(systemMessage.timestamp)
                }}</span>
              </div>
              <div class="message-body">
                <div
                  class="message-text"
                  v-html="renderMarkdown(systemMessage.content)"
                ></div>
              </div>
            </div>
          </div>
          <!-- Supervisor Instruction -->
          <div v-if="supervisorMessage" class="timeline-item supervisor">
            <div class="timeline-connector">
              <div class="timeline-dot supervisor"></div>
              <div class="timeline-line"></div>
            </div>
            <div class="timeline-content">
              <div class="message-header">
                <n-avatar
                  size="small"
                  round
                  :style="{ backgroundColor: '#722ed1' }"
                  >S</n-avatar
                >
                <span class="message-sender">{{
                  t("aiCollab.supervisor")
                }}</span>
                <n-tag
                  :type="getMessageTypeTag(supervisorMessage.type)"
                  size="tiny"
                >
                  {{ getMessageTypeText(supervisorMessage.type) }}
                </n-tag>
                <span class="message-time">{{
                  formatTime(supervisorMessage.timestamp)
                }}</span>
              </div>
              <div class="message-body">
                <div
                  class="message-text"
                  v-html="renderMarkdown(supervisorMessage.content)"
                ></div>
              </div>
            </div>
          </div>

          <!-- Worker Report -->
          <div v-if="workerMessage" class="timeline-item worker">
            <div class="timeline-connector">
              <div class="timeline-dot worker"></div>
              <div class="timeline-line last"></div>
            </div>
            <div class="timeline-content">
              <div class="message-header">
                <n-avatar
                  size="small"
                  round
                  :style="{ backgroundColor: '#1890ff' }"
                  >W</n-avatar
                >
                <span class="message-sender">{{ t("aiCollab.worker") }}</span>
                <n-tag
                  :type="getMessageTypeTag(workerMessage.type)"
                  size="tiny"
                >
                  {{ getMessageTypeText(workerMessage.type) }}
                </n-tag>
                <!-- 步骤进度显示 -->
                <n-tag v-if="workerProgress" type="info" size="tiny">
                  {{ workerProgress }}
                </n-tag>
                <span class="message-time">{{
                  formatTime(workerMessage.timestamp)
                }}</span>
              </div>
              <!-- Worker 退出原因显示 -->
              <div v-if="workerExitReason" class="worker-exit-reason">
                <n-tag type="warning" size="small" style="margin-bottom: 8px; display: block;">
                  {{ t("aiCollab.exitReason") }}: {{ workerExitReason }}
                </n-tag>
              </div>
              <!-- Worker 输出小窗口，包含工具执行 -->
              <WorkerOutputWindow
                :content="workerMessage.content"
                :use-markdown="true"
                :format-content="formatWorkerContent"
                :metadata="workerMessage.metadata"
                :auto-scroll="true"
              >
                <!-- 工具执行显示在小窗口内 -->
                <template v-for="tool in toolExecutions" :key="tool.id">
                  <ToolExecutionCard
                    :execution="tool"
                    class="tool-inside-output"
                  />
                </template>
              </WorkerOutputWindow>
            </div>
          </div>
        </div>
      </div>
    </n-collapse-transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import {
  NIcon,
  NTag,
  NAvatar,
  NCollapseTransition,
  NButton,
  useMessage,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import type {
  AgentMessage,
  AgentMessageType,
} from "../../services/ai/agents/types";
import type { ToolExecution } from "../../stores/dualAgent";
import ToolExecutionCard from "./ToolExecutionCard.vue";
import WorkerOutputWindow from "./WorkerOutputWindow.vue";
import { getAdapter } from "../../adapters";
import { svgIcons } from "../../utils/icons";
import { renderMarkdown } from "../../utils/markdown";

const props = defineProps<{
  roundNumber: number;
  isActive?: boolean;
  isCompleted?: boolean;
  systemMessage?: AgentMessage;
  supervisorMessage?: AgentMessage;
  workerMessage?: AgentMessage;
  toolExecutions?: ToolExecution[];
  duration?: number;
  defaultExpanded?: boolean;
  workerStep?: number;
  workerMaxSteps?: number;
  projectPath?: string;
}>();

const { t } = useI18n();
const message = useMessage();

const expanded = ref(props.defaultExpanded ?? props.isActive ?? false);
const progressDocDir = computed(() =>
  props.projectPath ? props.projectPath : null,
);

// 步骤进度显示
const workerProgress = computed(() => {
  if (props.workerStep && props.workerMaxSteps) {
    return `Step ${props.workerStep}/${props.workerMaxSteps}`;
  }
  return null;
});

// Worker 退出原因
const workerExitReason = computed(() => {
  if (!props.workerMessage) return null;
  
  const content = props.workerMessage.content;
  if (!content) return null;
  
  // Try to extract exit reason from JSON
  try {
    // Try parsing as JSON
    let json: any = null;
    if (typeof content === 'string' && content.trim().startsWith('{')) {
      json = JSON.parse(content);
    } else if (typeof content === 'object') {
      json = content;
    }
    
    if (json) {
      // Check for exit reason in various possible fields
      if (json.exitReason) return json.exitReason;
      if (json.reason) return json.reason;
      if (json.exit_reason) return json.exit_reason;
      if (json.report?.exitReason) return json.report.exitReason;
      if (json.report?.reason) return json.report.reason;
    }
    
    // Try to extract from text patterns
    const exitReasonMatch = content.match(/(?:退出原因|结束原因|exit reason|reason)[:：]\s*(.+?)(?:\n|$)/i);
    if (exitReasonMatch && exitReasonMatch[1]) {
      return exitReasonMatch[1].trim();
    }
    
    // Check if worker stopped due to max steps
    if (content.includes('达到最大步骤') || content.includes('max steps') || content.includes('maximum steps')) {
      return '达到最大步骤数限制';
    }
    
    // Check if worker completed
    if (content.includes('任务完成') || content.includes('task completed')) {
      return '任务完成';
    }
  } catch (e) {
    // Not JSON or parse failed, continue
  }
  
  return null;
});

// 自动滚动由 WorkerOutputWindow 组件内部处理

const statusClass = computed(() => {
  if (props.isActive) return "status-active";
  if (props.isCompleted) return "status-completed";
  return "status-pending";
});

const openProgressDoc = async () => {
  if (!progressDocDir.value) return;
  try {
    const adapter = await getAdapter();
    await adapter.system.openExternal(progressDocDir.value);
  } catch (error) {
    message.error(t("aiCollab.openProgressFailed", { error: String(error) }));
  }
};

// Message type helpers
const getMessageTypeTag = (
  type: AgentMessageType,
): "default" | "info" | "success" | "warning" | "error" => {
  switch (type) {
    case "instruction":
      return "info";
    case "report":
      return "default";
    case "decision":
      return "warning";
    case "completion":
      return "success";
    case "error":
      return "error";
    default:
      return "default";
  }
};

const getMessageTypeText = (type: AgentMessageType): string => {
  switch (type) {
    case "instruction":
      return t("aiCollab.instruction");
    case "report":
      return t("aiCollab.report");
    case "decision":
      return t("aiCollab.decision");
    case "completion":
      return t("aiCollab.completion");
    case "error":
      return t("aiCollab.errorMsg");
    default:
      return type;
  }
};

// Formatters
const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString();
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
};

// Format worker content - extract summary from JSON if present, hide raw JSON and TOOL_CALL
const formatWorkerContent = (content: string): string => {
  if (!content) return "";

  // Remove TOOL_CALL blocks
  let cleaned = content.replace(
    /\[TOOL_CALL\][\s\S]*?(\[\/TOOL_CALL\]|$)/gi,
    "",
  );
  cleaned = cleaned.replace(
    /\{tool\s*=>\s*"[^"]*",\s*args\s*=>\s*\{[^}]*\}\}/gi,
    "",
  );

  // Try to parse as JSON - handle both single-line and multi-line JSON
  try {
    let trimmed = cleaned.trim();

    // If it's a JSON string (escaped), try to unescape it first
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        trimmed = JSON.parse(trimmed);
      } catch {
        // Not a JSON string, continue with original
      }
    }

    // Try parsing as direct JSON object
    if (typeof trimmed === "string" && trimmed.startsWith("{")) {
      const json = JSON.parse(trimmed);
      if (json.summary) {
        // Clean up summary - remove raw tool output details if present
        let summary = json.summary;

        // Remove detailed tool execution logs from summary (keep only high-level info)
        summary = summary.replace(/\[.*?\]\s*Success:[\s\S]*?(?=\n\n|$)/g, "");
        summary = summary.replace(/工具执行结果:[\s\S]*?(?=\n\n|$)/g, "");

        // Return formatted summary with additional info if available
        let result = summary.trim();

        // Only show actions if they're high-level (not raw tool outputs)
        if (
          json.actions &&
          Array.isArray(json.actions) &&
          json.actions.length > 0
        ) {
          const highLevelActions = json.actions.filter((a: string) => {
            // Filter out raw tool outputs (they contain paths, commands, etc.)
            return (
              !a.includes("Success:") && !a.includes("Error:") && a.length < 200
            );
          });
          if (highLevelActions.length > 0) {
            result +=
              "\n\n**执行的操作：**\n" +
              highLevelActions
                .map((a: string) => `- ${a.substring(0, 150)}`)
                .join("\n");
          }
        }

        if (
          json.issues &&
          Array.isArray(json.issues) &&
          json.issues.length > 0
        ) {
          result +=
            "\n\n**遇到的问题：**\n" +
            json.issues.map((i: string) => `- ${i}`).join("\n");
        }

        // Show exit reason if available
        if (json.exitReason || json.reason || json.exit_reason) {
          const exitReason = json.exitReason || json.reason || json.exit_reason;
          result +=
            "\n\n**结束原因：**\n" +
            exitReason;
        }

        return result || summary;
      }
    } else if (
      typeof trimmed === "object" &&
      trimmed !== null &&
      "summary" in trimmed
    ) {
      // Already parsed JSON object
      const json = trimmed as any;
      if (json.summary) {
        let summary = json.summary;
        summary = summary.replace(/\[.*?\]\s*Success:[\s\S]*?(?=\n\n|$)/g, "");
        summary = summary.replace(/工具执行结果:[\s\S]*?(?=\n\n|$)/g, "");
        return summary.trim();
      }
    }
  } catch (e) {
    // Not JSON or parse failed, continue
    console.debug("[formatWorkerContent] JSON parse failed:", e);
  }

  // If content contains JSON but also other text, try to extract JSON part
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0]);
      if (json.summary) {
        let summary = json.summary;
        // Clean up summary - remove raw tool execution details
        summary = summary.replace(/\[.*?\]\s*Success:[\s\S]*?(?=\n\n|$)/g, "");
        summary = summary.replace(/工具执行结果:[\s\S]*?(?=\n\n|$)/g, "");
        summary = summary.replace(
          /执行了\s*\d+\s*个工具调用[\s\S]*?(?=\n\n|$)/g,
          "",
        );
        // Remove escaped newlines and clean up
        summary = summary
          .replace(/\\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        return summary;
      }
    } catch {
      // JSON parse failed, continue
    }
  }

  // If all else fails, try to extract readable text from JSON string
  const textMatch = cleaned.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (textMatch && textMatch[1]) {
    let summary = textMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    // Clean up tool execution details
    summary = summary.replace(/\[.*?\]\s*Success:[\s\S]*?(?=\n\n|$)/g, "");
    summary = summary.replace(/工具执行结果:[\s\S]*?(?=\n\n|$)/g, "");
    return summary.trim();
  }

  // Last resort: try to find and extract any readable summary text
  const fallbackMatch = cleaned.match(/summary["\s:]+"([^"]{10,200})/);
  if (fallbackMatch && fallbackMatch[1]) {
    return fallbackMatch[1].replace(/\\n/g, "\n").trim();
  }

  // If still nothing, return cleaned content but limit length
  const final = cleaned.trim();
  if (final.length > 500) {
    return final.substring(0, 500) + "...";
  }
  return final || content;
};
</script>

<style scoped>
.round-section {
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

.round-section:hover {
  border-color: var(--n-text-color-3);
}

.round-section.active {
  border-color: #1890ff;
  box-shadow: 0 0 0 1px rgba(24, 144, 255, 0.2);
}

.round-section.completed {
  border-color: #52c41a;
}

/* Header */
.round-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;
}

.round-header:hover {
  background: var(--n-color-embedded);
}

.round-marker {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-weight: 600;
  font-size: 12px;
  transition: all 0.2s ease;
}

.round-marker.status-pending {
  background: var(--n-border-color);
  color: var(--n-text-color-3);
}

.round-marker.status-active {
  background: linear-gradient(135deg, #722ed1 0%, #1890ff 100%);
  color: #fff;
}

.round-marker.status-completed {
  background: #52c41a;
  color: #fff;
}

.round-info {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.round-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.round-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--n-text-color);
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.round-duration {
  font-size: 12px;
  color: var(--n-text-color-3);
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.round-status {
  flex-shrink: 0;
}

.expand-icon {
  color: var(--n-text-color-3);
  transition: transform 0.2s ease;
}

.round-section.expanded .expand-icon {
  transform: rotate(90deg);
}

/* Content */
.round-content {
  padding: 0 16px 16px;
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

/* Timeline */
.timeline {
  display: flex;
  flex-direction: column;
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

.timeline-item {
  display: flex;
  gap: 12px;
}

.timeline-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid var(--n-color);
  box-sizing: border-box;
}

.timeline-dot.supervisor {
  background: #722ed1;
}

.timeline-dot.system {
  background: #8c8c8c;
}

.timeline-dot.worker {
  background: #1890ff;
}

.timeline-dot.tool {
  background: #8c8c8c;
}

.timeline-dot.tool.status-running {
  background: #1890ff;
}

.timeline-dot.tool.status-success {
  background: #52c41a;
}

.timeline-dot.tool.status-error {
  background: #ff4d4f;
}

.timeline-line {
  width: 2px;
  flex: 1;
  background: var(--n-border-color);
  margin: 4px 0;
}

.timeline-line.last {
  background: transparent;
}

.timeline-content {
  flex: 1;
  min-width: 0;
  padding-bottom: 16px;
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

/* Messages */
.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.message-sender {
  font-weight: 500;
  font-size: 12px;
  color: var(--n-text-color);
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.message-time {
  font-size: 10px;
  color: var(--n-text-color-3);
  margin-left: auto;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.message-body {
  background: var(--n-color-embedded);
  padding: 12px;
  border-radius: 8px;
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

.timeline-item.supervisor .message-body {
  background: rgba(114, 46, 209, 0.05);
  border-left: 3px solid #722ed1;
}

.timeline-item.system .message-body {
  background: rgba(140, 140, 140, 0.08);
  border-left: 3px solid #8c8c8c;
}

.timeline-item.worker .message-body {
  background: rgba(24, 144, 255, 0.05);
  border-left: 3px solid #1890ff;
}

.message-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--n-text-color);
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

.message-text :deep(p) {
  margin: 0 0 8px 0;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.message-text :deep(p:last-child) {
  margin-bottom: 0;
}

.message-text :deep(code) {
  font-family: "Menlo", "Monaco", monospace;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 4px;
  border-radius: 3px;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.message-text :deep(pre) {
  background: rgba(0, 0, 0, 0.06);
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.message-text :deep(pre code) {
  background: transparent;
  padding: 0;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.message-text :deep(*) {
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

.message-text :deep(li),
.message-text :deep(ul),
.message-text :deep(ol),
.message-text :deep(blockquote),
.message-text :deep(table),
.message-text :deep(td),
.message-text :deep(th),
.message-text :deep(strong),
.message-text :deep(em),
.message-text :deep(span),
.message-text :deep(div) {
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

.message-metadata {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--n-border-color);
}

/* Worker 输出样式已移至 WorkerOutputWindow 组件 */

.worker-exit-reason {
  margin-bottom: 8px;
  padding: 8px;
  background: rgba(250, 173, 20, 0.1);
  border-left: 3px solid #faad14;
  border-radius: 4px;
}
</style>
