<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * Orchestration Panel - Main panel for AI agent collaboration.
 * Combines AgentStatusHeader, TimelineView, and PermissionRequestCard.
 * Replaces the old DualAgentPanel with improved UI/UX.
 -->

<template>
  <div class="orchestration-panel">
    <!-- No Session State -->
    <div v-if="!session" class="no-session-state">
      <n-empty description="Session not found">
        <template #extra>
          <n-text depth="3">The session may have been deleted or not yet created.</n-text>
        </template>
      </n-empty>
    </div>
    
    <template v-else>
      <!-- Agent Status Header -->
      <AgentStatusHeader
        :session="session"
        @pause="handlePause"
        @resume="handleResume"
        @stop="handleStop"
      />
      
      <!-- Main Content -->
      <div class="panel-content" style="user-select: text !important; -webkit-user-select: text !important; -moz-user-select: text !important; -ms-user-select: text !important;">
        <!-- Timeline View -->
        <TimelineView :session="session" />
      </div>
      
      <!-- Usage Stats Bar -->
      <div v-if="session.usage" class="usage-bar">
        <div class="usage-item">
          <n-icon size="12"><component :is="svgIcons.zap" /></n-icon>
          <span>{{ formatTokens(session.usage.total.totalTokens) }} tokens</span>
        </div>
        <div class="usage-item">
          <n-icon size="12"><component :is="svgIcons.tool" /></n-icon>
          <span>{{ session.toolExecutions?.length || 0 }} tools</span>
        </div>
      </div>
      
      <!-- Permission Requests -->
      <div v-if="pendingPermissions.length > 0" class="permissions-area">
        <PermissionRequestCard
          v-for="perm in pendingPermissions"
          :key="perm.id"
          :request="perm"
          @allow="handlePermissionAllow"
          @deny="handlePermissionDeny"
          @always="handlePermissionAlways"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NEmpty, NText, NIcon, useMessage } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useDualAgentStore } from '../../stores/dualAgent';
import AgentStatusHeader from './AgentStatusHeader.vue';
import TimelineView from './TimelineView.vue';
import PermissionRequestCard from './PermissionRequestCard.vue';
import { svgIcons } from '../../utils/icons';

const props = defineProps<{
  sessionId: string;
}>();

const { t } = useI18n();
const message = useMessage();
const dualAgentStore = useDualAgentStore();

// Session
const session = computed(() => dualAgentStore.getSession(props.sessionId));
const pendingPermissions = computed(() => dualAgentStore.pendingPermissions);

// Actions
const handlePause = async () => {
  await dualAgentStore.pauseSession(props.sessionId);
  message.info(t('aiCollab.paused'));
};

const handleResume = async () => {
  await dualAgentStore.resumeSession(props.sessionId);
  message.success(t('aiCollab.resumed'));
};

const handleStop = async () => {
  await dualAgentStore.stopSession(props.sessionId);
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

// Helpers
const formatTokens = (tokens: number): string => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
};
</script>

<style scoped>
.orchestration-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--n-color);
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

.no-session-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 32px;
}

.panel-content {
  flex: 1;
  overflow: hidden;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

/* Usage Stats Bar */
.usage-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--n-color-embedded);
  border-top: 1px solid var(--n-border-color);
  font-size: 11px;
  color: var(--n-text-color-3);
}

.usage-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.usage-breakdown {
  display: flex;
  gap: 12px;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.breakdown-label {
  font-weight: 600;
  color: var(--n-text-color-2);
}

/* Permissions Area */
.permissions-area {
  padding: 12px 16px;
  background: rgba(250, 173, 20, 0.05);
  border-top: 1px solid rgba(250, 173, 20, 0.2);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
