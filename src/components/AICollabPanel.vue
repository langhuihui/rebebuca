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
  <div class="ai-collab-panel">
    <!-- 头部状态栏 -->
    <div class="panel-header">
      <div class="session-info">
        <n-tag :type="sessionStatusType" size="small">
          {{ sessionStatusText }}
        </n-tag>
        <span class="project-path" :title="session?.projectPath">
          {{ truncatePath(session?.projectPath || '') }}
        </span>
      </div>
      <div class="header-actions">
        <n-button-group size="small">
          <n-button 
            v-if="session?.status === 'idle'"
            type="primary"
            @click="handleStart"
          >
            <template #icon>
              <component :is="iconComponents.play" />
            </template>
            {{ t('aiCollab.start') }}
          </n-button>
          <n-button 
            v-else-if="session?.status === 'running'"
            type="error"
            @click="handleStop"
          >
            <template #icon>
              <component :is="iconComponents.stop" />
            </template>
            {{ t('aiCollab.stop') }}
          </n-button>
          <n-button @click="handleSettings">
            <template #icon>
              <component :is="iconComponents.settings" />
            </template>
          </n-button>
        </n-button-group>
      </div>
    </div>
    
    <!-- 消息列表 -->
    <div class="message-list" ref="messageListRef">
      <n-scrollbar ref="scrollbarRef">
        <div class="messages-container">
          <div 
            v-for="message in session?.messages || []" 
            :key="message.id"
            class="message-item"
            :class="[`from-${message.from}`, `type-${message.type}`]"
          >
            <div class="message-avatar">
              <n-avatar 
                size="small" 
                :style="{ backgroundColor: getAvatarColor(message.from) }"
              >
                {{ getAvatarText(message.from) }}
              </n-avatar>
            </div>
            <div class="message-content">
              <div class="message-header">
                <span class="message-sender">{{ getSenderName(message.from) }}</span>
                <span class="message-time">{{ formatTime(message.timestamp) }}</span>
              </div>
              <div class="message-body">
                <template v-if="message.type === 'decision_request'">
                  <div class="decision-request">
                    <p class="decision-question">{{ message.content }}</p>
                    <div v-if="message.metadata?.options" class="decision-options">
                      <n-tag 
                        v-for="option in message.metadata.options" 
                        :key="option"
                        size="small"
                      >
                        {{ option }}
                      </n-tag>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <pre class="message-text">{{ message.content }}</pre>
                </template>
              </div>
            </div>
          </div>
          
          <!-- 空状态 -->
          <div v-if="!session?.messages?.length" class="empty-messages">
            <n-empty :description="t('aiCollab.noMessages')">
              <template #extra>
                <n-text depth="3">{{ t('aiCollab.startHint') }}</n-text>
              </template>
            </n-empty>
          </div>
        </div>
      </n-scrollbar>
    </div>
    
    <!-- 决策倒计时区域 -->
    <div v-if="session?.pendingDecision" class="decision-timer-area">
      <div class="decision-content">
        <div class="decision-header">
          <n-icon size="20" color="#faad14">
            <component :is="svgIcons.warning" />
          </n-icon>
          <span>{{ t('aiCollab.decisionRequired') }}</span>
        </div>
        <p class="decision-question">{{ session.pendingDecision.question }}</p>
        <div v-if="session.pendingDecision.options" class="decision-options">
          <n-button 
            v-for="option in session.pendingDecision.options"
            :key="option"
            size="small"
            @click="handleUserDecide(option)"
          >
            {{ option }}
          </n-button>
        </div>
        <div class="decision-timer">
          <n-progress
            type="line"
            :percentage="timerPercentage"
            :show-indicator="false"
            :height="4"
            :status="timerPercentage < 30 ? 'error' : 'success'"
          />
          <div class="timer-info">
            <span>{{ t('aiCollab.autoDecisionIn', { seconds: remainingTime }) }}</span>
            <n-button size="tiny" text @click="handleCancelTimer">
              {{ t('aiCollab.cancelTimer') }}
            </n-button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 输入区域 -->
    <div class="input-area">
      <div class="send-targets">
        <n-checkbox-group v-model:value="sendTargets" class="target-checkbox-group">
          <!-- Supervisor -->
          <div class="target-item">
            <n-checkbox value="supervisor" size="small">
              <div class="target-content">
                <n-avatar size="tiny" :style="{ backgroundColor: '#722ed1' }">S</n-avatar>
                <span>{{ t('aiCollab.supervisor') }}</span>
                <n-tag v-if="session?.supervisor" :type="agentStatusType(session.supervisor.status)" size="tiny">
                  {{ agentStatusText(session.supervisor.status) }}
                </n-tag>
              </div>
            </n-checkbox>
            <n-button 
              size="tiny" 
              text 
              @click.stop="openAgentConfigModal('supervisor')"
              class="config-btn"
            >
              <n-icon size="14"><component :is="svgIcons.settings" /></n-icon>
            </n-button>
          </div>
          
          <!-- Workers -->
          <div 
            v-for="(worker, index) in (session?.workers || [])" 
            :key="worker.id || index"
            class="target-item"
          >
            <n-checkbox :value="`worker-${index}`" size="small">
              <div class="target-content">
                <n-avatar size="tiny" :style="{ backgroundColor: getWorkerColor(index) }">W{{ index + 1 }}</n-avatar>
                <span>{{ t('aiCollab.worker') }} #{{ index + 1 }}</span>
                <n-tag :type="agentStatusType(worker.status)" size="tiny">
                  {{ agentStatusText(worker.status) }}
                </n-tag>
                <n-tag v-if="worker.busy" type="warning" size="tiny">
                  {{ t('aiCollab.busy') }}
                </n-tag>
              </div>
            </n-checkbox>
            <n-button 
              size="tiny" 
              text 
              @click.stop="openAgentConfigModal('worker', index)"
              class="config-btn"
            >
              <n-icon size="14"><component :is="svgIcons.settings" /></n-icon>
            </n-button>
          </div>
        </n-checkbox-group>
        
        <!-- 添加 Worker 按钮 -->
        <n-button 
          size="tiny" 
          dashed 
          @click="handleAddWorker"
          class="add-worker-inline-btn"
        >
          <template #icon>
            <n-icon size="12"><component :is="svgIcons.plus" /></n-icon>
          </template>
          {{ t('aiCollab.addWorker') }}
        </n-button>
      </div>
      <n-input-group>
        <n-input
          v-model:value="inputMessage"
          :placeholder="t('aiCollab.inputPlaceholder')"
          @keyup.enter="handleSend"
        />
        <n-button type="primary" @click="handleSend" :disabled="!inputMessage.trim() || sendTargets.length === 0">
          <template #icon>
            <component :is="iconComponents.send" />
          </template>
        </n-button>
      </n-input-group>
    </div>
    
    <!-- 设置对话框 -->
    <n-modal v-model:show="showSettingsModal" preset="card" :title="t('aiCollab.settings')" style="width: 500px">
      <n-form label-placement="left" label-width="120">
        <n-form-item :label="t('aiCollab.autoDecision')">
          <n-switch v-model:value="settingsForm.autoDecision" />
        </n-form-item>
        <n-form-item :label="t('aiCollab.decisionTimeout')">
          <n-input-number v-model:value="settingsForm.decisionTimeout" :min="10" :max="300" />
          <span style="margin-left: 8px">{{ t('aiCollab.seconds') }}</span>
        </n-form-item>
        <n-form-item :label="t('aiCollab.maxIterations')">
          <n-input-number v-model:value="settingsForm.maxIterations" :min="1" :max="100" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showSettingsModal = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" @click="handleSaveSettings">{{ t('common.save') }}</n-button>
        </n-space>
      </template>
    </n-modal>
    
    <!-- Agent 配置对话框 -->
    <n-modal v-model:show="showAgentConfigModal" preset="card" :title="agentConfigTitle" style="width: 700px; max-height: 80vh;">
      <n-tabs v-model:value="agentConfigTab" type="line">
        <!-- 配置 Tab -->
        <n-tab-pane name="config" :tab="t('aiCollab.configTab')">
          <n-form label-placement="left" label-width="120">
            <n-form-item :label="t('aiCollab.agentType')">
              <n-radio-group v-model:value="agentConfigForm.type">
                <n-radio value="ai-tool">{{ t('aiCollab.agentTypeAITool') }}</n-radio>
                <n-radio value="custom-cli">{{ t('aiCollab.agentTypeCustomCLI') }}</n-radio>
              </n-radio-group>
            </n-form-item>
            
            <template v-if="agentConfigForm.type === 'ai-tool'">
              <n-form-item :label="t('aiCollab.selectAITool')">
                <n-select
                  v-model:value="agentConfigForm.aiTool"
                  :options="aiToolOptions"
                  :render-label="renderAIToolLabel"
                />
              </n-form-item>
            </template>
            
            <template v-else>
              <n-form-item :label="t('aiCollab.customCommand')">
                <n-input
                  v-model:value="agentConfigForm.command"
                  :placeholder="t('task.commandPlaceholder')"
                />
              </n-form-item>
              <n-form-item :label="t('task.cwd')">
                <n-input
                  v-model:value="agentConfigForm.cwd"
                  :placeholder="t('task.cwdPlaceholder')"
                />
              </n-form-item>
            </template>
          </n-form>
        </n-tab-pane>
        
        <!-- 终端 Tab -->
        <n-tab-pane name="terminal" :tab="t('aiCollab.terminalTab')">
          <div class="agent-terminal-container">
            <div v-if="currentAgentPtyId" class="terminal-wrapper">
              <div ref="agentTerminalRef" class="agent-terminal"></div>
            </div>
            <div v-else class="terminal-empty">
              <n-empty :description="t('aiCollab.agentNotRunning')">
                <template #extra>
                  <n-text depth="3">{{ t('aiCollab.startAgentHint') }}</n-text>
                </template>
              </n-empty>
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showAgentConfigModal = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" @click="handleSaveAgentConfig">{{ t('common.save') }}</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, h } from 'vue';
import {
  NButton,
  NButtonGroup,
  NTag,
  NAvatar,
  NBadge,
  NScrollbar,
  NEmpty,
  NText,
  NIcon,
  NProgress,
  NInput,
  NInputGroup,
  NCheckbox,
  NCheckboxGroup,
  NModal,
  NForm,
  NFormItem,
  NSwitch,
  NInputNumber,
  NSpace,
  NRadio,
  NRadioGroup,
  NSelect,
  NTooltip,
  NTabs,
  NTabPane,
  useMessage,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useAICollabStore } from '../stores/aiCollab';
