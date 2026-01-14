<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * Panel showing Supervisor-Worker dual agent conversation.
 * Only displays key conversation points, not intermediate thinking.
 -->

<template>
  <div class="dual-agent-panel">
    <!-- No Session State -->
    <div v-if="!session" class="no-session-state">
      <n-empty description="Session not found">
        <template #extra>
          <n-text depth="3">The session may have been deleted or not yet created.</n-text>
        </template>
      </n-empty>
    </div>
    
    <template v-else>
    <!-- Header -->
    <div class="panel-header">
      <div class="session-info">
        <n-tag :type="statusTagType" size="small">
          {{ statusText }}
        </n-tag>
        <span class="project-path" :title="session?.projectPath">
          {{ truncatePath(session?.projectPath || '') }}
        </span>
        <n-tag v-if="session" type="info" size="small">
          Round {{ session.loop.currentRound }}/{{ session.loop.maxRounds }}
        </n-tag>
      </div>
      <div class="header-actions">
        <n-button-group size="small">
          <n-button 
            v-if="session?.status === 'running'"
            type="warning"
            @click="handlePause"
          >
            <template #icon>
              <component :is="iconComponents.pause" />
            </template>
            {{ t('aiCollab.pause') }}
          </n-button>
          <n-button 
            v-else-if="session?.status === 'paused'"
            type="primary"
            @click="handleResume"
          >
            <template #icon>
              <component :is="iconComponents.play" />
            </template>
            {{ t('aiCollab.resume') }}
          </n-button>
          <n-button 
            v-if="session?.status === 'running' || session?.status === 'paused'"
            type="error"
            @click="handleStop"
          >
            <template #icon>
              <component :is="iconComponents.stop(true)" />
            </template>
            {{ t('aiCollab.stop') }}
          </n-button>
        </n-button-group>
      </div>
    </div>
    
    <!-- Task Goal Summary -->
    <div v-if="session?.goal" class="goal-section">
      <div class="goal-header" @click="goalExpanded = !goalExpanded">
        <n-icon size="14">
          <component :is="goalExpanded ? svgIcons.chevronDown : svgIcons.chevronRight" />
        </n-icon>
        <span>{{ t('aiCollab.taskGoal') }}: {{ session.goal.objective }}</span>
      </div>
      <n-collapse-transition :show="goalExpanded">
        <div class="goal-details">
          <div class="criteria-section">
            <strong>{{ t('aiCollab.acceptanceCriteria') }}:</strong>
            <ul>
              <li 
                v-for="(criterion, index) in session.goal.acceptanceCriteria" 
                :key="index"
                :class="{ completed: isCriterionMet(index) }"
              >
                <n-icon v-if="isCriterionMet(index)" color="#52c41a" size="14">
                  <component :is="svgIcons.check" />
                </n-icon>
                {{ criterion }}
              </li>
            </ul>
          </div>
        </div>
      </n-collapse-transition>
    </div>
    
    <!-- Progress Bar -->
    <div v-if="session" class="progress-section">
      <div class="progress-info">
        <span>{{ session.progress.currentAction }}</span>
        <span>{{ session.progress.completedMilestones.length }} {{ t('aiCollab.milestonesCompleted') }}</span>
      </div>
      <n-progress
        type="line"
        :percentage="progressPercentage"
        :status="progressStatus"
        :show-indicator="false"
      />
    </div>
    
    <!-- Conversation -->
    <div class="conversation-container" ref="conversationRef">
      <n-scrollbar ref="scrollbarRef">
        <div class="conversation-list">
          <template v-for="message in session?.conversation || []" :key="message.id">
            <div 
              class="message-item"
              :class="[`from-${message.from}`, `type-${message.type}`]"
            >
              <!-- Agent Avatar -->
              <div class="message-avatar">
                <n-avatar 
                  size="small"
                  round
                  :style="{ backgroundColor: getAvatarColor(message.from) }"
                >
                  {{ getAvatarText(message.from) }}
                </n-avatar>
              </div>
              
              <!-- Message Content -->
              <div class="message-content">
                <div class="message-header">
                  <span class="message-sender">{{ getSenderName(message.from) }}</span>
                  <n-tag :type="getMessageTypeTag(message.type)" size="tiny">
                    {{ getMessageTypeText(message.type) }}
                  </n-tag>
                  <span class="message-time">{{ formatTime(message.timestamp) }}</span>
                </div>
                <div class="message-body">
                  <div class="message-text" v-html="renderMarkdown(message.content)"></div>
                  
                  <!-- Metadata -->
                  <div v-if="message.metadata" class="message-metadata">
                    <n-tag 
                      v-if="message.metadata.filesChanged?.length"
                      size="tiny"
                      type="info"
                    >
                      {{ message.metadata.filesChanged.length }} files changed
                    </n-tag>
                    <n-tag 
                      v-if="message.metadata.commandsRun?.length"
                      size="tiny"
                      type="warning"
                    >
                      {{ message.metadata.commandsRun.length }} commands run
                    </n-tag>
                    <n-tag 
                      v-if="message.metadata.isKeyPoint"
                      size="tiny"
                      type="success"
                    >
                      Key Point
                    </n-tag>
                  </div>
                </div>
              </div>
            </div>
          </template>
          
          <!-- Running Indicator -->
          <div v-if="session?.status === 'running'" class="running-indicator">
            <n-spin size="small" />
            <span>{{ getRunningText() }}</span>
          </div>
          
          <!-- Empty State -->
          <div v-if="!session?.conversation?.length && session?.status !== 'running'" class="empty-state">
            <n-empty :description="t('aiCollab.noConversation')">
              <template #extra>
                <n-text depth="3">{{ t('aiCollab.waitingToStart') }}</n-text>
              </template>
            </n-empty>
          </div>
        </div>
      </n-scrollbar>
    </div>
    
    <!-- Usage Stats -->
    <div v-if="session?.usage" class="usage-bar">
      <span>Tokens: {{ session.usage.total.totalTokens.toLocaleString() }}</span>
      <span class="usage-detail">
        (Supervisor: {{ session.usage.supervisor.totalTokens.toLocaleString() }} | 
        Worker: {{ session.usage.worker.totalTokens.toLocaleString() }})
      </span>
    </div>
    
    <!-- Permission Request Area -->
    <div v-if="pendingPermissions.length > 0" class="permission-area">
      <div v-for="perm in pendingPermissions" :key="perm.id" class="permission-item">
        <div class="permission-header">
          <n-icon size="18" color="#faad14">
            <component :is="svgIcons.warning" />
          </n-icon>
          <span>{{ t('aiCollab.permissionRequired') }}</span>
        </div>
        <p class="permission-description">{{ getPermissionDescription(perm) }}</p>
        <div class="permission-actions">
          <n-button size="small" @click="handlePermissionDeny(perm.id!)">
            {{ t('common.deny') }}
          </n-button>
          <n-button size="small" type="primary" @click="handlePermissionAllow(perm.id!)">
            {{ t('common.allow') }}
          </n-button>
          <n-button size="small" type="info" @click="handlePermissionAlways(perm.id!)">
            {{ t('aiCollab.alwaysAllow') }}
          </n-button>
        </div>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import {
  NButton,
  NButtonGroup,
  NTag,
  NAvatar,
  NScrollbar,
  NEmpty,
  NText,
  NIcon,
  NProgress,
  NSpin,
  NCollapseTransition,
  useMessage,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useDualAgentStore } from '../stores/dualAgent';
