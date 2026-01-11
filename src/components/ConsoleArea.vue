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
  <div class="console-area" :class="{ 'light-theme': effectiveTheme === 'light' }">
    <!-- Welcome screen when no tabs and no history selected -->
    <WelcomeScreen
      v-if="terminalStore.tabs.length === 0 && !uiStore.selectedHistoryItem"
      :effective-theme="effectiveTheme"
    >
      <!-- Add terminal button to welcome screen -->
      <template #actions>
        <n-button type="primary" @click="openShellTerminal">
          <template #icon>
            <component :is="iconComponents.terminal" />
          </template>
          {{ t('terminal.open') }}
        </n-button>
      </template>
    </WelcomeScreen>

    <!-- Terminal tabs area -->
    <div v-else class="console-content">
      <!-- Tab bar -->
      <div class="terminal-tabs">
        <n-scrollbar x-scrollable class="tabs-scrollbar">
          <div class="tabs-container">
            <!-- Terminal tabs -->
            <div
              v-for="tab in terminalStore.tabs"
              :key="tab.id"
              class="terminal-tab"
              :class="{ 
                active: terminalStore.activeTabId === tab.id,
                running: (tab.type === 'task' || tab.type === 'shell') && tab.status === 'running',
                success: (tab.type === 'task' || tab.type === 'shell') && tab.status === 'success',
                error: (tab.type === 'task' || tab.type === 'shell') && tab.status === 'error'
              }"
              draggable="true"
              @dragstart="handleDragStart($event, tab)"
              @click="terminalStore.setActiveTab(tab.id)"
            >
              <span class="tab-icon">
                <component :is="getTabIcon(tab)" />
              </span>
              <span class="tab-label">{{ getTabLabel(tab) }}</span>
              <span 
                class="tab-close" 
                @click.stop="closeTab(tab.id)"
              >
                <component :is="iconComponents.close" />
              </span>
            </div>

            <!-- Add terminal button -->
            <div class="add-tab-button" @click="openShellTerminal">
              <component :is="iconComponents.newConfig" />
            </div>
          </div>
        </n-scrollbar>
      </div>

      <!-- Active terminal content -->
      <div class="terminal-content">
        <!-- Settings tab -->
        <div v-show="terminalStore.activeTab?.type === 'settings'" class="settings-content-wrapper">
          <SettingsPanel v-if="terminalStore.activeTab?.type === 'settings'" :initial-tab="terminalStore.activeTab.initialTab" />
        </div>
        
        <!-- Notifications tab -->
        <div v-show="terminalStore.activeTab?.type === 'notifications'" class="notifications-content-wrapper">
          <NotificationsPanel v-if="terminalStore.activeTab?.type === 'notifications'" />
        </div>
        
        <!-- Port Management tab -->
        <div v-show="terminalStore.activeTab?.type === 'port-management'" class="port-management-content-wrapper">
          <PortManagementPanel v-if="terminalStore.activeTab?.type === 'port-management'" />
        </div>
        
        <!-- AI Collaboration tab -->
        <div v-show="terminalStore.activeTab?.type === 'ai-collab'" class="ai-collab-content-wrapper">
          <AICollabPanel 
            v-if="terminalStore.activeTab?.type === 'ai-collab' && terminalStore.activeTab.collabSessionId" 
            :session-id="terminalStore.activeTab.collabSessionId" 
          />
        </div>
        
        <!-- Terminal tabs (task or shell) - Always render terminals, use v-show to preserve instances -->
        <div v-show="terminalStore.activeTab && (terminalStore.activeTab.type === 'task' || terminalStore.activeTab.type === 'shell')" class="terminal-tab-content">
          <!-- Terminal toolbar (only for task/shell tabs) -->
          <n-space v-if="terminalStore.activeTab && (terminalStore.activeTab.type === 'task' || terminalStore.activeTab.type === 'shell')" class="console-toolbar" size="small">
            <!-- 停止按钮 (仅运行中显示) -->
            <n-button
              v-if="terminalStore.activeTab.status === 'running'"
              size="small"
              text
              @click="handleStopTask"
            >
              <template #icon>
                <component :is="iconComponents.stop(true)" />
              </template>
            </n-button>

            <!-- 重启按钮 (仅任务类型显示) -->
            <n-button
              v-if="terminalStore.activeTab.type === 'task'"
              size="small"
              text
              @click="handleRestartTask"
            >
              <template #icon>
                <component :is="iconComponents.replay" />
              </template>
            </n-button>

            <!-- 清空按钮 -->
            <n-button size="small" text @click="handleClearTerminal">
              <template #icon>
                <component :is="iconComponents.clear" />
              </template>
            </n-button>
          </n-space>

          <!-- Terminal view - render all terminal tabs, show only active one -->
          <!-- IMPORTANT: Always render terminals (even when settings tab is active) to preserve instances -->
          <div 
            class="console-output-container terminal-wrapper" 
            :class="{ 'split-grid': terminalStore.isSplitMode }"
          >
            <div 
              v-for="tab in terminalStore.tabs.filter(t => t.type === 'task' || t.type === 'shell')"
              v-show="shouldShowTab(tab.id)"
              :key="tab.id"
              class="terminal-view-wrapper"
              :class="{ 'split-active': terminalStore.isSplitMode && terminalStore.activeTabId === tab.id }"
              :style="getTabStyle(tab.id)"
              @click.capture="handleSplitClick(tab.id)"
              @dragover.prevent
              @drop="handleDropOnTab($event, tab.id)"
            >
              <TerminalView
                :pty-id="tab.ptyId"
                :theme="effectiveTheme"
                :cwd="getTabCwd(tab)"
                :attach-only="tab.type === 'task'"
                :ref="(el) => setTerminalRef(tab.id, el)"
                @ready="() => onTerminalReady(tab.id)"
                @exit="(code) => onTerminalExit(tab.id, code)"
                @error="onTerminalError"
              />
            </div>

            <!-- Split Placeholders -->
            <template v-if="terminalStore.isSplitMode">
              <div 
                v-for="(splitTabId, index) in terminalStore.splitTabs" 
                v-show="!splitTabId"
                :key="'split-placeholder-' + index"
                class="split-placeholder"
                :style="getSplitStyle(index)"
                @dragover.prevent
                @drop="handleDropOnSplit($event, index)"
              >
                <n-text depth="3">Drop Tab Here</n-text>
              </div>
            </template>
          </div>
        </div>

        <!-- History output view (when history selected but no terminal tab) -->
        <div v-show="!terminalStore.activeTab && showHistoryOutput" class="history-output-wrapper">
          <!-- History toolbar -->
          <n-space class="console-toolbar" size="small">
            <!-- 命令信息 -->
            <n-text depth="3" class="command-display">
              {{ uiStore.selectedHistoryItem?.command }}
            </n-text>

            <!-- 状态标签 -->
            <n-tag 
              :type="uiStore.selectedHistoryItem?.status === 'success' ? 'success' : 'error'"
              size="small"
            >
              {{ uiStore.selectedHistoryItem?.status === 'success' ? 'Exit: 0' : 'Exit: N/A' }}
            </n-tag>
            
            <!-- 时间信息 -->
            <n-text depth="3" class="history-time">
              {{ formatHistoryTime(uiStore.selectedHistoryItem?.timestamp) }}
            </n-text>
          </n-space>

          <!-- History output -->
          <div class="console-output-container history-output-wrapper">
            <n-scrollbar class="history-output-scrollbar">
              <div v-if="isLoadingHistoryOutput" class="history-loading">
                {{ t('console.loading') || 'Loading...' }}
              </div>
              <pre v-else class="history-output" v-html="formatAnsiOutput(currentHistoryOutput || t('console.noOutput'))"></pre>
            </n-scrollbar>
          </div>
        </div>

        <!-- No active tab -->
        <div v-show="!terminalStore.activeTab && !showHistoryOutput" class="no-terminal">
          <n-empty :description="t('console.noOutput')">
            <template #extra>
              <n-button size="small" @click="openShellTerminal">
                {{ t('terminal.new') }}
              </n-button>
            </template>
          </n-empty>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { NSpace, NButton, NScrollbar, NText, NTag, NEmpty, useMessage } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useUIStore } from "../stores/ui";
