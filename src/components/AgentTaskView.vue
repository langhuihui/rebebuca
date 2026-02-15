<!--
 * AgentTaskView - Component for visualizing agent task JSON output
 * Displays structured JSON messages from agent execution
 -->

<template>
  <div class="agent-task-view">
    <div class="agent-output-container">
      <!-- Request Section (user message + system init) -->
      <div v-if="requestMessage" class="request-section">
        <div class="request-header">
          <h3>Request</h3>
          <div class="request-tags">
            <span v-if="systemInitMessage?.model" class="request-tag model-tag">
              <span class="tag-icon">🤖</span>
              <span class="tag-text">{{ systemInitMessage.model }}</span>
            </span>
            <span v-if="systemInitMessage?.cwd" class="request-tag cwd-tag">
              <span class="tag-icon">📁</span>
              <span class="tag-text">{{ systemInitMessage.cwd }}</span>
            </span>
          </div>
        </div>
        <div class="request-content">
          <!-- System Init Info (if available) -->
          <div v-if="systemInitMessage" class="system-init-info">
            <div v-if="systemInitMessage.permissionMode" class="init-info-item">
              <span class="init-label">Permission Mode:</span>
              <span class="init-value">{{ systemInitMessage.permissionMode }}</span>
            </div>
          </div>
          <!-- User Request Content -->
          <div v-if="requestMessage.message?.content" class="request-text">
            <div
              v-for="(contentItem, idx) in (Array.isArray(requestMessage.message.content) ? requestMessage.message.content : [requestMessage.message.content])"
              :key="idx"
              class="content-item"
            >
              <div v-if="contentItem.type === 'text'" class="text-content">
                {{ contentItem.text }}
              </div>
              <pre v-else>{{ JSON.stringify(contentItem, null, 2) }}</pre>
            </div>
          </div>
          <pre v-else>{{ JSON.stringify(requestMessage.message || requestMessage, null, 2) }}</pre>
        </div>
      </div>

      <!-- JSON Messages List -->
      <div class="json-messages" ref="messagesContainer">
        <!-- Empty state -->
        <div v-if="parsedMessages.length === 0 && !requestMessage" class="empty-state">
          <div class="empty-message">
            <p>Waiting for agent output...</p>
            <p class="empty-detail">PTY ID: {{ ptyId }}</p>
            <p class="empty-detail">Buffer size: {{ outputBuffer.length }} bytes</p>
          </div>
        </div>
        
        <!-- Thinking Animation (shown separately, not in message list) -->
        <div v-if="thinkingState === 'thinking'" class="json-message message-thinking">
          <div class="message-header">
            <span class="message-type">Thinking</span>
          </div>
          <div class="message-content">
            <div class="thinking-content">
              <div class="thinking-animation">
                <div class="thinking-spinner">
                  <div class="spinner-dot"></div>
                  <div class="spinner-dot"></div>
                  <div class="spinner-dot"></div>
                </div>
                <span class="thinking-label">Thinking...</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Thinking Completed (shown separately) -->
        <div v-if="thinkingState === 'completed'" class="json-message message-thinking">
          <div class="message-header">
            <span class="message-type">Thinking</span>
          </div>
          <div class="message-content">
            <div class="thinking-content">
              <div class="thinking-completed">
                <span class="completed-icon">✓</span>
                <span class="completed-text">Thinking completed</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Messages (grouped for continuous text rendering) -->
        <div
          v-for="(group, groupIndex) in groupedMessages"
          :key="groupIndex"
          class="json-message"
          :class="getMessageClass(group.messages[0])"
        >
          <div class="message-header">
            <span class="message-type">{{ getMessageTypeLabel(group.messages[0]) }}</span>
            <span v-if="group.messages[0].timestamp_ms" class="message-timestamp">
              {{ formatTimestamp(group.messages[0].timestamp_ms) }}
            </span>
          </div>
          <div class="message-content">
            <!-- System messages (init is shown in request section, so only show other system messages) -->
            <pre v-if="group.type === 'system' && group.messages[0].subtype !== 'init'">
              {{ formatMessageContent(group.messages[0]) }}
            </pre>
            <!-- Assistant messages - Render based on content type, support grouped text messages -->
            <div v-else-if="group.type === 'assistant'" class="assistant-content">
              <!-- Grouped text messages - render continuously -->
              <div v-if="group.messages.length > 1" class="assistant-text-group">
                <div
                  v-for="(message, msgIdx) in group.messages"
                  :key="msgIdx"
                >
                  <div
                    v-for="(contentItem, idx) in (Array.isArray(message.message?.content) ? message.message.content : [message.message?.content])"
                    :key="idx"
                    class="assistant-content-item"
                  >
                    <div v-if="contentItem?.type === 'text'" class="assistant-text">
                      {{ contentItem.text }}
                    </div>
                  </div>
                </div>
              </div>
              <!-- Single message -->
              <div v-else>
                <div v-if="group.messages[0].message?.content">
                  <div
                    v-for="(contentItem, idx) in (Array.isArray(group.messages[0].message.content) ? group.messages[0].message.content : [group.messages[0].message.content])"
                    :key="idx"
                    class="assistant-content-item"
                  >
                    <!-- Text content - display text directly -->
                    <div v-if="contentItem.type === 'text'" class="assistant-text">
                      {{ contentItem.text }}
                    </div>
                    <!-- Other content types - display as JSON -->
                    <pre v-else class="assistant-other">
                      {{ JSON.stringify(contentItem, null, 2) }}
                    </pre>
                  </div>
                </div>
                <!-- Fallback to JSON if no content structure -->
                <pre v-else>
                  {{ formatMessageContent(group.messages[0]) }}
                </pre>
              </div>
            </div>
            <!-- Tool call messages - Show command content only -->
            <div v-else-if="group.type === 'tool_call'" class="tool-call-content">
              <div v-if="group.messages[0].tool_call?.shellToolCall?.args?.command" class="tool-call-command">
                <div class="tool-call-label">Command:</div>
                <div class="tool-call-command-text">{{ group.messages[0].tool_call.shellToolCall.args.command }}</div>
              </div>
              <div v-else-if="group.messages[0].tool_call?.mcpToolCall" class="tool-call-mcp">
                <div class="tool-call-label">MCP Tool Call:</div>
                <div class="tool-call-details">
                  <!-- Support both old format (mcpToolCall.name) and new format (mcpToolCall.args.toolName) -->
                  <div v-if="group.messages[0].tool_call.mcpToolCall.args?.toolName || group.messages[0].tool_call.mcpToolCall.name" class="tool-call-item">
                    <span class="tool-call-item-label">Tool:</span>
                    <span class="tool-call-item-value">{{ group.messages[0].tool_call.mcpToolCall.args?.toolName || group.messages[0].tool_call.mcpToolCall.name }}</span>
                  </div>
                  <!-- Support both old format (mcpToolCall.arguments) and new format (mcpToolCall.args.args) -->
                  <div v-if="group.messages[0].tool_call.mcpToolCall.args?.args || group.messages[0].tool_call.mcpToolCall.arguments" class="tool-call-item">
                    <span class="tool-call-item-label">Arguments:</span>
                    <pre class="tool-call-arguments">{{ JSON.stringify(group.messages[0].tool_call.mcpToolCall.args?.args || group.messages[0].tool_call.mcpToolCall.arguments, null, 2) }}</pre>
                  </div>
                </div>
              </div>
              <!-- Fallback to full JSON if structure is different -->
              <pre v-else>
                {{ formatMessageContent(group.messages[0]) }}
              </pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Result Section (last message with result) -->
      <div v-if="finalResult" class="result-section">
        <div class="result-header">
          <h3>Result</h3>
        </div>
        <div class="result-content">
          <!-- If result is a string, render with line breaks -->
          <div v-if="typeof finalResult === 'string'" class="result-text">
            {{ finalResult }}
          </div>
          <!-- If result is an object, render as JSON -->
          <pre v-else>{{ JSON.stringify(finalResult, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useTerminalStore, type TerminalTab } from '../stores/terminal';
import { getAdapter, isTauri } from '../adapters';

interface Props {
  tab: TerminalTab;
  ptyId: string;
}

const props = defineProps<Props>();

interface JsonMessage {
  type: string;
  subtype?: string;
  text?: string;
  message?: any;
  tool_call?: any;
  result?: any;
  call_id?: string;
  session_id?: string;
  timestamp_ms?: number;
  apiKeySource?: string;
  cwd?: string;
  model?: string;
  permissionMode?: string;
  [key: string]: any;
}

const terminalStore = useTerminalStore();

const parsedMessages = ref<JsonMessage[]>([]);
const finalResult = ref<any>(null);
const messagesContainer = ref<HTMLElement | null>(null);
const outputBuffer = ref<string>('');

// Extract request message (user message)
const requestMessage = computed(() => {
  return parsedMessages.value.find(m => m.type === 'user');
});

// Extract system init message
const systemInitMessage = computed(() => {
  return parsedMessages.value.find(m => m.type === 'system' && m.subtype === 'init');
});

// Check thinking state from all messages (not filtered)
const thinkingState = computed(() => {
  const allMessages = parsedMessages.value;
  const hasCompleted = allMessages.some(m => m.type === 'thinking' && m.subtype === 'completed');
  const hasDelta = allMessages.some(m => m.type === 'thinking' && m.subtype === 'delta');
  
  if (hasCompleted) {
    return 'completed';
  } else if (hasDelta) {
    return 'thinking';
  }
  return null;
});

// Filter messages to exclude user message, thinking messages, and system init
// (we show thinking state separately with animation, and system init in request section)
const filteredMessages = computed(() => {
  return parsedMessages.value.filter(m => 
    m.type !== 'user' && 
    m.type !== 'thinking' && // Exclude all thinking messages (both delta and completed)
    !(m.type === 'system' && m.subtype === 'init')
  );
});

// Group consecutive assistant text messages for continuous rendering
const groupedMessages = computed(() => {
  const messages = filteredMessages.value;
  const grouped: Array<{ type: string; messages: JsonMessage[] }> = [];
  let currentGroup: JsonMessage[] | null = null;

  for (const msg of messages) {
    if (msg.type === 'assistant' && msg.message?.content) {
      const content = Array.isArray(msg.message.content) ? msg.message.content : [msg.message.content];
      const isTextOnly = content.every((item: any) => item.type === 'text');
      
      if (isTextOnly) {
        // Start or continue text group
        if (currentGroup && currentGroup[currentGroup.length - 1]?.type === 'assistant') {
          currentGroup.push(msg);
        } else {
          if (currentGroup) {
            grouped.push({ type: currentGroup[0].type, messages: currentGroup });
          }
          currentGroup = [msg];
        }
      } else {
        // Non-text content, close current group and add as individual
        if (currentGroup) {
          grouped.push({ type: currentGroup[0].type, messages: currentGroup });
          currentGroup = null;
        }
        grouped.push({ type: msg.type, messages: [msg] });
      }
    } else {
      // Non-assistant message, close current group and add as individual
      if (currentGroup) {
        grouped.push({ type: currentGroup[0].type, messages: currentGroup });
        currentGroup = null;
      }
      grouped.push({ type: msg.type, messages: [msg] });
    }
  }
  
  if (currentGroup) {
    grouped.push({ type: currentGroup[0].type, messages: currentGroup });
  }
  
  return grouped;
});

// Parse JSON lines from output
const parseOutput = (output: string) => {
  const lines = output.split('\n').filter(line => line.trim());
  const messages: JsonMessage[] = [];
  let lastResult: any = null;

  for (const line of lines) {
    try {
      const message = JSON.parse(line) as JsonMessage;
      messages.push(message);
      
      // Check if this message has a result
      // 1. From tool_call completed
      if (message.type === 'tool_call' && message.subtype === 'completed') {
        // Check tool_call.result
        if (message.tool_call?.result) {
          lastResult = message.tool_call.result;
        }
        // Also check if result is directly in the message
        if (message.result) {
          lastResult = message.result;
        }
      }
      // 2. From result type message (final result from agent)
      if (message.type === 'result' && message.result) {
        lastResult = message.result;
      }
      // 3. Also check if result field exists directly (for any message type)
      if (message.result && typeof message.result === 'object') {
        lastResult = message.result;
      }
    } catch (e) {
      // Not a JSON line, skip
    }
  }

  return { messages, lastResult };
};

// Watch for output changes
watch(() => props.tab.agentOutput, (newOutput) => {
  if (newOutput) {
    const { messages, lastResult } = parseOutput(newOutput);
    parsedMessages.value = messages;
    finalResult.value = lastResult;
    
    // Auto-scroll to bottom
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    });
  }
}, { immediate: true });

