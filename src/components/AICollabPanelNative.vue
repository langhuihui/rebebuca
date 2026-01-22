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
  <div class="ai-collab-panel-native">
    <!-- 头部状态栏 -->
    <div class="panel-header">
      <div class="session-info">
        <n-tag :type="sessionStatusType" size="small">
          {{ sessionStatusText }}
        </n-tag>
        <span class="project-path" :title="session?.projectPath">
          {{ truncatePath(session?.projectPath || '') }}
        </span>
        <n-tag v-if="session?.provider" type="info" size="small">
          {{ session.provider.model }}
        </n-tag>
      </div>
      <div class="header-actions">
        <n-button-group size="small">
          <n-button 
            v-if="session?.status === 'running'"
            type="error"
            @click="handleStop"
          >
            <template #icon>
              <component :is="iconComponents.stop(true)" />
            </template>
            {{ t('aiCollab.stop') }}
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
                <n-tag v-if="message.type === 'streaming'" size="tiny" type="warning">执行中</n-tag>
              </div>
              <!-- Worker 输出使用小窗口滚屏 -->
              <WorkerOutputWindow
                v-if="(message.from as string) === 'worker'"
                :content="message.content"
                :use-markdown="false"
                :auto-scroll="true"
              />
              <!-- 其他消息类型 -->
              <div v-else class="message-body">
                <div v-if="(message.type as string) === 'tool'" class="tool-message">
                  <n-tag size="small" type="info">Tool: {{ message.metadata?.toolName }}</n-tag>
                  <pre class="message-text tool-content">{{ message.content }}</pre>
                </div>
                <template v-else>
                  <div 
                    v-if="(message.from as string) === 'assistant'" 
                    class="markdown-body"
                    v-html="renderMarkdown(message.content)"
                  ></div>
                  <pre v-else class="message-text">{{ message.content }}</pre>
                </template>
              </div>
            </div>
          </div>
          
          <!-- 流式响应 -->
          <div v-if="currentStreamingText" class="message-item from-assistant streaming">
            <div class="message-avatar">
              <n-avatar 
                size="small" 
                :style="{ backgroundColor: '#722ed1' }"
              >
                AI
              </n-avatar>
            </div>
            <div class="message-content">
              <div class="message-header">
                <span class="message-sender">{{ t('aiCollab.assistant') }}</span>
                <n-tag size="tiny" type="warning">{{ t('aiCollab.streaming') }}</n-tag>
              </div>
              <div class="message-body">
                <div class="markdown-body" v-html="renderMarkdown(currentStreamingText)"></div>
              </div>
            </div>
          </div>
          
          <!-- 工具调用状态 -->
          <div v-if="currentToolCalls.length > 0" class="tool-calls-status">
            <div v-for="call in currentToolCalls" :key="call.id" class="tool-call-item">
              <n-spin v-if="call.status === 'running'" size="small" />
              <n-icon v-else-if="call.status === 'completed'" color="#52c41a">
                <component :is="svgIcons.check" />
              </n-icon>
              <n-icon v-else-if="call.status === 'error'" color="#ff4d4f">
                <component :is="svgIcons.close" />
              </n-icon>
              <span>{{ call.name }}</span>
            </div>
          </div>
          
          <!-- 空状态 -->
          <div v-if="!session?.messages?.length && !currentStreamingText" class="empty-messages">
            <div v-if="session?.goal" class="goal-display">
              <div class="goal-header">
                <n-icon size="20" color="#722ed1">
                  <component :is="svgIcons.task" />
                </n-icon>
                <span class="goal-title">{{ t('aiCollab.taskGoal') }}</span>
              </div>
              <div class="goal-content">
                <div class="goal-objective">
                  <strong>{{ t('aiCollab.taskObjective') }}：</strong>
                  <span>{{ session.goal.objective }}</span>
                </div>
                <div v-if="session.goal.acceptanceCriteria?.length" class="goal-criteria">
                  <strong>{{ t('aiCollab.acceptanceCriteria') }}：</strong>
                  <ul>
                    <li v-for="(criterion, index) in session.goal.acceptanceCriteria" :key="index">
                      {{ criterion }}
                    </li>
                  </ul>
                </div>
                <div v-if="session.goal.context" class="goal-context">
                  <strong>{{ t('aiCollab.context') }}：</strong>
                  <span>{{ session.goal.context }}</span>
                </div>
                <div v-if="session.goal.constraints?.length" class="goal-constraints">
                  <strong>{{ t('aiCollab.constraints') }}：</strong>
                  <ul>
                    <li v-for="(constraint, index) in session.goal.constraints" :key="index">
                      {{ constraint }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <n-empty v-else :description="t('aiCollab.noMessages')">
              <template #extra>
                <n-text depth="3">{{ t('aiCollab.startHintNative') }}</n-text>
              </template>
            </n-empty>
          </div>
        </div>
      </n-scrollbar>
    </div>
    
    <!-- 权限请求区域 -->
    <div v-if="pendingPermissions.length > 0" class="permission-area">
      <div class="permission-content">
        <div class="permission-header">
          <n-icon size="20" color="#faad14">
            <component :is="svgIcons.warning" />
          </n-icon>
          <span>{{ t('aiCollab.permissionRequired') }}</span>
        </div>
        <div v-for="perm in pendingPermissions" :key="perm.id" class="permission-item">
          <p class="permission-description">{{ getPermissionDescription(perm) }}</p>
          <div class="permission-details" v-if="perm.path">
            <code>{{ perm.path }}</code>
          </div>
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
    </div>
    
    <!-- 使用统计 -->
    <div v-if="session?.usage" class="usage-bar">
      <span>Tokens: {{ session.usage.totalTokens.toLocaleString() }}</span>
      <span>(Prompt: {{ session.usage.promptTokens.toLocaleString() }} / Completion: {{ session.usage.completionTokens.toLocaleString() }})</span>
      <span v-if="(session as any)?.toolCallCount > 0">| Tools: {{ (session as any).toolCallCount }}</span>
    </div>
    
    <!-- 输入区域 -->
    <div class="input-area">
      <n-input-group>
        <n-input
          v-model:value="inputMessage"
          type="textarea"
          :placeholder="t('aiCollab.inputPlaceholder')"
          :autosize="{ minRows: 1, maxRows: 6 }"
          @keydown="handleKeydown"
        />
        <n-button 
          type="primary" 
          @click="handleSend" 
          :disabled="!inputMessage.trim() || session?.status === 'running'"
          :loading="session?.status === 'running'"
        >
          <template #icon>
            <component :is="iconComponents.send" />
          </template>
        </n-button>
      </n-input-group>
    </div>
    
    <!-- Provider 设置对话框 -->
    <n-modal v-model:show="showSettingsModal" preset="card" :title="t('settings.title')" style="width: 600px">
      <n-form label-placement="left" label-width="120">
        <!-- AI 提供商配置部分 -->
        <n-form-item :label="t('aiCollab.providerType')">
          <n-select
            v-model:value="providerForm.type"
            :options="providerTypeOptions"
          />
        </n-form-item>
        <n-form-item :label="t('aiCollab.model')">
          <n-input-group>
            <n-select
              v-model:value="providerForm.model"
              :options="modelOptions"
              filterable
              tag
              style="flex: 1;"
            />
            <n-button 
              v-if="['openrouter', 'custom'].includes(providerForm.type)"
              :loading="isFetchingModels"
              @click="handleFetchModels"
            >
              {{ t('aiCollab.fetchModels') || '获取模型' }}
            </n-button>
          </n-input-group>
        </n-form-item>
        <n-form-item :label="t('aiCollab.apiKey')">
          <n-input
            v-model:value="providerForm.apiKey"
            type="password"
            show-password-on="click"
            :placeholder="t('aiCollab.apiKeyPlaceholder')"
          />
        </n-form-item>
        <n-form-item 
          v-if="!['opencode'].includes(providerForm.type)"
          :label="t('aiCollab.baseUrl')"
        >
          <n-input
            v-model:value="providerForm.baseUrl"
            :placeholder="t('aiCollab.baseUrlPlaceholder')"
          />
        </n-form-item>
        <!-- 免费说明 -->
        <n-form-item v-if="providerForm.type === 'opencode'">
          <n-alert type="success" :show-icon="true">
            {{ t('aiCollab.opencodeHint') }}
          </n-alert>
        </n-form-item>
        <n-form-item :label="t('aiCollab.enabledTools')">
          <n-checkbox-group v-model:value="providerForm.tools">
            <n-space>
              <n-checkbox value="read">Read</n-checkbox>
              <n-checkbox value="write">Write</n-checkbox>
              <n-checkbox value="edit">Edit</n-checkbox>
              <n-checkbox value="bash">Bash</n-checkbox>
              <n-checkbox value="glob">Glob</n-checkbox>
              <n-checkbox value="grep">Grep</n-checkbox>
            </n-space>
          </n-checkbox-group>
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showSettingsModal = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" @click="handleSaveSettings">{{ t('common.save') }}</n-button>
        </n-space>
      </template>
    </n-modal>
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
  NInput,
  NInputGroup,
  NModal,
  NForm,
  NFormItem,
  NSelect,
  NSpace,
  NCheckbox,
  NCheckboxGroup,
  NSpin,
  useMessage,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useAICollabNativeStore, type NativeCollabConfig } from '../stores/aiCollabNative';