import { useAIToolsStore, AI_TOOL_METADATA, type AIToolType } from '../stores/aiTools';
import { iconComponents, svgIcons } from '../utils/icons';
import type { AgentStatus, MessageFrom, AgentRole, AgentConfig } from '../types/aiCollab';

const props = defineProps<{
  sessionId: string;
}>();

const { t } = useI18n();
const message = useMessage();
const collabStore = useAICollabStore();
const aiToolsStore = useAIToolsStore();

const scrollbarRef = ref<InstanceType<typeof NScrollbar> | null>(null);
const messageListRef = ref<HTMLElement | null>(null);
const inputMessage = ref('');
// 发送目标: 'supervisor' | 'worker-0' | 'worker-1' ...
const sendTargets = ref<string[]>(['supervisor', 'worker-0']);
const showSettingsModal = ref(false);
const settingsForm = ref({
  autoDecision: true,
  decisionTimeout: 60,
  maxIterations: 10,
});

// Agent 配置对话框状态
const showAgentConfigModal = ref(false);
const agentConfigTab = ref<'config' | 'terminal'>('config');
const currentAgentRole = ref<AgentRole>('supervisor');
const agentConfigForm = ref<{
  type: 'ai-tool' | 'custom-cli';
  aiTool?: AIToolType;
  command?: string;
  cwd?: string;
}>({
  type: 'ai-tool',
  aiTool: 'claude-code',
  command: '',
  cwd: '',
});