import { useTheme } from "../composables/useTheme";
import { useRunConfigStore } from "../stores/runConfig";
import { useTerminalStore, type TerminalTab } from "../stores/terminal";
import { useSettingsStore } from "../stores/settings";
import { useTaskManagerStore } from "../stores/taskManager";
import { iconComponents, svgIcons, getCommandIconName } from "../utils/icons";
import { ansiToHtml } from "../utils/ansiUtils";
import WelcomeScreen from "./WelcomeScreen.vue";
import TerminalView from "./TerminalView.vue";
import SettingsPanel from "./settings/SettingsPanel.vue";
import NotificationsPanel from "./NotificationsPanel.vue";
import PortManagementPanel from "./PortManagementPanel.vue";
import AICollabPanel from "./AICollabPanel.vue";

const { t } = useI18n();
const message = useMessage();
const uiStore = useUIStore();
const { effectiveTheme } = useTheme();
const runConfigStore = useRunConfigStore();
const terminalStore = useTerminalStore();
const taskManager = useTaskManagerStore();

// Split Mode & Drag Drop Logic
const shouldShowTab = (tabId: string) => {
  if (terminalStore.isSplitMode) {
    return terminalStore.splitTabs.includes(tabId);
  }
  return terminalStore.activeTabId === tabId;
};