import { getModelsForProvider, fetchAndRegisterKiloModels, fetchModelsFromEndpoint } from '../services/ai/provider/models';
import type { ProviderType, PermissionRequest } from '../services/ai/types';
import { iconComponents, svgIcons } from '../utils/icons';
import { renderMarkdown } from '../utils/markdown';
import type { MessageFrom } from '../types/aiCollab';
import WorkerOutputWindow from './orchestration/WorkerOutputWindow.vue';

const props = defineProps<{
  sessionId?: string;
  projectPath: string;
}>();

const emit = defineEmits<{
  (e: 'session-created', sessionId: string): void;
}>();

const { t } = useI18n();
const message = useMessage();
const collabStore = useAICollabNativeStore();

const scrollbarRef = ref<InstanceType<typeof NScrollbar> | null>(null);
const messageListRef = ref<HTMLElement | null>(null);
const inputMessage = ref('');
const showSettingsModal = ref(false);

// Worker 输出滚动由 WorkerOutputWindow 组件内部处理

// Provider 配置表单
const providerForm = ref({
  type: 'opencode' as ProviderType,
  model: 'gpt-5-nano',
  apiKey: '',
  baseUrl: '',
  tools: ['read', 'write', 'edit', 'bash', 'glob', 'grep'],
});

// Provider 类型选项
const providerTypeOptions = computed(() => [
  { label: 'OpenCode Zen (免费)', value: 'opencode' },
  { label: 'OpenRouter', value: 'openrouter' },
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Google (Gemini)', value: 'google' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'GLM (智谱)', value: 'glm' },
  { label: 'Kimi (Moonshot)', value: 'kimi' },
  { label: t('settings.custom') + ' (OpenAI 兼容)', value: 'custom' },
]);

