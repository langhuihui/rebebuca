/**
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
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type TerminalStatus = 'running' | 'success' | 'error' | 'closed';
export type TerminalType = 'task' | 'shell';

export interface TaskExecutionParams {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface TerminalTab {
  id: string;
  type: TerminalType;
  label: string;
  ptyId: string;
  taskId?: string;      // 关联的任务配置 ID
  historyId?: string;   // 关联的历史记录 ID
  status: TerminalStatus;
  exitCode?: number;
  startTime?: number;
  command?: string;     // 执行的命令（用于显示）
  execParams?: TaskExecutionParams; // 完整执行参数（用于重启）
  cpuUsage?: string;    // CPU 使用率
  memoryUsage?: string; // 内存使用
  pid?: number;         // 进程 PID
}

interface PtyExitEvent {
  pty_id: string;
  exit_code: number | null;
}

export const useTerminalStore = defineStore('terminal', () => {
  // Terminal tabs
  const tabs = ref<TerminalTab[]>([]);
  
  // Currently active tab ID
  const activeTabId = ref<string | null>(null);
  
  // Event listeners
  let unlistenExit: UnlistenFn | null = null;
  
  // Computed
  const activeTabs = computed(() => tabs.value.filter(t => t.status !== 'closed'));
  const runningTabs = computed(() => tabs.value.filter(t => t.status === 'running'));
  const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value));
  
  // Initialize event listeners
  const initListeners = async () => {
    if (unlistenExit) return; // Already initialized
    
    try {
      // Listen for PTY exit events
      unlistenExit = await listen<PtyExitEvent>('pty-exit', async (event) => {
        const { pty_id, exit_code } = event.payload;
        console.log('[Terminal Store] PTY exit event:', pty_id, exit_code);
        
        const tab = tabs.value.find(t => t.ptyId === pty_id);
        if (tab) {
          tab.exitCode = exit_code ?? undefined;
          tab.status = exit_code === 0 ? 'success' : 'error';
          
          // Notify taskManager that this task has exited
          try {
            const { useTaskManagerStore } = await import('./taskManager');
            const taskManager = useTaskManagerStore();
            taskManager.onTaskExit(tab.id);
          } catch (error) {
            console.error('[Terminal Store] Failed to notify taskManager:', error);
          }
          
          // Update history record if this tab has a historyId
          if (tab.historyId) {
            try {
              const { useRunConfigStore } = await import('./runConfig');
              const runConfigStore = useRunConfigStore();
              const historyItem = runConfigStore.history.find(h => h.id === tab.historyId);
              
              if (historyItem) {
                const duration = historyItem.startTime ? Date.now() - historyItem.startTime : undefined;
                await runConfigStore.updateHistory(tab.historyId, {
                  status: exit_code === 0 ? 'success' : 'error',
                  duration,
                });
                console.log('[Terminal Store] Updated history record:', tab.historyId);
              }
            } catch (error) {
              console.error('[Terminal Store] Failed to update history:', error);
            }
          }
        }
      });
    } catch (error) {
      console.error('[Terminal Store] Failed to init listeners:', error);
    }
  };
  
  // Cleanup listeners
  const cleanupListeners = () => {
    if (unlistenExit) {
      unlistenExit();
      unlistenExit = null;
    }
  };
  
  // Generate unique ID for terminal
  const generateId = () => `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Create a new shell terminal
  const createShellTerminal = async (options?: {
    cwd?: string;
    env?: Record<string, string>;
    label?: string;
  }): Promise<TerminalTab> => {
    const id = generateId();
    const ptyId = `shell-${id}`;
    
    const tab: TerminalTab = {
      id,
      type: 'shell',
      label: options?.label || 'Terminal',
      ptyId,
      status: 'running',
      startTime: Date.now(),
    };
    
    tabs.value.push(tab);
    activeTabId.value = id;
    
    return tab;
  };
  
  // Execute a task in a new terminal
  const executeTask = async (options: {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    taskId?: string;
    historyId?: string;
    label: string;
    logPath?: string;
  }): Promise<TerminalTab> => {
    const id = generateId();
    const ptyId = `task-${id}`;
    
    const tab: TerminalTab = {
      id,
      type: 'task',
      label: options.label,
      ptyId,
      taskId: options.taskId,
      historyId: options.historyId,
      status: 'running',
      startTime: Date.now(),
      command: options.args?.length 
        ? `${options.command} ${options.args.join(' ')}`
        : options.command,
      execParams: {
        command: options.command,
        args: options.args,
        cwd: options.cwd,
        env: options.env,
      },
    };
    
    tabs.value.push(tab);
    activeTabId.value = id;
    
    try {
      // Call backend to execute task
      await invoke('execute_task', {
        ptyId,
        command: options.command,
        args: options.args || [],
        options: {
          cwd: options.cwd,
          env: options.env,
          rows: 24,
          cols: 80,
          log_path: options.logPath,
        },
      });
      
      console.log('[Terminal Store] Task started:', ptyId, options.command);
      return tab;
    } catch (error) {
      console.error('[Terminal Store] Failed to execute task:', error);
      tab.status = 'error';
      throw error;
    }
  };
  
  // Close a terminal tab
  const closeTab = async (tabId: string) => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (!tab) return;
    
    // If running, try to kill the task/close the PTY
    if (tab.status === 'running') {
      try {
        // First try kill_task for task-based PTYs
        if (tab.type === 'task') {
          await invoke('kill_task', { ptyId: tab.ptyId });
        } else {
          await invoke('close_pty', { ptyId: tab.ptyId });
        }
      } catch (error) {
        console.warn('[Terminal Store] Failed to close PTY:', error);
      }
    }
    
    // Remove tab
    const index = tabs.value.findIndex(t => t.id === tabId);
    if (index !== -1) {
      tabs.value.splice(index, 1);
    }
    
    // Update active tab if needed
    if (activeTabId.value === tabId) {
      activeTabId.value = tabs.value.length > 0 ? tabs.value[tabs.value.length - 1].id : null;
    }
  };
  
  // Stop a running task
  const stopTask = async (tabId: string) => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (!tab || tab.status !== 'running') return;
    
    try {
      await invoke('kill_task', { ptyId: tab.ptyId });
      tab.status = 'error'; // Mark as stopped/error
      console.log('[Terminal Store] Task stopped:', tab.ptyId);
    } catch (error) {
      console.error('[Terminal Store] Failed to stop task:', error);
      throw error;
    }
  };
  
  // Restart a task using saved execution params
  const restartTask = async (tabId: string): Promise<TerminalTab | null> => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (!tab || !tab.execParams) {
      console.warn('[Terminal Store] Cannot restart: no execution params saved');
      return null;
    }
    
    // Execute with saved params
    return executeTask({
      command: tab.execParams.command,
      args: tab.execParams.args,
      cwd: tab.execParams.cwd,
      env: tab.execParams.env,
      taskId: tab.taskId,
      label: tab.label,
    });
  };
  
  // Set active tab
  const setActiveTab = (tabId: string | null) => {
    activeTabId.value = tabId;
  };
  
  // Find tab by history ID
  const findTabByHistoryId = (historyId: string) => {
    return tabs.value.find(t => t.historyId === historyId);
  };
  
  // Find tab by PTY ID
  const findTabByPtyId = (ptyId: string) => {
    return tabs.value.find(t => t.ptyId === ptyId);
  };
  
  // Update tab status
  const updateTabStatus = (tabId: string, status: TerminalStatus, exitCode?: number) => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (tab) {
      tab.status = status;
      if (exitCode !== undefined) {
        tab.exitCode = exitCode;
      }
    }
  };
  
  // Update tab process stats
  const updateTabStats = (tabId: string, stats: { cpuUsage?: string; memoryUsage?: string; pid?: number }) => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (tab) {
      if (stats.cpuUsage !== undefined) tab.cpuUsage = stats.cpuUsage;
      if (stats.memoryUsage !== undefined) tab.memoryUsage = stats.memoryUsage;
      if (stats.pid !== undefined) tab.pid = stats.pid;
    }
  };
  
  // Get process stats for a running tab
  const getTabProcessStats = async (tabId: string) => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (!tab || tab.status !== 'running') {
      return null;
    }
    
    try {
      const stats = await invoke<{
        pty_id: string;
        pid: number;
        cpu_usage: number;
        memory_usage: number;
        memory_usage_mb: string;
      }>('get_pty_process_stats', { ptyId: tab.ptyId });
      
      const cpuUsage = `${stats.cpu_usage.toFixed(1)}%`;
      const memoryUsage = stats.memory_usage_mb;
      
      updateTabStats(tabId, { cpuUsage, memoryUsage, pid: stats.pid });
      
      return { cpuUsage, memoryUsage, pid: stats.pid };
    } catch (error) {
      console.error('[Terminal Store] Failed to get process stats:', error);
      return null;
    }
  };
  
  // Clear all closed tabs
  const clearClosedTabs = () => {
    tabs.value = tabs.value.filter(t => t.status !== 'closed');
  };
  
  return {
    // State
    tabs,
    activeTabId,
    
    // Computed
    activeTabs,
    runningTabs,
    activeTab,
    
    // Methods
    initListeners,
    cleanupListeners,
    createShellTerminal,
    executeTask,
    closeTab,
    stopTask,
    restartTask,
    setActiveTab,
    findTabByHistoryId,
    findTabByPtyId,
    updateTabStatus,
    updateTabStats,
    getTabProcessStats,
    clearClosedTabs,
  };
});