// 终端相关
const agentTerminalRef = ref<HTMLElement | null>(null);
let agentTerminal: any = null;
let agentTerminalFitAddon: any = null;
let agentTerminalUnlisten: (() => void) | null = null;

// AI 工具选项
const aiToolOptions = computed(() => {
  return Object.entries(AI_TOOL_METADATA).map(([key, meta]) => ({
    label: meta.name,
    value: key as AIToolType,
    logo: aiToolsStore.getToolLogoUrl(key as AIToolType),
  }));
});

// 渲染 AI 工具选项标签
const renderAIToolLabel = (option: { label: string; value: AIToolType; logo?: string }) => {
  return h('div', { style: 'display: flex; align-items: center; gap: 8px;' }, [
    option.logo
      ? h('img', {
          src: option.logo,
          style: 'width: 20px; height: 20px; border-radius: 4px; object-fit: contain;',
        })
      : null,
    h('span', option.label),
  ]);
};

// Agent 配置对话框标题
const agentConfigTitle = computed(() => {
  if (currentAgentRole.value === 'supervisor') {
    return t('aiCollab.supervisorConfig');
  }
  const idx = currentWorkerIndex.value ?? 0;
  const isNew = idx >= (session.value?.workers?.length || 0);
  return isNew 
    ? t('aiCollab.addWorkerConfig') 
    : t('aiCollab.workerConfigN', { n: idx + 1 });
});