// 模型选项
const modelOptions = computed(() => {
  const models = getModelsForProvider(providerForm.value.type);
  const options = models.map((m: { name: string; contextWindow: number; id: string }) => ({
    label: `${m.name} (${m.contextWindow.toLocaleString()} tokens)`,
    value: m.id,
  }));
  
  return options;
});

// 当前会话
const session = computed(() => {
  if (props.sessionId) {
    return collabStore.sessions.get(props.sessionId);
  }
  return collabStore.activeSession;
});

// 流式文本
const currentStreamingText = computed(() => collabStore.currentStreamingText);

// 工具调用
const currentToolCalls = computed(() => collabStore.currentToolCalls);

// 权限请求
const pendingPermissions = computed(() => collabStore.pendingPermissions);

// 状态
const sessionStatusType = computed(() => {
  switch (session.value?.status) {
    case 'running': return 'success';
    case 'completed': return 'info';
    case 'error': return 'error';
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
    case 'error': return t('aiCollab.statusFailed');
    default: return t('aiCollab.statusUnknown');
  }
});

const isFetchingModels = ref(false);
const handleFetchModels = async () => {
  if (providerForm.value.type === 'kilo') {
    message.warning('Kilo provider is temporarily disabled');
    return;
  }
  
  const baseUrl = providerForm.value.baseUrl || '';
  if (!baseUrl && providerForm.value.type !== 'openrouter') {
    message.warning(t('aiCollab.baseUrlPlaceholder') || '请先输入 Base URL');
    return;
  }

  isFetchingModels.value = true;
  try {
    const models = await fetchModelsFromEndpoint(
      baseUrl || 'https://openrouter.ai/api/v1',
      providerForm.value.apiKey,
      providerForm.value.type
    );
    if (models.length > 0) {
      message.success(t('aiCollab.modelsLoaded', { count: models.length }) || '已获取模型列表');
    }
  } catch (error) {
    message.error('获取模型失败');
  } finally {
    isFetchingModels.value = false;
  }
};