import type { AgentRole, AgentMessageType } from '../services/ai/agents/types';
import type { PermissionRequest } from '../services/ai/types';
import { iconComponents, svgIcons } from '../utils/icons';
import { renderMarkdown } from '../utils/markdown';

const props = defineProps<{
  sessionId: string;
}>();

const { t } = useI18n();
const message = useMessage();
const dualAgentStore = useDualAgentStore();

const scrollbarRef = ref<InstanceType<typeof NScrollbar> | null>(null);
const conversationRef = ref<HTMLElement | null>(null);
const goalExpanded = ref(false);

// Session
const session = computed(() => dualAgentStore.getSession(props.sessionId));
const pendingPermissions = computed(() => dualAgentStore.pendingPermissions);

// Status
const statusTagType = computed(() => {
  switch (session.value?.status) {
    case 'running': return 'success';
    case 'completed': return 'info';
    case 'error': return 'error';
    case 'paused': return 'warning';
    default: return 'default';
  }
});

const statusText = computed(() => {
  switch (session.value?.status) {
    case 'idle': return t('aiCollab.statusIdle');
    case 'initializing': return t('aiCollab.statusInitializing');
    case 'running': return t('aiCollab.statusRunning');
    case 'paused': return t('aiCollab.statusPaused');
    case 'completed': return t('aiCollab.statusCompleted');
    case 'error': return t('aiCollab.statusFailed');
    default: return t('aiCollab.statusUnknown');
  }
});