let unlistenOutput: (() => void) | null = null;

// Process output data and parse JSON
const processOutputData = (data: string) => {
  console.log('[AgentTaskView] Processing output data, length:', data.length);
  outputBuffer.value += data;
  
  // Try to parse JSON lines from the buffer
  // JSON messages are typically one per line, but we need to handle incomplete lines
  const lines = outputBuffer.value.split('\n');
  const jsonLines: string[] = [];
  let remainingBuffer = '';
  
  // Process all complete lines (except the last one which might be incomplete)
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (line && (line.startsWith('{') || line.startsWith('['))) {
      try {
        // Try to parse as JSON
        JSON.parse(line);
        jsonLines.push(line);
      } catch (e) {
        // Not valid JSON, keep in buffer (might be part of a multi-line JSON or non-JSON output)
        remainingBuffer += line + '\n';
      }
    } else if (line) {
      // Non-JSON line, keep in buffer
      remainingBuffer += line + '\n';
    }
  }
  
  // Keep the last line in buffer (might be incomplete)
  const lastLine = lines[lines.length - 1];
  if (lastLine.trim() && (lastLine.trim().startsWith('{') || lastLine.trim().startsWith('['))) {
    // Last line looks like JSON start, try to parse it
    try {
      JSON.parse(lastLine.trim());
      // Complete JSON line
      jsonLines.push(lastLine.trim());
      outputBuffer.value = '';
    } catch (e) {
      // Incomplete JSON, keep in buffer
      outputBuffer.value = lastLine;
    }
  } else {
    // Keep the last line in buffer
    outputBuffer.value = lastLine;
  }
  
  // Parse collected JSON lines
  if (jsonLines.length > 0) {
    console.log('[AgentTaskView] Found', jsonLines.length, 'JSON lines');
    const fullOutput = jsonLines.join('\n');
    const { messages, lastResult } = parseOutput(fullOutput);
    
    console.log('[AgentTaskView] Parsed', messages.length, 'messages, lastResult:', !!lastResult);
    
    // Merge with existing messages (avoid duplicates)
    // Use call_id for tool_call, session_id + timestamp for others
    const existingIds = new Set(parsedMessages.value.map(m => {
      if (m.type === 'tool_call' && m.call_id) {
        return `${m.type}-${m.call_id}`;
      }
      return `${m.type}-${m.subtype || ''}-${m.session_id || ''}-${m.timestamp_ms || ''}`;
    }));
    
    const newMessages = messages.filter(m => {
      let id: string;
      if (m.type === 'tool_call' && m.call_id) {
        id = `${m.type}-${m.call_id}`;
      } else {
        id = `${m.type}-${m.subtype || ''}-${m.session_id || ''}-${m.timestamp_ms || ''}`;
      }
      return !existingIds.has(id);
    });
    
    console.log('[AgentTaskView] Adding', newMessages.length, 'new messages');
    parsedMessages.value.push(...newMessages);
    
    if (lastResult) {
      finalResult.value = lastResult;
      console.log('[AgentTaskView] Updated finalResult:', typeof lastResult === 'string' ? lastResult.substring(0, 100) : lastResult);
    }
    
    // Update tab's agentOutput in store
    const tab = terminalStore.tabs.find(t => t.id === props.tab.id);
    if (tab) {
      tab.agentOutput = parsedMessages.value.map(m => JSON.stringify(m)).join('\n');
      tab.agentResult = finalResult.value;
      console.log('[AgentTaskView] Updated tab agentOutput, total messages:', parsedMessages.value.length);
    }
    
    // Auto-scroll
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    });
  } else {
    console.log('[AgentTaskView] No JSON lines found in buffer');
  }
};