// 方法
const truncatePath = (path: string): string => {
  if (path.length <= 40) return path;
  const parts = path.split('/');
  if (parts.length <= 3) return path;
  return `.../${parts.slice(-2).join('/')}`;
};

const getAvatarColor = (from: MessageFrom | 'assistant' | 'worker' | 'supervisor'): string => {
  switch (from) {
    case 'assistant': return '#722ed1';
    case 'user': return '#1890ff';
    case 'system': return '#8c8c8c';
    case 'worker': return '#52c41a';
    case 'supervisor': return '#faad14';
    default: return '#d9d9d9';
  }
};

const getAvatarText = (from: MessageFrom | 'assistant' | 'worker' | 'supervisor'): string => {
  switch (from) {
    case 'assistant': return 'AI';
    case 'user': return 'U';
    case 'system': return 'S';
    case 'worker': return 'W';
    case 'supervisor': return 'S';
    default: return '?';
  }
};

const getSenderName = (from: MessageFrom | 'assistant' | 'worker' | 'supervisor'): string => {
  switch (from) {
    case 'assistant': return t('aiCollab.assistant');
    case 'user': return t('aiCollab.user');
    case 'system': return t('aiCollab.system');
    case 'worker': return t('aiCollab.worker');
    case 'supervisor': return t('aiCollab.supervisor');
    default: return from;
  }
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};