const getTabStyle = (tabId: string) => {
  if (!terminalStore.isSplitMode) return {};
  
  const index = terminalStore.splitTabs.indexOf(tabId);
  if (index === -1) return { display: 'none' };
  
  const row = Math.floor(index / 2) + 1;
  const col = (index % 2) + 1;
  
  return {
    gridRow: row,
    gridColumn: col,
  };
};

const getSplitStyle = (index: number) => {
  const row = Math.floor(index / 2) + 1;
  const col = (index % 2) + 1;
  return {
    gridRow: row,
    gridColumn: col
  };
};

const handleSplitClick = (tabId: string) => {
  terminalStore.setActiveTab(tabId);
  // Focus terminal
  const termRef = terminalRefs.value.get(tabId);
  if (termRef) {
    termRef.focus();
  }
};

const handleDragStart = (event: DragEvent, tab: TerminalTab) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', tab.id);
    event.dataTransfer.effectAllowed = 'move';
  }
};

const handleDropOnSplit = (event: DragEvent, index: number) => {
  const tabId = event.dataTransfer?.getData('text/plain');
  if (tabId) {
    terminalStore.setSplitTab(index, tabId);
    terminalStore.setActiveTab(tabId); 
    
    nextTick(() => {
        const termRef = terminalRefs.value.get(tabId);
        if (termRef) termRef.focus();
    });
  }
};

const handleDropOnTab = (event: DragEvent, targetTabId: string) => {
  const tabId = event.dataTransfer?.getData('text/plain');
  if (tabId && tabId !== targetTabId && terminalStore.isSplitMode) {
    const index = terminalStore.splitTabs.indexOf(targetTabId);
    if (index !== -1) {
      terminalStore.setSplitTab(index, tabId);
      terminalStore.setActiveTab(tabId);
      nextTick(() => {
          const termRef = terminalRefs.value.get(tabId);
          if (termRef) termRef.focus();
      });
    }
  }
};

const terminalRefs = ref<Map<string, InstanceType<typeof TerminalView> | null>>(new Map());

// Set terminal ref for a specific tab
const setTerminalRef = (tabId: string, el: any) => {
  if (el) {
    terminalRefs.value.set(tabId, el);
  } else {
    terminalRefs.value.delete(tabId);
  }
};