const progressPercentage = computed(() => {
  if (!session.value) return 0;
  const { currentStep, totalSteps } = session.value.progress;
  return Math.min(100, Math.round((currentStep / totalSteps) * 100));
});

const progressStatus = computed(() => {
  switch (session.value?.status) {
    case 'completed': return 'success';
    case 'error': return 'error';
    default: return 'default';
  }
});

// Methods
const truncatePath = (path: string): string => {
  if (path.length <= 40) return path;
  const parts = path.split('/');
  if (parts.length <= 3) return path;
  return `.../${parts.slice(-2).join('/')}`;
};

const getAvatarColor = (from: AgentRole): string => {
  return from === 'supervisor' ? '#722ed1' : '#1890ff';
};

const getAvatarText = (from: AgentRole): string => {
  return from === 'supervisor' ? 'S' : 'W';
};

const getSenderName = (from: AgentRole): string => {
  return from === 'supervisor' ? t('aiCollab.supervisor') : t('aiCollab.worker');
};

const getMessageTypeTag = (type: AgentMessageType): 'default' | 'info' | 'success' | 'warning' | 'error' => {
  switch (type) {
    case 'instruction': return 'info';
    case 'report': return 'default';
    case 'decision': return 'warning';
    case 'completion': return 'success';
    case 'error': return 'error';
    default: return 'default';
  }
};

const getMessageTypeText = (type: AgentMessageType): string => {
  switch (type) {
    case 'instruction': return t('aiCollab.instruction');
    case 'report': return t('aiCollab.report');
    case 'decision': return t('aiCollab.decision');
    case 'completion': return t('aiCollab.completion');
    case 'error': return t('aiCollab.errorMsg');
    default: return type;
  }
};

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString();
};


const isCriterionMet = (_index: number): boolean => {
  // This is a placeholder - in a real implementation,
  // we'd track which criteria have been met
  return false;
};

const getRunningText = (): string => {
  if (!session.value) return '';
  const { supervisorState, workerState } = session.value;
  if (workerState === 'running') {
    return t('aiCollab.workerExecuting');
  }
  if (supervisorState === 'running') {
    return t('aiCollab.supervisorThinking');
  }
  return t('aiCollab.processing');
};

const getPermissionDescription = (perm: PermissionRequest): string => {
  switch (perm.type) {
    case 'read': return `Read: ${perm.path || perm.patterns?.join(', ')}`;
    case 'write': return `Write: ${perm.path}`;
    case 'edit': return `Edit: ${perm.path}`;
    case 'bash': return `Execute: ${perm.command}`;
    default: return `${perm.type}: ${perm.path || perm.command}`;
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (scrollbarRef.value) {
      try {
        // Try to access the scroll container through the scrollbar ref
        const scrollbarEl = scrollbarRef.value.$el;
        let container: HTMLElement | null = null;
        
        // Check if $el is a DOM element with querySelector
        if (scrollbarEl && typeof scrollbarEl.querySelector === 'function') {
          container = scrollbarEl.querySelector('.n-scrollbar-container');
        } else if (conversationRef.value) {
          // Fallback: find the container through the parent ref
          container = conversationRef.value.querySelector('.n-scrollbar-container');
        }
        
        if (container) {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
      } catch (error) {
        // Silently handle errors to prevent unhandled promise rejections
        console.warn('Failed to scroll to bottom:', error);
      }
    }
  });
};

// Actions
const handlePause = () => {
  dualAgentStore.pauseSession(props.sessionId);
  message.info(t('aiCollab.paused'));
};

const handleResume = async () => {
  await dualAgentStore.resumeSession(props.sessionId);
  message.success(t('aiCollab.resumed'));
};

const handleStop = () => {
  dualAgentStore.stopSession(props.sessionId);
  message.info(t('aiCollab.stopped'));
};

const handlePermissionAllow = (requestId: string) => {
  dualAgentStore.replyPermission(requestId, 'allow');
};

const handlePermissionDeny = (requestId: string) => {
  dualAgentStore.replyPermission(requestId, 'deny');
};

const handlePermissionAlways = (requestId: string) => {
  dualAgentStore.replyPermission(requestId, 'always');
};

// Watch for new messages
watch(
  () => session.value?.conversation?.length,
  () => scrollToBottom()
);

// Initial scroll
onMounted(() => {
  scrollToBottom();
});
</script>

<style scoped>
.dual-agent-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--n-color);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--n-border-color);
}