const getPermissionDescription = (perm: PermissionRequest): string => {
  switch (perm.type) {
    case 'read':
      return `Read file: ${perm.path || perm.patterns?.join(', ') || ''}`;
    case 'write':
      return `Write file: ${perm.path || ''}`;
    case 'edit':
      return `Edit file: ${perm.path || ''}`;
    case 'bash':
      return `Execute command: ${perm.command || ''}`;
    case 'external_directory':
      return `Access external directory: ${perm.path || perm.patterns?.join(', ') || ''}`;
    default:
      return `${perm.type}: ${perm.path || perm.command || perm.patterns?.join(', ') || ''}`;
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
        } else if (messageListRef.value) {
          // Fallback: find the container through the parent ref
          container = messageListRef.value.querySelector('.n-scrollbar-container');
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

// 事件处理
const handleSend = async () => {
  if (!inputMessage.value.trim()) return;
  
  try {
    let sessionId = props.sessionId || session.value?.id;
    
    // 如果没有会话，先创建
    if (!sessionId) {
      const config: NativeCollabConfig = {
        projectPath: props.projectPath,
        provider: {
          type: providerForm.value.type,
          model: providerForm.value.model,
          apiKey: providerForm.value.apiKey,
          baseUrl: providerForm.value.baseUrl || undefined,
        },
        tools: providerForm.value.tools,
      };
      
      // Kilo 免费模式不需要 API key
      if (!config.provider.apiKey && !['opencode'].includes(config.provider.type)) {
        message.warning(t('aiCollab.apiKeyRequired'));
        showSettingsModal.value = true;
        return;
      }
      
      console.log('[AICollabPanelNative] Creating new session:', config);
      const newSession = await collabStore.createSession(config);
      sessionId = newSession.id;
      console.log('[AICollabPanelNative] Session created:', sessionId);
      emit('session-created', sessionId);
      
      // 新创建的会话，自动启动
      // 新创建的会话，自动启动（发送欢迎消息）
      // 注意：不要在 handleSend 中自动启动，因为用户已经手动发送了消息
      // await autoStartSession(sessionId);
    }
    
    console.log('[AICollabPanelNative] Sending message to session:', sessionId);
    await collabStore.sendMessage(sessionId, inputMessage.value.trim());
    inputMessage.value = '';
  } catch (error) {
    console.error('[AICollabPanelNative] Error sending message:', error);
    message.error(t('aiCollab.sendFailed', { error: String(error) }));
  }
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};

const handleStop = async () => {
  if (!session.value?.id) return;
  try {
    await collabStore.stopSession(session.value.id);
    message.info(t('aiCollab.stopped'));
  } catch (error) {
    message.error(t('aiCollab.stopFailed', { error: String(error) }));
  }
};

const handleResume = async () => {
  if (!session.value?.id) return;
  try {
    await collabStore.resumeSession(session.value.id);
    message.success(t('aiCollab.resumed'));
  } catch (error) {
    message.error(t('aiCollab.resumeFailed', { error: String(error) }));
  }
};

const handleSettings = () => {
  // 从当前会话加载配置
  if (session.value?.provider) {
    providerForm.value.type = session.value.provider.type;
    providerForm.value.model = session.value.provider.model;
    providerForm.value.apiKey = session.value.provider.apiKey;
    providerForm.value.baseUrl = session.value.provider.baseUrl || '';
  }
  if (session.value?.tools) {
    providerForm.value.tools = [...session.value.tools];
  }
  showSettingsModal.value = true;
};

const handleSaveSettings = async () => {
  if (session.value?.id) {
    try {
      // 更新 AI 提供商配置
      await collabStore.updateProvider(session.value.id, {
        type: providerForm.value.type,
        model: providerForm.value.model,
        apiKey: providerForm.value.apiKey,
        baseUrl: providerForm.value.baseUrl || undefined,
      });
      await collabStore.updateTools(session.value.id, providerForm.value.tools);
      
      message.success(t('aiCollab.settingsSaved'));
    } catch (error) {
      message.error(String(error));
    }
  }
  showSettingsModal.value = false;
};

const handlePermissionAllow = (requestId: string) => {
  collabStore.replyPermission(requestId, 'allow');
};

const handlePermissionDeny = (requestId: string) => {
  collabStore.replyPermission(requestId, 'deny');
};

const handlePermissionAlways = (requestId: string) => {
  collabStore.replyPermission(requestId, 'always');
};

// 监听消息变化
watch(
  () => session.value?.messages?.length,
  () => {
    scrollToBottom();
  }
);

watch(
  () => currentStreamingText.value,
  () => {
    scrollToBottom();
  }
);

// 监听会话变化，如果是新会话则自动启动
// 注意：不在这里自动启动，避免与 onMounted 重复调用
// watch(
//   () => session.value?.id,
//   async (sessionId, oldSessionId) => {
//     if (sessionId && sessionId !== oldSessionId && session.value) {
//       // 新会话，检查是否需要自动启动
//       // 延迟一下，确保会话已完全初始化
//       await nextTick();
//       await new Promise(resolve => setTimeout(resolve, 300));
//       
//       // 如果只有系统消息（新会话），自动启动
//       const userMessages = session.value.messages.filter(m => m.from === 'user');
//       const assistantMessages = session.value.messages.filter(m => m.from === 'assistant');
//       console.log('[AICollabPanelNative] Session changed, checking auto-start:', {
//         sessionId,
//         userMessages: userMessages.length,
//         assistantMessages: assistantMessages.length,
//       });
//       if (userMessages.length === 0 && assistantMessages.length === 0) {
//         console.log('[AICollabPanelNative] No user/assistant messages, calling autoStartSession');
//         await autoStartSession(sessionId);
//       } else {
//         console.log('[AICollabPanelNative] Session has messages, skipping auto-start');
//       }
//     }
//   },
//   { immediate: false }
// );

// 生命周期
onMounted(async () => {
  scrollToBottom();
  
  // 尝试加载已有会话
  if (!props.sessionId && props.projectPath) {
    const loaded = await collabStore.loadSession(props.projectPath);
    if (loaded) {
      emit('session-created', loaded.id);
      // 如果是新加载的会话且有历史消息，不需要自动启动
      console.log('[AICollabPanelNative] Session loaded in onMounted:', {
        id: loaded.id,
        messageCount: loaded.messages.length,
      });
      if (loaded.messages.length <= 1) {
        // 只有系统消息，自动发送欢迎消息
        console.log('[AICollabPanelNative] Loaded session has <= 1 message, calling autoStartSession');
        await autoStartSession(loaded.id);
      } else {
        console.log('[AICollabPanelNative] Loaded session has messages, skipping auto-start');
      }
    }
  } else if (props.sessionId) {
    // 如果已有会话 ID，检查是否需要自动启动
    const currentSession = collabStore.sessions.get(props.sessionId);
    console.log('[AICollabPanelNative] onMounted with sessionId:', {
      sessionId: props.sessionId,
      sessionExists: !!currentSession,
      messageCount: currentSession?.messages.length || 0,
    });
    if (currentSession && currentSession.messages.length <= 1) {
      // 只有系统消息，自动发送欢迎消息
      console.log('[AICollabPanelNative] Existing session has <= 1 message, calling autoStartSession');
      await autoStartSession(props.sessionId);
    } else {
      console.log('[AICollabPanelNative] Existing session has messages or not found, skipping auto-start');
    }
  }
});

// 自动启动标记，避免重复发送
const autoStartedSessions = new Set<string>();
// 正在启动的会话，防止并发调用
const startingSessions = new Set<string>();

// 自动启动会话（发送欢迎消息）
const autoStartSession = async (sessionId: string) => {
  console.log('[AICollabPanelNative] autoStartSession called for session:', sessionId);
  
  // 避免重复启动
  if (autoStartedSessions.has(sessionId)) {
    console.log('[AICollabPanelNative] Session already auto-started, skipping:', sessionId);
    return;
  }
  
  // 防止并发调用
  if (startingSessions.has(sessionId)) {
    console.log('[AICollabPanelNative] Session is already starting, skipping:', sessionId);
    return;
  }
  
  startingSessions.add(sessionId);
  
  try {
    // 标记为已启动（在检查通过后再标记，避免重复）
    console.log('[AICollabPanelNative] Marking session as auto-started:', sessionId);
    
    // 等待一小段时间，确保界面已完全渲染
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 再次检查会话状态，确保会话仍然存在且没有用户消息
    const currentSession = collabStore.sessions.get(sessionId);
    if (!currentSession) {
      console.warn('[AICollabPanelNative] Session not found after delay:', sessionId);
      autoStartedSessions.delete(sessionId);
      startingSessions.delete(sessionId);
      return;
    }
    
    console.log('[AICollabPanelNative] Current session messages:', {
      total: currentSession.messages.length,
      user: currentSession.messages.filter(m => m.from === 'user').length,
      assistant: currentSession.messages.filter(m => m.from === 'assistant').length,
    });
    
    const userMessages = currentSession.messages.filter(m => m.from === 'user');
    if (userMessages.length > 0) {
      // 已经有用户消息了，不需要自动启动
      console.log('[AICollabPanelNative] Session already has user messages, skipping auto-start');
      startingSessions.delete(sessionId);
      return;
    }
    
    // 添加欢迎消息（作为助手消息，而不是用户消息）
    let welcomeMessage: string;
    let shouldAutoStart = false;
    
    if (currentSession?.goal?.objective) {
      // 使用任务目标构建欢迎消息 - 直接表明要开始执行
      welcomeMessage = `你好！我将帮助你完成以下任务：\n\n**任务目标**：${currentSession.goal.objective}`;
      if (currentSession.goal.acceptanceCriteria?.length) {
        welcomeMessage += `\n\n**完成标准**：\n${currentSession.goal.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
      }
      if (currentSession.goal.context) {
        welcomeMessage += `\n\n**背景信息**：${currentSession.goal.context}`;
      }
      if (currentSession.goal.constraints?.length) {
        welcomeMessage += `\n\n**约束条件**：\n${currentSession.goal.constraints.map(c => `- ${c}`).join('\n')}`;
      }
      welcomeMessage += '\n\n让我开始分析项目结构并执行任务...';
      shouldAutoStart = true;
    } else {
      welcomeMessage = '你好！我是你的 AI 助手，可以帮助你完成各种开发任务。你可以让我帮你阅读、编辑文件，执行命令，或者回答任何问题。请告诉我你需要什么帮助？';
    }
    
    console.log('[AICollabPanelNative] Adding welcome message via addAssistantMessage');
    // 使用 addAssistantMessage 方法添加助手消息，而不是通过 sendMessage（sendMessage 会将其标记为用户消息）
    await collabStore.addAssistantMessage(sessionId, welcomeMessage);
    
    // 等待一下，确保消息已添加
    await nextTick();
    
    // 标记为已启动（在欢迎消息添加成功后）
    autoStartedSessions.add(sessionId);
    
    // 再次检查会话状态
    const updatedSession = collabStore.sessions.get(sessionId);
    console.log('[AICollabPanelNative] Welcome message added successfully, session state:', {
      messageCount: updatedSession?.messages.length || 0,
      lastMessage: updatedSession?.messages[updatedSession.messages.length - 1],
    });
    
    // 滚动到底部以显示新消息
    scrollToBottom();
    
    // 如果有任务目标，自动开始执行任务
    if (shouldAutoStart && currentSession?.goal?.objective) {
      // 等待一下，让欢迎消息先显示
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 构建任务启动指令 - 包含完整的任务信息
      let taskPrompt = `请开始执行以下任务：\n\n任务目标：${currentSession.goal.objective}`;
      if (currentSession.goal.acceptanceCriteria?.length) {
        taskPrompt += `\n\n完成标准：\n${currentSession.goal.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
      }
      if (currentSession.goal.context) {
        taskPrompt += `\n\n背景信息：${currentSession.goal.context}`;
      }
      if (currentSession.goal.constraints?.length) {
        taskPrompt += `\n\n约束条件：\n${currentSession.goal.constraints.map(c => `- ${c}`).join('\n')}`;
      }
      taskPrompt += '\n\n请先了解项目结构，然后开始实现。';
      
      console.log('[AICollabPanelNative] Auto-starting task execution');
      
      // 直接调用底层 AI 会话发送消息，而不通过 collabStore.sendMessage
      // 这样可以避免在 UI 上显示用户消息
      const session = collabStore.sessions.get(sessionId);
      if (session?.aiSessionId) {
        try {
          // 更新会话状态为运行中
          session.status = 'running';
          session.lastActivity = Date.now();
          
          // 直接调用 aiSessionManager.sendMessage
          const { aiSessionManager } = await import('@/services/ai/session');
          await aiSessionManager.sendMessage(session.aiSessionId, taskPrompt);
          console.log('[AICollabPanelNative] Task execution started');
        } catch (error) {
          console.error('[AICollabPanelNative] Failed to start task:', error);
          // 更新会话状态为错误
          session.status = 'error';
          session.error = error instanceof Error ? error.message : String(error);
        }
      }
    }
  } catch (error) {
    console.error('[AICollabPanelNative] Failed to auto-start session:', error);
    
    // 如果是网络错误，显示更友好的提示
    if (error instanceof Error && (error.name === 'NetworkError' || error.message.includes('Load failed'))) {
      message.warning(
        `无法连接到 AI 服务。请检查网络连接和 API 配置。`,
        { duration: 8000 }
      );
      console.error('[AICollabPanelNative] Network error details:', error);
    }
    
    // 失败时移除标记，允许重试
    autoStartedSessions.delete(sessionId);
    // 不抛出错误，允许用户手动重试
  } finally {
    // 无论成功还是失败，都要移除正在启动的标记
    startingSessions.delete(sessionId);
  }
};
</script>

<style scoped>
.ai-collab-panel-native {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--n-color);
  user-select: text;
  -webkit-user-select: text;
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

.message-item.streaming .message-body {
  border-left: 3px solid #722ed1;
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
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.tool-message {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-content {
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.1);
  padding: 8px;
  border-radius: 4px;
  max-height: 200px;
  overflow: auto;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.markdown-body {
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-text-color);
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 12px 0 6px 0;
  font-weight: 600;
  line-height: 1.25;
  color: var(--n-text-color);
}

.markdown-body :deep(h1) { font-size: 1.4em; }
.markdown-body :deep(h2) { font-size: 1.3em; }
.markdown-body :deep(h3) { font-size: 1.1em; }
.markdown-body :deep(h4) { font-size: 1em; }
.markdown-body :deep(h5) { font-size: 0.9em; }
.markdown-body :deep(h6) { font-size: 0.85em; }

.markdown-body :deep(p) {
  margin: 0 0 8px 0;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
}

.markdown-body :deep(li) {
  margin: 3px 0;
}

.markdown-body :deep(blockquote) {
  margin: 6px 0;
  padding: 6px 10px;
  border-left: 3px solid var(--n-border-color);
  background: rgba(0, 0, 0, 0.05);
  color: var(--n-text-color-2);
}

.markdown-body :deep(pre) {
  background: rgba(0, 0, 0, 0.1);
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 6px 0;
}

.markdown-body :deep(code) {
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 13px;
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
}

.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
}

.markdown-body :deep(a) {
  color: var(--n-primary-color);
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 6px 0;
  font-size: 12px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--n-border-color);
  padding: 4px 8px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: var(--n-color-embedded);
  font-weight: 600;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--n-border-color);
  margin: 12px 0;
}

.markdown-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 6px 0;
}