// Get active terminal ref
const getActiveTerminalRef = () => {
  const activeTabId = terminalStore.activeTabId;
  return activeTabId ? terminalRefs.value.get(activeTabId) : null;
};

// History output content (may be loaded from log file)
const historyOutputContent = ref<string>('');
const isLoadingHistoryOutput = ref(false);

// Computed: show history output when history is selected but terminal tab doesn't exist
const showHistoryOutput = computed(() => {
  const historyItem = uiStore.selectedHistoryItem;
  if (!historyItem) return false;
  
  // If the terminal tab exists, don't show history output (terminal will be shown)
  if (historyItem.terminalTabId) {
    const tabExists = terminalStore.tabs.some(t => t.id === historyItem.terminalTabId);
    if (tabExists) return false;
  }
  
  // Show history output if there's saved output or a log file
  return !!(historyItem.output || historyItem.logFilename || historyOutputContent.value);
});

// Load history output from log file if needed
const loadHistoryOutput = async (historyItem: typeof uiStore.selectedHistoryItem) => {
  if (!historyItem) {
    historyOutputContent.value = '';
    return;
  }
  
  // If we already have output in the history item, use that
  if (historyItem.output) {
    historyOutputContent.value = historyItem.output;
    return;
  }
  
  // If we have a log file, try to load from it
  if (historyItem.logFilename) {
    isLoadingHistoryOutput.value = true;
    try {
      const content = await runConfigStore.readLogFile(historyItem.logFilename);
      historyOutputContent.value = content || '';
      
      // Also update the history item's output for caching
      if (content) {
        runConfigStore.updateHistory(historyItem.id, { output: content });
      }
    } catch (error) {
      console.error('[ConsoleArea] Failed to load log file:', error);
      historyOutputContent.value = '';
    } finally {
      isLoadingHistoryOutput.value = false;
    }
  } else {
    historyOutputContent.value = '';
  }
};

// Get the current history output (from item or loaded from file)
const currentHistoryOutput = computed(() => {
  const historyItem = uiStore.selectedHistoryItem;
  if (!historyItem) return '';
  return historyItem.output || historyOutputContent.value || '';
});

// Format ANSI escape codes in output to HTML
const formatAnsiOutput = (output: string): string => {
  return ansiToHtml(output);
};

// Format timestamp for history display
const formatHistoryTime = (timestamp?: Date): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString();
};

// Process stats refresh interval
let statsInterval: ReturnType<typeof setInterval> | null = null;

// Refresh process stats for running tabs
const refreshProcessStats = async () => {
  for (const tab of terminalStore.runningTabs) {
    await terminalStore.getTabProcessStats(tab.id);
  }
};

// Initialize terminal store listeners
onMounted(async () => {
  await terminalStore.initListeners();
  
  // Start stats refresh interval (every 2 seconds)
  statsInterval = setInterval(refreshProcessStats, 2000);
  // Initial refresh
  refreshProcessStats();
});

onUnmounted(() => {
  terminalStore.cleanupListeners();
  
  // Clear stats interval
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
});

// Watch for selected history item changes - switch to its terminal if running
watch(
  () => uiStore.selectedHistoryItem,
  async (historyItem) => {
    if (historyItem?.terminalTabId) {
      // Check if terminal tab exists
      const tabExists = terminalStore.tabs.some(t => t.id === historyItem.terminalTabId);
      if (tabExists) {
        // Switch to the terminal tab for this history item
        terminalStore.setActiveTab(historyItem.terminalTabId);
        return;
      }
    }
    
    // If no tab exists, load history output (from memory or log file)
    await loadHistoryOutput(historyItem);
  },
  { immediate: true }
);