// Listen to pty-output events to capture JSON output
onMounted(async () => {
  console.log('[AgentTaskView] Mounted for ptyId:', props.ptyId, 'tabId:', props.tab.id, 'tab.ptyId:', props.tab.ptyId, 'isTauri:', isTauri());
  
  // Load existing output from tab if available
  if (props.tab.agentOutput) {
    console.log('[AgentTaskView] Loading existing output from tab, length:', props.tab.agentOutput.length);
    const { messages, lastResult } = parseOutput(props.tab.agentOutput);
    parsedMessages.value = messages;
    finalResult.value = lastResult;
    console.log('[AgentTaskView] Loaded', messages.length, 'messages from existing output');
  }
  
  // Use ptyId from props or fallback to tab.ptyId
  const ptyIdToUse = props.ptyId || props.tab.ptyId;
  if (!ptyIdToUse) {
    console.warn('[AgentTaskView] No ptyId available, cannot listen to output events');
    return;
  }
  
  try {
    // In Tauri mode, use native event listener for better performance
    // In Server mode, use adapter's onData
    if (isTauri()) {
      const { listen } = await import('@tauri-apps/api/event');
      
      unlistenOutput = await listen<{ pty_id: string; data: string }>('pty-output', (e) => {
        console.log('[AgentTaskView] Received pty-output event:', {
          received_pty_id: e.payload.pty_id,
          expected_pty_id: ptyIdToUse,
          match: e.payload.pty_id === ptyIdToUse,
          data_preview: e.payload.data.substring(0, 100)
        });
        
        if (e.payload.pty_id === ptyIdToUse) {
          processOutputData(e.payload.data);
        }
      });
    } else {
      // In Server mode, use adapter's onData
      const adapterInstance = await getAdapter();
      unlistenOutput = adapterInstance.terminal.onData((event) => {
        console.log('[AgentTaskView] Received terminal data event:', {
          received_pty_id: event.ptyId,
          expected_pty_id: ptyIdToUse,
          match: event.ptyId === ptyIdToUse,
          data_preview: event.data.substring(0, 100)
        });
        
        if (event.ptyId === ptyIdToUse) {
          processOutputData(event.data);
        }
      });
    }
    
    console.log('[AgentTaskView] Event listener setup completed');
  } catch (error) {
    console.error('[AgentTaskView] Failed to setup event listener:', error);
  }
});