// 获取当前 Agent 的 PTY ID
const currentAgentPtyId = computed(() => {
  if (!session.value) return null;
  if (currentAgentRole.value === 'supervisor') {
    return session.value.supervisor?.ptyId || null;
  } else {
    const idx = currentWorkerIndex.value ?? 0;
    return session.value.workers[idx]?.ptyId || null;
  }
});

// Agent 存活状态
const supervisorAlive = ref(false);
const workersAlive = ref<boolean[]>([]);
let aliveCheckInterval: ReturnType<typeof setInterval> | null = null;

// 当前编辑的 worker 索引
const currentWorkerIndex = ref<number | undefined>(undefined);

// 计算属性
const session = computed(() => collabStore.sessions.get(props.sessionId));

const sessionStatusType = computed(() => {
  switch (session.value?.status) {
    case 'running': return 'success';
    case 'completed': return 'info';
    case 'failed': return 'error';
    case 'paused': return 'warning';
    default: return 'default';
  }
});

const sessionStatusText = computed(() => {
  switch (session.value?.status) {
    case 'idle': return t('aiCollab.statusIdle');
    case 'running': return t('aiCollab.statusRunning');
    case 'paused': return t('aiCollab.statusPaused');
    case 'completed': return t('aiCollab.statusCompleted');
    case 'failed': return t('aiCollab.statusFailed');
    default: return t('aiCollab.statusUnknown');
  }
});

const remainingTime = computed(() => {
  if (!session.value?.pendingDecision) return 0;
  return collabStore.getDecisionRemainingTime(session.value.pendingDecision.id);
});

const timerPercentage = computed(() => {
  if (!session.value?.pendingDecision) return 100;
  const total = session.value.pendingDecision.timeout;
  return (remainingTime.value / total) * 100;
});

// 方法
const truncatePath = (path: string): string => {
  if (path.length <= 40) return path;
  const parts = path.split('/');
  if (parts.length <= 3) return path;
  return `.../${parts.slice(-2).join('/')}`;
};

const agentStatusType = (status: AgentStatus): 'success' | 'warning' | 'error' | 'info' | 'default' => {
  switch (status) {
    case 'running': return 'success';
    case 'starting': return 'warning';
    case 'waiting': return 'info';
    case 'stopped': return 'default';
    case 'error': return 'error';
    default: return 'default';
  }
};

const agentStatusText = (status: AgentStatus): string => {
  switch (status) {
    case 'idle': return t('aiCollab.agentIdle');
    case 'starting': return t('aiCollab.agentStarting');
    case 'running': return t('aiCollab.agentRunning');
    case 'waiting': return t('aiCollab.agentWaiting');
    case 'stopped': return t('aiCollab.agentStopped');
    case 'error': return t('aiCollab.agentError');
    default: return status;
  }
};

const getAvatarColor = (from: MessageFrom): string => {
  switch (from) {
    case 'supervisor': return '#722ed1';
    case 'worker': return '#13c2c2';
    case 'user': return '#1890ff';
    case 'system': return '#8c8c8c';
    default: return '#d9d9d9';
  }
};

const getAvatarText = (from: MessageFrom): string => {
  switch (from) {
    case 'supervisor': return 'S';
    case 'worker': return 'W';
    case 'user': return 'U';
    case 'system': return '⚙';
    default: return '?';
  }
};