// Watch for active tab changes - focus terminal and fit size
watch(
  () => terminalStore.activeTabId,
  (newTabId, oldTabId) => {
    if (newTabId) {
      const activeTab = terminalStore.activeTab;
      // Only handle terminal tabs (task or shell), not special tabs like port-management
      if (activeTab && (activeTab.type === 'task' || activeTab.type === 'shell')) {
        // Use nextTick with a longer delay when switching from non-terminal tabs
        // This ensures v-show has taken effect and terminal container is visible
        const oldTab = oldTabId ? terminalStore.tabs.find(t => t.id === oldTabId) : null;
        const isSwitchingFromNonTerminalTab = oldTab && 
          !['task', 'shell'].includes(oldTab.type);
        const delay = isSwitchingFromNonTerminalTab 
          ? 200 // Longer delay when switching from settings/notifications tabs
          : 50; // Normal delay for tab-to-tab switches
        
        nextTick(() => {
          setTimeout(() => {
            const ref = terminalRefs.value.get(newTabId);
            if (ref) {
              // Always try to restore renderer when switching from non-terminal tabs
              // For normal tab switches, also try restore to handle any edge cases
              if (isSwitchingFromNonTerminalTab && ref.restoreRenderer) {
                console.log('[ConsoleArea] Restoring renderer after switching from non-terminal tab');
                ref.restoreRenderer();
              } else {
                // For normal tab switches, try restore first, then fallback to fit/focus
                if (ref.restoreRenderer) {
                  console.log('[ConsoleArea] Restoring renderer after tab switch');
                  ref.restoreRenderer();
                } else {
                  ref.fit();
                  setTimeout(() => {
                    ref.fit();
                    ref.focus();
                  }, 50);
                }
              }
            } else {
              console.warn('[ConsoleArea] Terminal ref not found for tab:', newTabId);
            }
          }, delay);
        });
      }
    }
  }
);

// Watch for tabs being removed - clean up refs
watch(
  () => terminalStore.tabs,
  (newTabs) => {
    const tabIds = new Set(newTabs.map(t => t.id));
    // Remove refs for tabs that no longer exist
    for (const [tabId] of terminalRefs.value) {
      if (!tabIds.has(tabId)) {
        terminalRefs.value.delete(tabId);
      }
    }
  },
  { deep: true }
);

// Get icon for tab based on type, command, and status
const getTabIcon = (tab: TerminalTab) => {
  // For settings tab
  if (tab.type === 'settings') {
    return svgIcons.settings;
  }
  
  // For notifications tab
  if (tab.type === 'notifications') {
    return svgIcons.notifications;
  }
  
  // For port management tab
  if (tab.type === 'port-management') {
    return svgIcons.network;
  }
  
  // For AI collaboration tab
  if (tab.type === 'ai-collab') {
    return iconComponents.robot;
  }
  
  // For task tabs, use command-based icon
  if (tab.type === 'task' && tab.execParams?.command) {
    const settingsStore = useSettingsStore();
    const customIcons = settingsStore.settings.commandIcons || {};
    const iconName = getCommandIconName(tab.execParams.command, customIcons);
    if (iconName !== 'task' && svgIcons[iconName as keyof typeof svgIcons]) {
      return svgIcons[iconName as keyof typeof svgIcons];
    }
    return iconComponents.task;
  }
  
  // For shell tabs (only show status icons for shell/task tabs)
  if (tab.type === 'shell') {
    if (tab.status === 'success') {
      return iconComponents.success;
    }
    if (tab.status === 'error') {
      return iconComponents.error;
    }
    return iconComponents.terminal;
  }
  
  return iconComponents.terminal;
};

// Get translated label for tab
const getTabLabel = (tab: TerminalTab): string => {
  if (tab.type === 'settings') {
    return t('task.settings');
  }
  if (tab.type === 'notifications') {
    return t('notifications.title');
  }
  if (tab.type === 'port-management') {
    return t('task.portManagement');
  }
  if (tab.type === 'ai-collab') {
    return tab.label || t('aiCollab.title');
  }
  return tab.label;
};

// Get working directory for a tab
const getTabCwd = (tab: TerminalTab) => {
  if (tab.taskId) {
    const config = runConfigStore.getConfig(tab.taskId);
    return config?.workingDirectory;
  }
  return undefined;
};