onUnmounted(() => {
  console.log('[AgentTaskView] Unmounted for ptyId:', props.ptyId);
  if (unlistenOutput) {
    unlistenOutput();
    unlistenOutput = null;
  }
});

// Debug: Log when component is created
console.log('[AgentTaskView] Component created for ptyId:', props.ptyId, 'tab:', props.tab.id);

const getMessageClass = (message: JsonMessage): string => {
  return `message-${message.type}`;
};

const getMessageTypeLabel = (message: JsonMessage): string => {
  if (message.type === 'system') {
    return `System${message.subtype ? ` (${message.subtype})` : ''}`;
  }
  if (message.type === 'user') {
    return 'User';
  }
  if (message.type === 'assistant') {
    return 'Assistant';
  }
  if (message.type === 'thinking') {
    return `Thinking${message.subtype ? ` (${message.subtype})` : ''}`;
  }
  if (message.type === 'tool_call') {
    return `Tool Call${message.subtype ? ` (${message.subtype})` : ''}`;
  }
  return message.type;
};

const formatMessageContent = (message: JsonMessage): string => {
  if (message.type === 'system') {
    return JSON.stringify({
      subtype: message.subtype,
      apiKeySource: message.apiKeySource,
      cwd: message.cwd,
      session_id: message.session_id,
      model: message.model,
      permissionMode: message.permissionMode,
    }, null, 2);
  }
  if (message.type === 'user' || message.type === 'assistant') {
    return JSON.stringify(message.message, null, 2);
  }
  if (message.type === 'tool_call') {
    return JSON.stringify(message.tool_call, null, 2);
  }
  return JSON.stringify(message, null, 2);
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...({ fractionalSecondDigits: 3 } as Intl.DateTimeFormatOptions)
  });
};
</script>