const getSenderName = (from: MessageFrom): string => {
  switch (from) {
    case 'supervisor': return t('aiCollab.supervisor');
    case 'worker': return t('aiCollab.worker');
    case 'user': return t('aiCollab.user');
    case 'system': return t('aiCollab.system');
    default: return from;
  }
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

const scrollToBottom = () => {
  nextTick(() => {
    if (scrollbarRef.value) {
      // Use the NScrollbar's built-in scrollTo method to scroll to bottom
      scrollbarRef.value.scrollTo({ position: 'bottom', behavior: 'smooth' });
    }
  });
};

const checkAgentAlive = async () => {
  if (!props.sessionId) return;
  const result = await collabStore.checkAgentAlive(props.sessionId);
  supervisorAlive.value = result.supervisor;
  workersAlive.value = result.workers;
};

// 获取 Worker 颜色
const getWorkerColor = (index: number): string => {
  const colors = ['#13c2c2', '#52c41a', '#fa8c16', '#eb2f96', '#2f54eb', '#722ed1'];
  return colors[index % colors.length];
};

// 事件处理
const handleStart = async () => {
  try {
    await collabStore.startSession(props.sessionId);
    message.success(t('aiCollab.startSuccess'));
  } catch (error) {
    message.error(t('aiCollab.startFailed', { error: String(error) }));
  }
};

const handleStop = async () => {
  try {
    await collabStore.stopSession(props.sessionId);
    message.info(t('aiCollab.stopped'));
  } catch (error) {
    message.error(t('aiCollab.stopFailed', { error: String(error) }));
  }
};

const handleRestartAgent = async (role: 'supervisor' | 'worker', workerIndex?: number) => {
  try {
    await collabStore.restartAgent(props.sessionId, role, workerIndex);
    const label = role === 'supervisor' ? role : `worker #${(workerIndex ?? 0) + 1}`;
    message.success(t('aiCollab.restartSuccess', { role: label }));
  } catch (error) {
    message.error(t('aiCollab.restartFailed', { error: String(error) }));
  }
};

// 添加 Worker
const handleAddWorker = async () => {
  // 打开配置对话框，使用默认配置
  currentAgentRole.value = 'worker';
  currentWorkerIndex.value = session.value?.workers?.length ?? 0;
  agentConfigForm.value = {
    type: 'ai-tool',
    aiTool: 'claude-code',
    command: '',
    cwd: '',
  };
  showAgentConfigModal.value = true;
};

// 移除 Worker
const handleRemoveWorker = async (index: number) => {
  try {
    await collabStore.removeWorker(props.sessionId, index);
    message.success(t('aiCollab.workerRemoved', { index: index + 1 }));
  } catch (error) {
    message.error(t('aiCollab.removeWorkerFailed', { error: String(error) }));
  }
};

const handleSettings = () => {
  // 从当前会话配置加载设置
  if (session.value?.config) {
    settingsForm.value.autoDecision = session.value.config.autoDecision ?? true;
    settingsForm.value.decisionTimeout = session.value.config.decisionTimeout ?? 60;
    settingsForm.value.maxIterations = session.value.config.maxIterations ?? 10;
  }
  showSettingsModal.value = true;
};

const handleSaveSettings = async () => {
  if (!session.value) return;
  
  // 更新会话配置
  session.value.config.autoDecision = settingsForm.value.autoDecision;
  session.value.config.decisionTimeout = settingsForm.value.decisionTimeout;
  session.value.config.maxIterations = settingsForm.value.maxIterations;
  
  showSettingsModal.value = false;
  message.success(t('aiCollab.settingsSaved'));
};

// 打开 Agent 配置对话框
const openAgentConfigModal = (role: AgentRole, workerIndex?: number) => {
  currentAgentRole.value = role;
  currentWorkerIndex.value = workerIndex;
  
  // 从当前会话配置加载 Agent 配置
  let config: AgentConfig | undefined;
  if (role === 'supervisor') {
    config = session.value?.config?.supervisor;
  } else {
    const idx = workerIndex ?? 0;
    const workerConfigs = session.value?.config?.workers?.length 
      ? session.value.config.workers 
      : session.value?.config?.worker ? [session.value.config.worker] : [];
    config = workerConfigs[idx];
  }
  
  if (config) {
    agentConfigForm.value = {
      type: config.type || 'ai-tool',
      aiTool: config.aiTool || 'claude-code',
      command: config.command || '',
      cwd: config.cwd || '',
    };
  } else {
    // 默认配置
    agentConfigForm.value = {
      type: 'ai-tool',
      aiTool: 'claude-code',
      command: '',
      cwd: '',
    };
  }
  
  showAgentConfigModal.value = true;
};

// 保存 Agent 配置
const handleSaveAgentConfig = async () => {
  if (!session.value) return;
  
  const newConfig: Partial<AgentConfig> = {
    type: agentConfigForm.value.type,
    role: currentAgentRole.value,
  };
  
  if (agentConfigForm.value.type === 'ai-tool') {
    newConfig.aiTool = agentConfigForm.value.aiTool;
    newConfig.command = undefined;
    newConfig.cwd = undefined;
  } else {
    newConfig.command = agentConfigForm.value.command;
    newConfig.cwd = agentConfigForm.value.cwd || undefined;
    newConfig.aiTool = undefined;
  }
  
  // 更新会话配置
  if (currentAgentRole.value === 'supervisor') {
    session.value.config.supervisor = {
      ...session.value.config.supervisor,
      ...newConfig,
    } as AgentConfig;
  } else {
    const idx = currentWorkerIndex.value ?? 0;
    const isNewWorker = idx >= (session.value.workers?.length || 0);
    
    if (isNewWorker) {
      // 添加新 Worker
      const fullConfig: AgentConfig = {
        id: `worker-${Date.now()}`,
        role: 'worker',
        type: agentConfigForm.value.type,
        aiTool: agentConfigForm.value.type === 'ai-tool' ? agentConfigForm.value.aiTool : undefined,
        command: agentConfigForm.value.type === 'custom-cli' ? agentConfigForm.value.command : undefined,
        cwd: agentConfigForm.value.cwd || undefined,
      };
      
      try {
        await collabStore.addWorker(props.sessionId, fullConfig);
        message.success(t('aiCollab.workerAdded'));
      } catch (error) {
        message.error(t('aiCollab.addWorkerFailed', { error: String(error) }));
      }
    } else {
      // 更新现有 Worker 配置
      if (!session.value.config.workers) {
        session.value.config.workers = [session.value.config.worker];
      }
      session.value.config.workers[idx] = {
        ...session.value.config.workers[idx],
        ...newConfig,
      } as AgentConfig;
    }
  }
  
  showAgentConfigModal.value = false;
  message.success(t('aiCollab.settingsSaved'));
};

const handleSend = async () => {
  if (!inputMessage.value.trim()) return;
  if (sendTargets.value.length === 0) return;
  
  try {
    // 解析目标
    const hasSupervisor = sendTargets.value.includes('supervisor');
    const workerIndices = sendTargets.value
      .filter(t => t.startsWith('worker-'))
      .map(t => parseInt(t.replace('worker-', ''), 10));
    
    // 确定消息目标
    let to: 'supervisor' | 'worker' | 'all' = 'all';
    if (hasSupervisor && workerIndices.length === 0) {
      to = 'supervisor';
    } else if (!hasSupervisor && workerIndices.length > 0) {
      to = 'worker';
    }
    
    await collabStore.addMessage(props.sessionId, {
      from: 'user',
      to,
      type: 'chat',
      content: inputMessage.value.trim(),
    });
    
    // 发送给选中的 Agent
    if (hasSupervisor) {
      const agent = session.value?.supervisor;
      if (agent?.status === 'running') {
        await collabStore.sendToAgent(props.sessionId, 'supervisor', inputMessage.value.trim());
      }
    }
    
    // 发送给选中的 workers
    for (const idx of workerIndices) {
      const worker = session.value?.workers[idx];
      if (worker?.status === 'running') {
        await collabStore.sendToAgent(props.sessionId, 'worker', inputMessage.value.trim(), idx);
      }
    }
    
    inputMessage.value = '';
  } catch (error) {
    message.error(t('aiCollab.sendFailed', { error: String(error) }));
  }
};

const handleUserDecide = async (answer: string) => {
  if (!session.value?.pendingDecision) return;
  
  try {
    await collabStore.userDecide(props.sessionId, session.value.pendingDecision.id, answer);
    message.success(t('aiCollab.decisionSent'));
  } catch (error) {
    message.error(t('aiCollab.decisionFailed', { error: String(error) }));
  }
};

const handleCancelTimer = () => {
  collabStore.cancelDecisionTimer(props.sessionId);
  message.info(t('aiCollab.timerCancelled'));
};

// 初始化 Agent 终端
const initAgentTerminal = async () => {
  if (!agentTerminalRef.value || !currentAgentPtyId.value) return;
  
  // 清理旧终端
  disposeAgentTerminal();
  
  try {
    const { Terminal } = await import('@xterm/xterm');
    const { FitAddon } = await import('@xterm/addon-fit');
    const { getAdapter } = await import('../adapters');
    const adapter = await getAdapter();
    
    agentTerminal = new Terminal({
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
      },
      cursorBlink: true,
      scrollback: 5000,
    });
    
    agentTerminalFitAddon = new FitAddon();
    agentTerminal.loadAddon(agentTerminalFitAddon);
    
    agentTerminal.open(agentTerminalRef.value);
    agentTerminalFitAddon.fit();
    
    // 监听 PTY 输出
    agentTerminalUnlisten = await adapter.terminal.onOutput(
      currentAgentPtyId.value,
      (data: string) => {
        if (agentTerminal) {
          agentTerminal.write(data);
        }
      }
    );
    
    // 处理用户输入
    agentTerminal.onData((data: string) => {
      if (currentAgentPtyId.value) {
        adapter.terminal.write(currentAgentPtyId.value, data);
      }
    });
  } catch (error) {
    console.error('[AICollabPanel] Failed to init agent terminal:', error);
  }
};