// Open a new shell terminal
const openShellTerminal = async () => {
  try {
    await terminalStore.createShellTerminal({
      label: t('terminal.title'),
    });
  } catch (error) {
    console.error('Failed to open shell terminal:', error);
    message.error(t('terminal.error', { error: String(error) }));
  }
};

// Close a tab
const closeTab = async (tabId: string) => {
  await terminalStore.closeTab(tabId);
};

// Stop the current task
const handleStopTask = async () => {
  const tab = terminalStore.activeTab;
  if (tab) {
    try {
      await terminalStore.stopTask(tab.id);
    } catch (error) {
      console.error('Failed to stop task:', error);
      message.error(t('console.stopFailed'));
    }
  }
};

// Restart the current task
const handleRestartTask = async () => {
  const tab = terminalStore.activeTab;
  if (!tab || !tab.taskId) {
    console.warn('[ConsoleArea] Cannot restart: no active task tab or no taskId');
    return;
  }

  try {
    // Find the task
    const task = taskManager.findTask(tab.taskId);
    if (!task) {
      message.error(t('console.restartFailed'));
      console.warn('[ConsoleArea] Task not found:', tab.taskId);
      return;
    }

    // If task is running, stop it first and close the old tab
    if (tab.status === 'running') {
      try {
        await terminalStore.stopTask(tab.id);
        await terminalStore.closeTab(tab.id);
        console.log('[ConsoleArea] Stopped and closed old task tab:', tab.id);
      } catch (error) {
        console.warn('[ConsoleArea] Failed to stop/close task:', error);
      }
    }

    // Execute the task (this will create a new tab)
    await taskManager.executeTask(task);
    console.log('[ConsoleArea] Task restarted:', task.name);

  } catch (error) {
    console.error('[ConsoleArea] Failed to restart task:', error);
    message.error(t('console.restartFailed'));
  }
};

// Clear terminal
const handleClearTerminal = () => {
  getActiveTerminalRef()?.clear();
};

// Terminal event handlers
const onTerminalReady = async (tabId: string) => {
  console.log('[Terminal] Ready:', tabId);
  
  // Start pending task if this is a task tab
  const tab = terminalStore.tabs.find(t => t.id === tabId);
  if (tab && tab.type === 'task' && tab.status === 'pending') {
    try {
      await terminalStore.startTask(tabId);
    } catch (error) {
      console.error('[Terminal] Failed to start task:', error);
    }
  }
  
  // Focus only if this is the active tab
  if (terminalStore.activeTabId === tabId) {
    const ref = terminalRefs.value.get(tabId);
    ref?.focus();
  }
};

const onTerminalExit = (tabId: string, exitCode: number | null) => {
  console.log('[Terminal] Exited with code:', exitCode, 'tab:', tabId);
  // Status update is handled by terminal store listening to pty-exit event
};

const onTerminalError = (error: string) => {
  console.error('[Terminal] Error:', error);
  message.error(t('terminal.error', { error }));
};
</script>

<style scoped>
.terminal-tabs {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  height: 36px;
  padding: 0 8px;
}

.tabs-scrollbar {
  flex: 1;
  height: 100%;
}

.tabs-container {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 4px;
}

.terminal-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  background: transparent;
  transition: all 0.2s ease;
  white-space: nowrap;
  max-width: 150px;
}

.terminal-tab:hover {
  background: rgba(255, 255, 255, 0.1);
}

.terminal-tab.active {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.terminal-tab.running .tab-icon {
  color: #00d084;
}

.terminal-tab.success .tab-icon {
  color: #52c41a;
}

.terminal-tab.error .tab-icon {
  color: #ff4d4f;
}

.tab-icon {
  display: flex;
  align-items: center;
  font-size: 14px;
}

.tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close {
  display: flex;
  align-items: center;
  opacity: 0;
  font-size: 12px;
  padding: 2px;
  border-radius: 2px;
  transition: opacity 0.2s ease;
}

.terminal-tab:hover .tab-close {
  opacity: 0.7;
}

.tab-close:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

.add-tab-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.2s ease;
}