<style scoped>
.agent-task-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  color: #c0c0c0;
  font-family: 'Cascadia Code', 'Fira Code', 'Source Code Pro', Menlo, Monaco, 'Courier New', monospace;
  font-size: 13px;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  cursor: text;
}

.agent-output-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.json-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.json-message {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  padding: 12px;
  border-left: 3px solid rgba(255, 255, 255, 0.2);
}

.message-system {
  border-left-color: #8be9fd;
}

.message-user {
  border-left-color: #50fa7b;
}

.message-assistant {
  border-left-color: #bd93f9;
}

.message-thinking {
  border-left-color: #f1fa8c;
}

.message-tool_call {
  border-left-color: #ff79c6;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.message-type {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.message-timestamp {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.message-content {
  color: rgba(255, 255, 255, 0.8);
}

.message-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.5;
}

.thinking-content {
  display: flex;
  align-items: center;
  padding: 12px 0;
}

/* Thinking Animation */
.thinking-animation {
  display: flex;
  align-items: center;
  gap: 12px;
}

.thinking-spinner {
  display: flex;
  align-items: center;
  gap: 4px;
}

.spinner-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(241, 250, 140, 0.8);
  animation: thinking-pulse 1.4s ease-in-out infinite;
}

.spinner-dot:nth-child(1) {
  animation-delay: 0s;
}