// 清理 Agent 终端
const disposeAgentTerminal = () => {
  if (agentTerminalUnlisten) {
    agentTerminalUnlisten();
    agentTerminalUnlisten = null;
  }
  if (agentTerminal) {
    agentTerminal.dispose();
    agentTerminal = null;
  }
  agentTerminalFitAddon = null;
};

// 监听消息变化，自动滚动到底部
watch(
  () => session.value?.messages?.length,
  () => {
    scrollToBottom();
  }
);

// 监听终端 Tab 切换
watch(
  () => agentConfigTab.value,
  async (newTab) => {
    if (newTab === 'terminal') {
      await nextTick();
      await initAgentTerminal();
    } else {
      disposeAgentTerminal();
    }
  }
);

// 监听弹窗关闭
watch(
  () => showAgentConfigModal.value,
  (show) => {
    if (!show) {
      disposeAgentTerminal();
      agentConfigTab.value = 'config';
    }
  }
);

// 生命周期
onMounted(() => {
  scrollToBottom();
  checkAgentAlive();
  
  // 定期检查 Agent 存活状态
  aliveCheckInterval = setInterval(checkAgentAlive, 5000);
});

onUnmounted(() => {
  if (aliveCheckInterval) {
    clearInterval(aliveCheckInterval);
  }
  disposeAgentTerminal();
});
</script>

