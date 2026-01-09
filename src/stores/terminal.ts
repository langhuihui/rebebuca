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
export type TerminalType = 'task' | 'shell' | 'settings' | 'notifications' | 'port-management' | 'ai-collab';

export interface TaskExecutionParams {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  logPath?: string;
  shellPath?: string | null;
}

export interface TerminalTab {
  id: string;
  type: TerminalType;
  label: string;
  ptyId: string;        // 对于 settings 和 notifications 类型，ptyId 可以为空字符串
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
  initialTab?: string;  // 对于 settings 类型，可以指定初始 tab
  shellName?: string;   // 终端类型名称（用于状态栏显示）
  collabSessionId?: string; // 对于 ai-collab 类型，关联的协作会话 ID
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
  const runningTabs = computed(() => tabs.value.filter(t => 
    t.status === 'running' && (t.type === 'task' || t.type === 'shell')
  ));
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
        // Only process exit events for task/shell tabs, not special tabs like settings/notifications
        if (tab && (tab.type === 'task' || tab.type === 'shell')) {
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
  
  // Extract shell name from shell path
  const getShellName = (shellPath?: string | null): string | undefined => {
    if (!shellPath) return undefined;
    
    // Get the base name of the shell (last part of the path)
    const parts = shellPath.split(/[/\\]/);
    const baseName = parts[parts.length - 1] || '';
    
    // Remove extension on Windows
    const name = baseName.replace(/\.(exe|cmd|bat)$/i, '');
    
    // Map common shell names to display names
    const shellNameMap: Record<string, string> = {
      'cmd': 'CMD',
      'powershell': 'PowerShell',
      'pwsh': 'PowerShell',
      'bash': 'Bash',
      'zsh': 'Zsh',
      'fish': 'Fish',
      'sh': 'Shell',
      'dash': 'Dash',
      'ksh': 'Ksh',
      'tcsh': 'Tcsh',
      'csh': 'Csh',
      'nu': 'Nushell',
      'nushell': 'Nushell',
      'elvish': 'Elvish',
      'xonsh': 'Xonsh',
      'ion': 'Ion',
    };
    
    return shellNameMap[name.toLowerCase()] || name;
  };
  
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
    shellPath?: string | null;
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
        shellPath: options.shellPath,
      },
      shellName: getShellName(options.shellPath),
    };
    
    tabs.value.push(tab);
    activeTabId.value = id;
    
    console.log('[Terminal Store] Task tab created (pending):', ptyId);
    return tab;
  };
  
  // Start a pending task - call this after terminal is ready (only for task tabs)
  const startTask = async (tabId: string): Promise<void> => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (!tab || tab.type !== 'task' || tab.status !== 'pending' || !tab.execParams) {
      console.warn('[Terminal Store] Cannot start task - invalid state:', tabId, tab?.status);
      return;
    }
    
    const { command, args, cwd, env, logPath, shellPath } = tab.execParams;
    
    try {
      tab.status = 'running';
      
      const adapterInstance = await getAdapterInstance();
      const result = await adapterInstance.terminal.create({
        command,
        args,
        cwd,
        env,
        logPath,
        shellPath,
      });
      
      // Update tab with actual ptyId from adapter
      tab.ptyId = result.ptyId;
      if (result.pid) {
        tab.pid = result.pid;
      }
      
      // Notify taskManager to update running status (important for restart scenario)
      if (tab.taskId) {
        try {
          const { useTaskManagerStore } = await import('./taskManager');
          const taskManager = useTaskManagerStore();
          taskManager.onTaskStart(tab.taskId, tab.id);
        } catch (error) {
          console.warn('[Terminal Store] Failed to notify taskManager of task start:', error);
        }
      }
      
      // If we have a PID and historyId, try to rename the log file
      if (result.pid && tab.historyId) {
        try {
          const { useRunConfigStore } = await import('./runConfig');
          const runConfigStore = useRunConfigStore();
          const historyItem = runConfigStore.history.find(h => h.id === tab.historyId);
          if (historyItem?.logFilename && tab.taskId) {
            const { getAdapter } = await import('../adapters');
            const adapter = await getAdapter();
            const newLogFilename = await adapter.system.renameLogFile(
              historyItem.logFilename,
              tab.taskId,
              result.pid
            );
            console.log('[Terminal Store] Renamed log file:', historyItem.logFilename, '->', newLogFilename);
            // Update history with new log filename
            await runConfigStore.updateHistory(tab.historyId, {
              logFilename: newLogFilename,
            });
          }
        } catch (error) {
          console.warn('[Terminal Store] Failed to rename log file:', error);
        }
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
    
    // If running, try to kill the task/close the PTY (only for task/shell tabs)
    if (tab.status === 'running' && (tab.type === 'task' || tab.type === 'shell')) {
      try {
        const adapterInstance = await getAdapterInstance();
        await adapterInstance.terminal.kill(tab.ptyId);
      } catch (error) {
        // Ignore "PTY not found" errors - PTY was already closed
        const errorMsg = String(error);
        if (!errorMsg.includes('PTY not found') && !errorMsg.includes('not found')) {
          console.warn('[Terminal Store] Failed to close PTY:', error);
        }
      }
      
      // Notify taskManager that this task has exited (in case pty-exit event is not received)
      // This is a fallback for Windows where taskkill might not trigger the pty-exit event properly
      try {
        const { useTaskManagerStore } = await import('./taskManager');
        const taskManager = useTaskManagerStore();
        taskManager.onTaskExit(tab.id);
      } catch (error) {
        console.warn('[Terminal Store] Failed to notify taskManager on closeTab:', error);
      }
    }
    
    // For AI collab tabs, stop the session and all child processes
    if (tab.type === 'ai-collab' && tab.collabSessionId) {
      try {
        const { useAICollabStore } = await import('./aiCollab');
        const collabStore = useAICollabStore();
        await collabStore.stopSession(tab.collabSessionId);
        console.log('[Terminal Store] Stopped AI collab session:', tab.collabSessionId);
      } catch (error) {
        console.warn('[Terminal Store] Failed to stop AI collab session:', error);
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
  
  // Stop a running task (only for task/shell tabs)
  const stopTask = async (tabId: string) => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (!tab || (tab.type !== 'task' && tab.type !== 'shell') || tab.status !== 'running') return;
    
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
  
  // Restart a task using saved execution params (reuse existing tab, only for task tabs)
  const restartTask = async (tabId: string): Promise<TerminalTab | null> => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (!tab || tab.type !== 'task' || !tab.execParams) {
      console.warn('[Terminal Store] Cannot restart: no execution params saved or not a task tab');
      return null;
    }

    // Force stop the task if it's running (to handle blocked processes)
    if (tab.status === 'running') {
      try {
        await stopTask(tabId);
        console.log('[Terminal Store] Force stopped task before restart:', tab.ptyId);
      } catch (error) {
        console.warn('[Terminal Store] Failed to stop task before restart:', error);
        // Continue anyway, as we want to restart regardless
      }
    }

    // Generate new PTY ID for the restart
    const newPtyId = `task-${generateId()}`;

    // Reset tab status to pending and update PTY ID
    tab.status = 'pending';
    tab.ptyId = newPtyId;
    tab.startTime = Date.now();
    tab.exitCode = undefined;
    tab.pid = undefined;

    // Set as active tab
    activeTabId.value = tab.id;

    console.log('[Terminal Store] Task tab restarted (pending):', newPtyId, 'tabId:', tab.id);

    // Actually start the task
    await startTask(tabId);

    return tab;
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
  
  // Update tab status (only for task/shell tabs, not special tabs)
  const updateTabStatus = (tabId: string, status: TerminalStatus, exitCode?: number) => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (tab && (tab.type === 'task' || tab.type === 'shell')) {
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
  
  // Get process stats for a running tab (only for task/shell tabs)
  const getTabProcessStats = async (tabId: string) => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (!tab || (tab.type !== 'task' && tab.type !== 'shell') || tab.status !== 'running' || !tab.pid) {
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
  
  // Create a settings tab
  const createSettingsTab = (initialTab?: string): TerminalTab => {
    // Check if settings tab already exists
    const existingTab = tabs.value.find(t => t.type === 'settings');
    if (existingTab) {
      activeTabId.value = existingTab.id;
      if (initialTab && existingTab.initialTab !== initialTab) {
        existingTab.initialTab = initialTab;
      }
      return existingTab;
    }
    
    const id = generateId();
    const tab: TerminalTab = {
      id,
      type: 'settings',
      label: 'Settings',
      ptyId: '', // No PTY for settings tab
      status: 'pending', // Special tab doesn't have real status
      startTime: Date.now(),
      initialTab,
    };
    
    tabs.value.push(tab);
    activeTabId.value = id;
    return tab;
  };
  
  // Create a notifications tab
  const createNotificationsTab = (): TerminalTab => {
    // Check if notifications tab already exists
    const existingTab = tabs.value.find(t => t.type === 'notifications');
    if (existingTab) {
      activeTabId.value = existingTab.id;
      return existingTab;
    }
    
    const id = generateId();
    const tab: TerminalTab = {
      id,
      type: 'notifications',
      label: 'Notifications',
      ptyId: '', // No PTY for notifications tab
      status: 'pending', // Special tab doesn't have real status
      startTime: Date.now(),
    };
    
    tabs.value.push(tab);
    activeTabId.value = id;
    return tab;
  };
  
  // Create a port management tab
  const createPortManagementTab = (): TerminalTab => {
    // Check if port management tab already exists
    const existingTab = tabs.value.find(t => t.type === 'port-management');
    if (existingTab) {
      activeTabId.value = existingTab.id;
      return existingTab;
    }
    
    const id = generateId();
    const tab: TerminalTab = {
      id,
      type: 'port-management',
      label: 'Port Management',
      ptyId: '', // No PTY for port management tab
      status: 'running',
      startTime: Date.now(),
    };
    
    tabs.value.push(tab);
    activeTabId.value = id;
    return tab;
  };
  
  // Create an AI collaboration tab
  const createAICollabTab = (sessionId: string, label?: string): TerminalTab => {
    // Check if a tab for this session already exists
    const existingTab = tabs.value.find(t => t.type === 'ai-collab' && t.collabSessionId === sessionId);
    if (existingTab) {
      activeTabId.value = existingTab.id;
      return existingTab;
    }
    
    const id = generateId();
    const tab: TerminalTab = {
      id,
      type: 'ai-collab',
      label: label || 'AI 协作',
      ptyId: '', // No PTY for AI collab tab
      status: 'running',
      startTime: Date.now(),
      collabSessionId: sessionId,
    };
    
    tabs.value.push(tab);
    activeTabId.value = id;
    return tab;
  };
  
  // Find tab by collab session ID
  const findTabByCollabSessionId = (sessionId: string): TerminalTab | undefined => {
    return tabs.value.find(t => t.type === 'ai-collab' && t.collabSessionId === sessionId);
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
    findTabByCollabSessionId,
    updateTabStatus,
    updateTabStats,
    getTabProcessStats,
    clearClosedTabs,
    createSettingsTab,
    createNotificationsTab,
    createPortManagementTab,
    createAICollabTab,
  };
});
