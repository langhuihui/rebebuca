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
import { getAdapter, type BackendAdapter, type TerminalExitEvent } from '../adapters';

export type TerminalStatus = 'pending' | 'running' | 'success' | 'error' | 'closed';
export type TerminalType = 'task' | 'shell';

export interface TaskExecutionParams {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  logPath?: string;
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

export const useTerminalStore = defineStore('terminal', () => {
  // Terminal tabs
  const tabs = ref<TerminalTab[]>([]);
  
  // Currently active tab ID
  const activeTabId = ref<string | null>(null);
  
  // Event listeners cleanup function
  let unlistenExit: (() => void) | null = null;
  
  // Adapter instance (cached)
  let adapter: BackendAdapter | null = null;
  
  // Get adapter instance
  const getAdapterInstance = async (): Promise<BackendAdapter> => {
    if (!adapter) {
      adapter = await getAdapter();
    }
    return adapter;
  };
  
  // Computed
  const activeTabs = computed(() => tabs.value.filter(t => t.status !== 'closed'));
  const runningTabs = computed(() => tabs.value.filter(t => t.status === 'running'));
  const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value));
  
  // Initialize event listeners
  const initListeners = async () => {
    if (unlistenExit) return; // Already initialized
    
    try {
      const adapterInstance = await getAdapterInstance();
      
      // Listen for PTY exit events via adapter
      unlistenExit = adapterInstance.terminal.onExit(async (event: TerminalExitEvent) => {
        const { ptyId, exitCode } = event;
        console.log('[Terminal Store] PTY exit event:', ptyId, exitCode);
        
        const tab = tabs.value.find(t => t.ptyId === ptyId);
        if (tab) {
          tab.exitCode = exitCode ?? undefined;
          tab.status = exitCode === 0 ? 'success' : 'error';
          
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
                  status: exitCode === 0 ? 'success' : 'error',
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
  // This creates a pending tab - call startTask() after terminal is ready
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
      status: 'pending',  // Start as pending, wait for terminal ready
      startTime: Date.now(),
      command: options.args?.length 
        ? `${options.command} ${options.args.join(' ')}`
        : options.command,
      execParams: {
        command: options.command,
        args: options.args,
        cwd: options.cwd,
        env: options.env,
        logPath: options.logPath,
      },
    };
    
    tabs.value.push(tab);
    activeTabId.value = id;
    
    console.log('[Terminal Store] Task tab created (pending):', ptyId);
    return tab;
  };
  
  // Start a pending task - call this after terminal is ready
  const startTask = async (tabId: string): Promise<void> => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (!tab || tab.status !== 'pending' || !tab.execParams) {
      console.warn('[Terminal Store] Cannot start task - invalid state:', tabId, tab?.status);
      return;
    }
    
    const { command, args, cwd, env, logPath } = tab.execParams;
    
    try {
      tab.status = 'running';
      
      const adapterInstance = await getAdapterInstance();
      const result = await adapterInstance.terminal.create({
        command,
        args,
        cwd,
        env,
        logPath,
      });
      
      // Update tab with actual ptyId from adapter
      tab.ptyId = result.ptyId;
      if (result.pid) {
        tab.pid = result.pid;
      }
      
      console.log('[Terminal Store] Task started:', tab.ptyId, command);
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
        const adapterInstance = await getAdapterInstance();
        await adapterInstance.terminal.kill(tab.ptyId);
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
      const adapterInstance = await getAdapterInstance();
      await adapterInstance.terminal.kill(tab.ptyId);
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
      logPath: tab.execParams.logPath,
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
    if (!tab || tab.status !== 'running' || !tab.pid) {
      return null;
    }
    
    try {
      const adapterInstance = await getAdapterInstance();
      const stats = await adapterInstance.system.getProcessInfo(tab.pid);
      
      if (!stats) return null;
      
      const cpuUsage = stats.cpuUsage !== undefined ? `${stats.cpuUsage.toFixed(1)}%` : undefined;
      const memoryUsage = stats.memoryUsage !== undefined ? `${(stats.memoryUsage / 1024 / 1024).toFixed(1)} MB` : undefined;
      
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
    startTask,
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