.add-tab-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.terminal-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.settings-content-wrapper,
.notifications-content-wrapper,
.port-management-content-wrapper,
.ai-collab-content-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: auto;
}

.terminal-tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.terminal-wrapper {
  padding: 0;
}

.no-terminal {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Light theme adjustments */
:global(.n-config-provider--light) .terminal-tabs,
.console-area.light-theme .terminal-tabs {
  background: rgba(0, 0, 0, 0.03);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

:global(.n-config-provider--light) .terminal-tab,
.console-area.light-theme .terminal-tab {
  color: rgba(0, 0, 0, 0.65);
}

:global(.n-config-provider--light) .terminal-tab:hover,
.console-area.light-theme .terminal-tab:hover {
  background: rgba(0, 0, 0, 0.05);
}

:global(.n-config-provider--light) .terminal-tab.active,
.console-area.light-theme .terminal-tab.active {
  background: rgba(0, 0, 0, 0.08);
  color: #000000;
}

:global(.n-config-provider--light) .add-tab-button,
.console-area.light-theme .add-tab-button {
  color: rgba(0, 0, 0, 0.45);
}

:global(.n-config-provider--light) .add-tab-button:hover,
.console-area.light-theme .add-tab-button:hover {
  background: rgba(0, 0, 0, 0.05);
  color: rgba(0, 0, 0, 0.65);
}

/* History output styles */
.history-output-wrapper {
  flex: 1;
  background: #1e1e1e;
  overflow: hidden;
}

.history-output-scrollbar {
  height: 100%;
}

.history-output {
  margin: 0;
  padding: 12px 16px;
  font-family: 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #d4d4d4;
  white-space: pre-wrap;
  word-break: break-all;
}

.history-loading {
  padding: 12px 16px;
  color: #888;
  font-size: 13px;
}

.history-time {
  margin-left: auto;
  font-size: 12px;
}

:global(.n-config-provider--light) .history-output-wrapper,
.console-area.light-theme .history-output-wrapper {
  background: #f5f5f5;
}

:global(.n-config-provider--light) .history-output,
.console-area.light-theme .history-output {
  color: #333333;
}

:global(.n-config-provider--light) .history-loading,
.console-area.light-theme .history-loading {
  color: #666;
}

/* Split Mode Grid Styles */
.terminal-wrapper.split-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 1px;
  background-color: var(--n-border-color);
}

.terminal-view-wrapper {
  height: 100%;
  width: 100%;
  overflow: hidden;
  /* Use theme background to cover grid gap */
  background-color: #1e1e1e;
  position: relative;
  box-sizing: border-box;
  border: 1px solid transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

/* Split mode active glow effect */
.terminal-view-wrapper.split-active {
  border-color: var(--primary-color, #18a058);
  box-shadow: 
    inset 0 0 0 1px var(--primary-color, #18a058),
    0 0 8px rgba(24, 160, 88, 0.3),
    inset 0 0 12px rgba(24, 160, 88, 0.1);
}
:global(.n-config-provider--light) .terminal-view-wrapper,
.console-area.light-theme .terminal-view-wrapper {
  background-color: #ffffff;
}

:global(.n-config-provider--light) .terminal-view-wrapper.split-active,
.console-area.light-theme .terminal-view-wrapper.split-active {
  border-color: var(--primary-color, #18a058);
  box-shadow: 
    inset 0 0 0 1px var(--primary-color, #18a058),
    0 0 8px rgba(24, 160, 88, 0.25),
    inset 0 0 12px rgba(24, 160, 88, 0.08);
}

.split-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(128, 128, 128, 0.3);
  margin: 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.split-placeholder:hover {
  background-color: rgba(128, 128, 128, 0.1);
}

.add-tab-button.active {
  background-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}
:global(.n-config-provider--light) .add-tab-button.active,
.console-area.light-theme .add-tab-button.active {
  background-color: rgba(0, 0, 0, 0.1);
  color: #000;
}
</style>