<style scoped>
.ai-collab-panel {
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

.message-list {
  flex: 1;
  overflow: hidden;
}

.messages-container {
  padding: 16px;
}

.message-item {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.message-item.from-system {
  opacity: 0.7;
}

.message-item.type-error .message-body {
  color: var(--n-error-color);
}

.message-avatar {
  flex-shrink: 0;
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.message-sender {
  font-weight: 500;
  font-size: 13px;
}

.message-time {
  font-size: 11px;
  color: var(--n-text-color-3);
}

.message-body {
  background: var(--n-color-embedded);
  padding: 8px 12px;
  border-radius: 8px;
  border-top-left-radius: 2px;
}

.message-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  font-family: inherit;
}

.decision-request {
  padding: 4px 0;
}

.decision-question {
  margin: 0 0 8px 0;
  font-weight: 500;
}

.decision-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.empty-messages {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.decision-timer-area {
  padding: 12px 16px;
  background: rgba(250, 173, 20, 0.1);
  border-top: 1px solid rgba(250, 173, 20, 0.3);
}

.decision-content {
  max-width: 600px;
}

.decision-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  margin-bottom: 8px;
}

.decision-timer {
  margin-top: 12px;
}

.timer-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.input-area {
  padding: 12px 16px;
  border-top: 1px solid var(--n-border-color);
}

.send-targets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.target-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.target-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--n-color-embedded);
  border-radius: 6px;
  transition: background-color 0.2s;
}

.target-item:hover {
  background: var(--n-color-hover);
}

.target-content {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.config-btn {
  opacity: 0.6;
  transition: opacity 0.2s;
}

.config-btn:hover {
  opacity: 1;
}

.add-worker-inline-btn {
  height: 28px;
  font-size: 12px;
}

/* Agent 终端样式 */
.agent-terminal-container {
  height: 400px;
  display: flex;
  flex-direction: column;
}

.terminal-wrapper {
  flex: 1;
  background: #1e1e1e;
  border-radius: 6px;
  overflow: hidden;
}

.agent-terminal {
  width: 100%;
  height: 100%;
}

.terminal-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  background: var(--n-color-embedded);
  border-radius: 6px;
}
</style>