.spinner-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.spinner-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes thinking-pulse {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1.2);
    opacity: 1;
  }
}

.thinking-label {
  color: rgba(241, 250, 140, 0.9);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* Thinking Completed */
.thinking-completed {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(241, 250, 140, 0.8);
}

.completed-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(241, 250, 140, 0.2);
  color: rgba(241, 250, 140, 0.9);
  font-size: 12px;
  font-weight: bold;
  animation: completed-fade-in 0.3s ease-in;
}

@keyframes completed-fade-in {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.completed-text {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.3px;
}

/* Assistant Content Styles */
.assistant-content {
  color: rgba(255, 255, 255, 0.9);
}

.assistant-content-item {
  margin-bottom: 8px;
}

.assistant-content-item:last-child {
  margin-bottom: 0;
}

.assistant-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.6;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  padding: 8px 0;
}

.assistant-other {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 12px;
}

.request-section {
  border-bottom: 2px solid rgba(80, 250, 123, 0.3);
  padding: 16px;
  background: rgba(80, 250, 123, 0.05);
}

.request-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.request-header h3 {
  margin: 0;
  color: #50fa7b;
  font-size: 14px;
  font-weight: 600;
}

.request-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.request-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.3px;
  transition: all 0.2s ease;
}

.model-tag {
  background: rgba(139, 233, 253, 0.15);
  border: 1px solid rgba(139, 233, 253, 0.3);
  color: rgba(139, 233, 253, 0.9);
}

.model-tag:hover {
  background: rgba(139, 233, 253, 0.2);
  border-color: rgba(139, 233, 253, 0.4);
}

.cwd-tag {
  background: rgba(80, 250, 123, 0.15);
  border: 1px solid rgba(80, 250, 123, 0.3);
  color: rgba(80, 250, 123, 0.9);
}

.cwd-tag:hover {
  background: rgba(80, 250, 123, 0.2);
  border-color: rgba(80, 250, 123, 0.4);
}