.session-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.project-path {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.goal-section {
  padding: 8px 16px;
  background: var(--n-color-embedded);
  border-bottom: 1px solid var(--n-border-color);
}

.goal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.goal-details {
  padding: 12px 0 4px 22px;
}

.criteria-section ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

.criteria-section li {
  margin-bottom: 4px;
  font-size: 12px;
}

.criteria-section li.completed {
  color: #52c41a;
  text-decoration: line-through;
}

.progress-section {
  padding: 8px 16px;
  border-bottom: 1px solid var(--n-border-color);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--n-text-color-3);
  margin-bottom: 4px;
}

.conversation-container {
  flex: 1;
  overflow: hidden;
}

.conversation-list {
  padding: 16px;
}

.message-item {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.message-item.from-supervisor {
  flex-direction: row;
}

.message-item.from-worker {
  flex-direction: row-reverse;
}

.message-item.from-worker .message-content {
  align-items: flex-end;
}

.message-item.from-worker .message-header {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.message-content {
  display: flex;
  flex-direction: column;
  max-width: 80%;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.message-sender {
  font-weight: 500;
  font-size: 12px;
}

.message-time {
  font-size: 10px;
  color: var(--n-text-color-3);
}

.message-body {
  background: var(--n-color-embedded);
  padding: 10px 14px;
  border-radius: 12px;
}

.message-item.from-supervisor .message-body {
  border-top-left-radius: 4px;
  background: rgba(114, 46, 209, 0.1);
}

.message-item.from-worker .message-body {
  border-top-right-radius: 4px;
  background: rgba(24, 144, 255, 0.1);
}

.message-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--n-text-color);
}

.message-text :deep(h1),
.message-text :deep(h2),
.message-text :deep(h3),
.message-text :deep(h4),
.message-text :deep(h5),
.message-text :deep(h6) {
  margin: 12px 0 6px 0;
  font-weight: 600;
  line-height: 1.25;
  color: var(--n-text-color);
}

.message-text :deep(h1) { font-size: 1.4em; }
.message-text :deep(h2) { font-size: 1.3em; }
.message-text :deep(h3) { font-size: 1.1em; }
.message-text :deep(h4) { font-size: 1em; }
.message-text :deep(h5) { font-size: 0.9em; }
.message-text :deep(h6) { font-size: 0.85em; }

.message-text :deep(p) {
  margin: 0 0 6px 0;
}

.message-text :deep(p:last-child) {
  margin-bottom: 0;
}

.message-text :deep(ul),
.message-text :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
}

.message-text :deep(li) {
  margin: 3px 0;
}

.message-text :deep(blockquote) {
  margin: 6px 0;
  padding: 6px 10px;
  border-left: 3px solid var(--n-border-color);
  background: rgba(0, 0, 0, 0.05);
  color: var(--n-text-color-2);
}

.message-text :deep(pre) {
  background: rgba(0, 0, 0, 0.1);
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 6px 0;
}

.message-text :deep(code) {
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
}

.message-text :deep(pre code) {
  background: transparent;
  padding: 0;
}

.message-text :deep(a) {
  color: var(--n-primary-color);
  text-decoration: none;
}

.message-text :deep(a:hover) {
  text-decoration: underline;
}

.message-text :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 6px 0;
  font-size: 12px;
}

.message-text :deep(th),
.message-text :deep(td) {
  border: 1px solid var(--n-border-color);
  padding: 4px 8px;
  text-align: left;
}

.message-text :deep(th) {
  background: var(--n-color-embedded);
  font-weight: 600;
}

.message-text :deep(hr) {
  border: none;
  border-top: 1px solid var(--n-border-color);
  margin: 12px 0;
}

.message-text :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 6px 0;
}

.message-metadata {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}

.running-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  color: var(--n-text-color-3);
  font-size: 12px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.usage-bar {
  display: flex;
  gap: 12px;
  padding: 6px 16px;
  background: var(--n-color-embedded);
  font-size: 11px;
  color: var(--n-text-color-3);
  border-top: 1px solid var(--n-border-color);
}

.usage-detail {
  opacity: 0.7;
}

.permission-area {
  padding: 12px 16px;
  background: rgba(250, 173, 20, 0.1);
  border-top: 1px solid rgba(250, 173, 20, 0.3);
}

.permission-item {
  padding: 12px;
  background: var(--n-color);
  border-radius: 6px;
}

.permission-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  margin-bottom: 8px;
}

.permission-description {
  margin: 0 0 12px 0;
  font-size: 13px;
}

.permission-actions {
  display: flex;
  gap: 8px;
}
</style>