/* Worker 输出样式已移至 WorkerOutputWindow 组件 */

.tool-calls-status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 16px;
  background: var(--n-color-embedded);
  border-radius: 6px;
  margin: 8px 16px;
}

.tool-call-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--n-color);
  border-radius: 4px;
  font-size: 12px;
}

.empty-messages {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.goal-display {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  background: var(--n-color-embedded);
  border-radius: 8px;
  border: 1px solid var(--n-border-color);
}

.goal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.goal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--n-text-color);
}

.goal-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.goal-objective,
.goal-criteria,
.goal-context,
.goal-constraints {
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-text-color);
}

.goal-objective strong,
.goal-criteria strong,
.goal-context strong,
.goal-constraints strong {
  color: var(--n-text-color-1);
  margin-right: 8px;
}

.goal-criteria ul,
.goal-constraints ul {
  margin: 8px 0 0 0;
  padding-left: 24px;
}

.goal-criteria li,
.goal-constraints li {
  margin-bottom: 6px;
}

.permission-area {
  padding: 12px 16px;
  background: rgba(250, 173, 20, 0.1);
  border-top: 1px solid rgba(250, 173, 20, 0.3);
}

.permission-content {
  max-width: 600px;
}

.permission-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  margin-bottom: 12px;
}

.permission-item {
  padding: 12px;
  background: var(--n-color);
  border-radius: 6px;
  margin-bottom: 8px;
}

.permission-description {
  margin: 0 0 8px 0;
  font-size: 13px;
}

.permission-details {
  margin-bottom: 8px;
}

.permission-details code {
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 12px;
  background: var(--n-color-embedded);
  padding: 2px 6px;
  border-radius: 4px;
}

.permission-actions {
  display: flex;
  gap: 8px;
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

.input-area {
  padding: 12px 16px;
  border-top: 1px solid var(--n-border-color);
}
</style>