.tag-icon {
  font-size: 12px;
  opacity: 0.9;
}

.tag-text {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-init-info {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.init-info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.init-label {
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.init-value {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

.request-content {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  padding: 12px;
}

.request-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.9);
}

.request-text {
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  line-height: 1.6;
}

.content-item {
  margin-bottom: 8px;
}

.content-item:last-child {
  margin-bottom: 0;
}

.text-content {
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* System Init Card Styles */
.system-init-card {
  background: linear-gradient(135deg, rgba(139, 233, 253, 0.1) 0%, rgba(139, 233, 253, 0.05) 100%);
  border: 1px solid rgba(139, 233, 253, 0.25);
  border-radius: 10px;
  padding: 20px;
  margin: 8px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.system-init-card:hover {
  border-color: rgba(139, 233, 253, 0.4);
  box-shadow: 0 4px 12px rgba(139, 233, 253, 0.15);
}

.system-init-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 18px;
}

@media (max-width: 768px) {
  .system-init-grid {
    grid-template-columns: 1fr;
  }
}

.system-info-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.system-info-full {
  grid-column: 1 / -1;
}

.info-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(139, 233, 253, 0.95);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 2px;
}

.info-icon {
  font-size: 16px;
  opacity: 0.9;
  filter: drop-shadow(0 1px 2px rgba(139, 233, 253, 0.3));
}

.info-value {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-word;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 6px;
  border-left: 3px solid rgba(139, 233, 253, 0.5);
  transition: all 0.2s ease;
  line-height: 1.5;
}

.info-value:hover {
  background: rgba(0, 0, 0, 0.35);
  border-left-color: rgba(139, 233, 253, 0.7);
}

.info-value-monospace {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Cascadia Code', 'Fira Code', monospace;
  font-size: 11px;
  color: rgba(139, 233, 253, 0.95);
  letter-spacing: 0.3px;
}

.result-section {
  border-top: 2px solid rgba(0, 208, 132, 0.3);
  padding: 16px;
  background: rgba(0, 208, 132, 0.05);
  display: flex;
  flex-direction: column;
  height: 300px;
  max-height: 300px;
}

.result-header {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.result-header h3 {
  margin: 0;
  color: #00d084;
  font-size: 14px;
  font-weight: 600;
}

.result-content {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  padding: 12px;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  min-height: 0;
}

.result-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.9);
}

.result-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
  padding: 8px 0;
  margin: 0;
}

/* Result content scrollbar styling */
.result-content::-webkit-scrollbar {
  width: 8px;
}

.result-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.result-content::-webkit-scrollbar-thumb {
  background: rgba(0, 208, 132, 0.3);
  border-radius: 4px;
}

.result-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 208, 132, 0.5);
}

/* Tool Call Styles */
.tool-call-content {
  color: rgba(255, 255, 255, 0.9);
}

.tool-call-command {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-call-mcp {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tool-call-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 121, 198, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.tool-call-command-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 10px 12px;
  border-left: 3px solid rgba(255, 121, 198, 0.5);
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.5;
}

.tool-call-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tool-call-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tool-call-item-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 121, 198, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.tool-call-item-value {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 8px 10px;
  border-left: 3px solid rgba(255, 121, 198, 0.5);
}

.tool-call-arguments {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Cascadia Code', 'Fira Code', monospace;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 10px 12px;
  border-left: 3px solid rgba(255, 121, 198, 0.5);
}

.assistant-text-group {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.assistant-text-group .assistant-content-item {
  margin-bottom: 0;
}

/* Scrollbar styling */
.json-messages::-webkit-scrollbar {
  width: 8px;
}

.json-messages::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

.json-messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.json-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 48px;
}

.empty-message {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
}

.empty-message p {
  margin: 8px 0;
  font-size: 14px;
}

.empty-detail {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  font-family: 'Cascadia Code', 'Fira Code', 'Source Code Pro', Menlo, Monaco, 'Courier New', monospace;
}
</style>
