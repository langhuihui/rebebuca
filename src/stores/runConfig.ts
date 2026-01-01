import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// Check if running in Tauri environment
let _isTauri: boolean | null = null;

const isTauri = () => {
  // Cache the result to avoid repeated checks
  if (_isTauri !== null) {
    return _isTauri;
  }

  try {
    // Method 1: Check for Tauri globals
    if (typeof window !== 'undefined') {
      if ((window as any).__TAURI__ ||
        (window as any).__TAURI_INTERNALS__ ||
        (window as any).__TAURI_METADATA__) {
        _isTauri = true;
        return true;
      }
    }

    // Method 2: Check user agent
    if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Tauri')) {
      _isTauri = true;
      return true;
    }

    // Method 3: Check for webview environment (common in Tauri)
    if (typeof window !== 'undefined' && (window as any).chrome && (window as any).chrome.runtime) {
      _isTauri = true;
      return true;
    }

    _isTauri = false;
    return false;
  } catch (error) {
    _isTauri = false;
    return false;
  }
};

// Safe safeInvoke function that handles browser environment
const safeInvoke = async <T = unknown>(command: string, args?: any): Promise<T | undefined> => {
  if (!isTauri()) {
    // Silent fallback in browser environment
    throw new Error(`Command '${command}' not available in browser environment`);
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, args);
  } catch (error) {
    // For process stats commands, only log as error for unexpected issues
    if (command === 'get_process_stats') {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Process not found - it has finished") ||
        errorMessage.includes("Process has finished")) {
        // This is expected behavior, don't log as error
        throw error;
      } else {
        // Log other errors but still throw them
        console.warn(`Process stats temporarily unavailable: ${errorMessage}`);
        throw error;
      }
    }
    console.error(`Failed to invoke '${command}':`, error);
    throw error;
  }
};

// Store instance for persistence
let store: any = null;

// Initialize store
const initStore = async () => {
  if (!isTauri()) {
    // Silent fallback to localStorage in browser environment
    return null;
  }

  if (!store) {
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      store = await Store.load('rebebuca-config.json');
    } catch (error) {
      console.warn('Failed to initialize Tauri store, using localStorage fallback:', error);
      return null;
    }
  }
  return store;
};

export interface RunConfig {
  id: string;
  name: string;
  command: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  arguments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TauriRunConfig {
  name: string;
  command: string;
  working_directory?: string;
  environment?: Record<string, string>;
  arguments?: string[];
}

export interface RunHistory {
  id: string;
  configId: string;
  name: string;
  command: string;
  status: 'running' | 'success' | 'error';
  timestamp: Date;
  output?: string;
  duration?: number;
  logFilename?: string;
  pid?: string; // 系统PID，用于进程管理和显示
  internalId?: string; // 内部UUID，用于事件匹配
  ptyId?: string; // PTY ID，用于终端关联
  terminalTabId?: string; // 终端 Tab ID
  startTime?: number;
  cpuUsage?: string;
  memoryUsage?: string;
  pinned?: boolean;
}

export const useRunConfigStore = defineStore('runConfig', () => {
  // List of run configurations
  const configs = ref<RunConfig[]>([]);

  // Run history records
  const history = ref<RunHistory[]>([]);

  // Initialization flag
  const initialized = ref(false);

  // Current running state
  const currentRun = ref<RunHistory | null>(null);

  // Console output
  const consoleOutput = ref('> 欢迎使用 Rebebuca\n> 请选择运行配置开始执行\n');

  // Computed properties
  const getConfigs = computed(() => configs.value);
  const getHistory = computed(() => history.value);
  const getCurrentRun = computed(() => currentRun.value);

  // Helper function to serialize dates for configs
  const serializeConfig = (config: RunConfig) => ({
    ...config,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  });

  // Helper function to deserialize dates for configs
  const deserializeConfig = (data: any): RunConfig => ({
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  });

  // Helper function to serialize dates for history
  const serializeHistory = (historyItem: RunHistory) => ({
    ...historyItem,
    timestamp: historyItem.timestamp instanceof Date
      ? historyItem.timestamp.toISOString()
      : historyItem.timestamp,
  });

  // Helper function to deserialize dates for history
  const deserializeHistory = (data: any): RunHistory => ({
    ...data,
    timestamp: new Date(data.timestamp),
  });

  // Load configs from persistent storage
  const loadConfigs = async () => {
    try {
      const storeInstance = await initStore();

      if (storeInstance) {
        // Use Tauri store
        const savedConfigs = await storeInstance.get('configs');

        if (savedConfigs && Array.isArray(savedConfigs)) {
          configs.value = savedConfigs.map(deserializeConfig);
        } else {
          // Set default configs if none exist
          configs.value = [
            {
              id: '1',
              name: '示例配置 - Echo',
              command: 'echo',
              arguments: ['Hello, Rebebuca!'],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: '2',
              name: '示例配置 - 列出文件',
              command: 'ls',
              arguments: ['-la'],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ];
        }
      } else {
        // Use localStorage fallback
        const savedConfigs = localStorage.getItem('rebebuca-configs');

        if (savedConfigs) {
          try {
            const parsedConfigs = JSON.parse(savedConfigs);
            configs.value = parsedConfigs.map(deserializeConfig);
          } catch (error) {
            console.error('Failed to parse saved configs:', error);
            // Set default configs on parse error
            configs.value = [
              {
                id: '1',
                name: '示例配置 - Echo',
                command: 'echo',
                arguments: ['Hello, Rebebuca!'],
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              {
                id: '2',
                name: '示例配置 - 列出文件',
                command: 'ls',
                arguments: ['-la'],
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ];
          }
        } else {
          // Set default configs if none exist
          configs.value = [
            {
              id: '1',
              name: '示例配置 - Echo',
              command: 'echo',
              arguments: ['Hello, Rebebuca!'],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: '2',
              name: '示例配置 - 列出文件',
              command: 'ls',
              arguments: ['-la'],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ];
        }
      }
    } catch (error) {
      console.error('Failed to load configs:', error);
      // Use default configs on error
      configs.value = [
        {
          id: '1',
          name: '示例配置 - Echo',
          command: 'echo',
          workingDirectory: undefined,
          environment: {},
          arguments: ['Hello from Rebebuca!'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: '示例配置 - 列出文件',
          command: 'ls',
          workingDirectory: undefined,
          environment: {},
          arguments: ['-la'],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];
    }
    initialized.value = true;
  };

  // Save configs to persistent storage
  const saveConfigs = async () => {
    try {
      const storeInstance = await initStore();

      if (storeInstance) {
        // Use Tauri store
        const serializedConfigs = configs.value.map(serializeConfig);
        await storeInstance.set('configs', serializedConfigs);
        await storeInstance.save();
      } else {
        // Use localStorage fallback
        localStorage.setItem('rebebuca-configs', JSON.stringify(configs.value.map(serializeConfig)));
      }
    } catch (error) {
      console.error('Failed to save configs:', error);
    }
  };

  // Load history from persistent storage
  const loadHistory = async () => {
    try {
      const storeInstance = await initStore();

      if (storeInstance) {
        // Use Tauri store
        const savedHistory = await storeInstance.get('history');

        if (savedHistory && Array.isArray(savedHistory)) {
          history.value = savedHistory.map(deserializeHistory);
        }
      } else {
        // Use localStorage fallback
        const savedHistory = localStorage.getItem('rebebuca-history');

        if (savedHistory) {
          try {
            const parsedHistory = JSON.parse(savedHistory);
            history.value = parsedHistory.map(deserializeHistory);
          } catch (error) {
            console.error('Failed to parse saved history:', error);
          }
        }
      }
      
      // Clear running status on app initialization
      // Because processes from previous session are no longer running
      await clearRunningStatus();
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  // Clear running status for all history items (called on app init)
  const clearRunningStatus = async () => {
    let hasChanges = false;
    for (let i = 0; i < history.value.length; i++) {
      if (history.value[i].status === 'running') {
        history.value[i] = {
          ...history.value[i],
          status: 'error', // Mark as error since the process was interrupted
        };
        hasChanges = true;
      }
    }
    if (hasChanges) {
      await saveHistory();
      console.log('[RunConfigStore] Cleared running status for interrupted processes');
    }
  };

  // Save history to persistent storage
  const saveHistory = async () => {
    try {
      const storeInstance = await initStore();

      if (storeInstance) {
        // Use Tauri store
        // 只保存最近 100 条历史记录
        const recentHistory = history.value.slice(0, 100);
        const serializedHistory = recentHistory.map(serializeHistory);
        await storeInstance.set('history', serializedHistory);
        await storeInstance.save();
      } else {
        // Use localStorage fallback
        const recentHistory = history.value.slice(0, 100);
        localStorage.setItem('rebebuca-history', JSON.stringify(recentHistory.map(serializeHistory)));
      }
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  };

  // Initialize store on first use
  if (!initialized.value) {
    loadConfigs();
    loadHistory();
  }

  // Methods
  const addConfig = async (config: Omit<RunConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newConfig: RunConfig = {
      ...config,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    configs.value.push(newConfig);
    await saveConfigs();
    return newConfig;
  };

  const updateConfig = async (id: string, updates: Partial<RunConfig>) => {
    const index = configs.value.findIndex(config => config.id === id);
    if (index !== -1) {
      configs.value[index] = {
        ...configs.value[index],
        ...updates,
        updatedAt: new Date(),
      };
      await saveConfigs();
    }
  };

  const deleteConfig = async (id: string) => {
    const index = configs.value.findIndex(config => config.id === id);
    if (index !== -1) {
      configs.value.splice(index, 1);
      await saveConfigs();
    }
  };

  const getConfig = (id: string) => {
    return configs.value.find(config => config.id === id);
  };

  // Import multiple configs at once
  const importConfigs = async (configsToImport: Omit<RunConfig, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    const now = new Date();
    const newConfigs: RunConfig[] = configsToImport.map((config, index) => ({
      ...config,
      id: (Date.now() + index).toString(),
      createdAt: now,
      updatedAt: now,
    }));
    configs.value.push(...newConfigs);
    await saveConfigs();
    return newConfigs;
  };

  const addHistory = async (historyItem: Omit<RunHistory, 'id'>) => {
    const newHistory: RunHistory = {
      ...historyItem,
      id: Date.now().toString(),
    };
    history.value.unshift(newHistory);
    await saveHistory();
    return newHistory;
  };

  const clearHistory = async () => {
    // Delete all log files before clearing history
    for (const item of history.value) {
      if (item.logFilename) {
        try {
          await safeInvoke('delete_log_file', { logFilename: item.logFilename });
        } catch (error) {
          console.error('Failed to delete log file:', error);
        }
      }
    }
    history.value = [];
    await saveHistory();
  };

  const removeHistory = async (index: number) => {
    if (index >= 0 && index < history.value.length) {
      const item = history.value[index];

      // Delete log file if exists
      if (item.logFilename) {
        try {
          await safeInvoke('delete_log_file', { logFilename: item.logFilename });
        } catch (error) {
          console.error('Failed to delete log file:', error);
        }
      }

      history.value.splice(index, 1);
      await saveHistory();
    }
  };

  const openLogsFolder = async () => {
    try {
      await safeInvoke('open_logs_folder');
    } catch (error) {
      console.error('Failed to open logs folder:', error);
      throw error;
    }
  };

  // Clean up old log files if exceeding maxLogFiles limit
  const cleanupOldLogs = async () => {
    try {
      const { useSettingsStore } = await import('./settings');
      const settingsStore = useSettingsStore();
      const maxLogFiles = settingsStore.settings.maxLogFiles || 100;
      
      // Get list of all log files
      const logFiles = await safeInvoke<Array<{ name: string; path: string; size: number; modified: string }>>('list_app_log_files');
      
      if (!logFiles || logFiles.length <= maxLogFiles) {
        return; // No cleanup needed
      }
      
      // Sort by modified date (oldest first) - format is "YYYY-MM-DD HH:MM:SS"
      const sortedFiles = [...logFiles].sort((a, b) => {
        return a.modified.localeCompare(b.modified);
      });
      
      // Calculate how many files to delete
      const filesToDelete = sortedFiles.length - maxLogFiles;
      const oldFiles = sortedFiles.slice(0, filesToDelete);
      
      console.log(`[RunConfig] Cleaning up ${filesToDelete} old log files (max: ${maxLogFiles}, current: ${sortedFiles.length})`);
      
      // Delete old files
      for (const file of oldFiles) {
        try {
          await safeInvoke('delete_log_file', { logFilename: file.name });
          console.log(`[RunConfig] Deleted old log file: ${file.name}`);
        } catch (error) {
          console.error(`[RunConfig] Failed to delete log file ${file.name}:`, error);
        }
      }
    } catch (error) {
      console.error('[RunConfig] Failed to cleanup old logs:', error);
    }
  };

  // Get process statistics
  const getProcessStats = async (systemPid: string) => {
    console.log(`[STORE] getProcessStats called with systemPid: ${systemPid}`);
    try {
      const stats = await safeInvoke('get_process_stats', { systemPid });
      console.log(`[STORE] getProcessStats success for ${systemPid}:`, stats);
      return stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[STORE] getProcessStats error for ${systemPid}: ${errorMessage}`);

      // Only return null for specific "finished" errors
      if (errorMessage.includes("Process not found - it has finished") ||
        errorMessage.includes("Process has finished")) {
        // Process has definitely finished
        console.log(`[STORE] Process ${systemPid} has finished, returning null`);
        return null;
      } else {
        // For other errors (including "not found"), re-throw to let caller handle
        console.log(`[STORE] Re-throwing error for process ${systemPid}: ${errorMessage}`);
        throw error;
      }
    }
  };

  // Read log file content for finished processes
  const readLogFile = async (logFilename: string) => {
    try {
      const content = await safeInvoke('read_log_file', { logFilename });
      return content as string;
    } catch (error) {
      console.error('Failed to read log file:', error);
      return '';
    }
  };

  const updateHistory = async (historyId: string, updates: Partial<RunHistory>) => {
    const index = history.value.findIndex(h => h.id === historyId);
    if (index !== -1) {
      history.value[index] = {
        ...history.value[index],
        ...updates,
      };
      await saveHistory();
    }
  };

  const appendConsoleOutput = (output: string) => {
    consoleOutput.value += output;
  };

  const clearConsole = () => {
    consoleOutput.value = '';
  };

  const setCurrentRun = (run: RunHistory | null) => {
    currentRun.value = run;
  };

  // Execute command using PTY terminal
  const executeCommand = async (config: RunConfig): Promise<{ processId: string; historyId: string; ptyId: string; }> => {
    // Create run record
    const startTime = Date.now();
    const runRecord: Omit<RunHistory, 'id'> = {
      configId: config.id,
      name: config.name,
      command: config.command,
      status: 'running',
      timestamp: new Date(),
      startTime: startTime
    };

    const newHistory = await addHistory(runRecord);
    setCurrentRun(newHistory);

    // Auto-select the newly created history item
    const { useUIStore } = await import('./ui');
    const uiStore = useUIStore();
    uiStore.setSelectedHistoryItem(newHistory);

    try {
      // Use terminal store to execute task
      const { useTerminalStore } = await import('./terminal');
      const terminalStore = useTerminalStore();
      
      // Ensure listeners are initialized
      await terminalStore.initListeners();
      
      // Generate log path if saveLogs is enabled
      let logPath: string | undefined;
      let logFilename: string | undefined;
      const { useSettingsStore } = await import('./settings');
      const settingsStore = useSettingsStore();
      
      if (settingsStore.settings.saveLogs) {
        try {
          const logInfo = await safeInvoke<{ log_filename: string; log_path: string }>('generate_log_path');
          if (logInfo) {
            logPath = logInfo.log_path;
            logFilename = logInfo.log_filename;
            console.log('[FRONTEND] Generated log path:', logPath);
          }
          
          // Cleanup old log files in the background (don't await)
          cleanupOldLogs().catch(err => console.warn('[FRONTEND] Log cleanup failed:', err));
        } catch (error) {
          console.error('[FRONTEND] Failed to generate log path:', error);
        }
      }
      
      // Execute task in terminal
      const tab = await terminalStore.executeTask({
        command: config.command,
        args: config.arguments,
        cwd: config.workingDirectory,
        env: config.environment,
        taskId: config.id,
        historyId: newHistory.id,
        label: config.name,
        logPath,
      });

      console.log(`[FRONTEND] executeCommand via PTY - ptyId: ${tab.ptyId}, historyId: ${newHistory.id}`);

      // Update history with PTY ID, terminal tab ID, and log filename
      const index = history.value.findIndex(h => h.id === newHistory.id);
      if (index !== -1) {
        history.value[index] = {
          ...history.value[index],
          ptyId: tab.ptyId,
          terminalTabId: tab.id,
          logFilename,
        };
        await saveHistory();
      }

      return { 
        processId: tab.ptyId, 
        historyId: newHistory.id,
        ptyId: tab.ptyId,
      };
    } catch (error) {
      const errorMessage = `执行错误: ${error instanceof Error ? error.message : String(error)}\n`;
      appendConsoleOutput(errorMessage);

      // Update run record to error status
      const index = history.value.findIndex(h => h.id === newHistory.id);
      if (index !== -1) {
        history.value[index] = {
          ...history.value[index],
          status: 'error',
          output: errorMessage
        };
        await saveHistory();
      }

      setCurrentRun(null);
      throw error;
    }
  };

  // Stop current run (now supports both PTY and legacy process)
  const stopCurrentRun = async (processId: string) => {
    console.log(`[STORE] stopCurrentRun called with processId: ${processId}`);
    
    // Find the history item
    const historyItem = history.value.find(h => h.pid === processId || h.ptyId === processId);
    
    if (historyItem?.ptyId) {
      // PTY-based task - close the PTY
      try {
        console.log(`[STORE] Closing PTY: ${historyItem.ptyId}`);
        await safeInvoke('close_pty', { ptyId: historyItem.ptyId });
        
        // Also close the terminal tab
        if (historyItem.terminalTabId) {
          const { useTerminalStore } = await import('./terminal');
          const terminalStore = useTerminalStore();
          await terminalStore.closeTab(historyItem.terminalTabId);
        }
        
        console.log(`[STORE] Successfully closed PTY ${historyItem.ptyId}`);
        appendConsoleOutput('\n> 进程已停止\n');
        
        // Calculate final duration
        let updateData: Partial<RunHistory> = {
          status: 'success'
        };
        
        if (historyItem.startTime) {
          const duration = Date.now() - historyItem.startTime;
          updateData.duration = duration;
        }
        
        await updateHistory(historyItem.id, updateData);
      } catch (error) {
        const errorMessage = `停止进程失败: ${error instanceof Error ? error.message : String(error)}\n`;
        console.error(`[STORE] Failed to close PTY:`, error);
        appendConsoleOutput(errorMessage);
        throw error;
      }
    } else {
      // Legacy process-based execution
      try {
        console.log(`[STORE] Attempting to kill process with PID: ${processId}`);
        await safeInvoke('kill_process', { systemPid: processId });
        console.log(`[STORE] Successfully killed process ${processId}`);
        appendConsoleOutput('\n> 进程已停止\n');

        if (historyItem) {
          let updateData: Partial<RunHistory> = {
            status: 'success'
          };

          if (historyItem.startTime) {
            const duration = Date.now() - historyItem.startTime;
            updateData.duration = duration;
          }

          await updateHistory(historyItem.id, updateData);
        }
      } catch (error) {
        const errorMessage = `停止进程失败: ${error instanceof Error ? error.message : String(error)}\n`;
        console.error(`[STORE] Failed to stop process ${processId}:`, error);
        appendConsoleOutput(errorMessage);
        throw error;
      }
    }
  };

  // Restart process - now uses PTY execution
  const restartProcess = async (processId: string): Promise<{ processId: string; historyId: string; ptyId: string; }> => {
    console.log(`[STORE] restartProcess called with processId: ${processId}`);

    // Find the history item for the process to restart
    const historyItem = history.value.find(h => h.pid === processId || h.ptyId === processId);
    if (!historyItem) {
      throw new Error(`No history item found for process: ${processId}`);
    }

    // Find the config for this process
    const config = getConfig(historyItem.configId);
    if (!config) {
      throw new Error(`No config found for process: ${historyItem.configId}`);
    }

    // First stop the current process if running
    if (historyItem.status === 'running') {
      try {
        await stopCurrentRun(processId);
      } catch (error) {
        console.warn('[STORE] Failed to stop existing process:', error);
      }
    }

    // Execute the command again
    console.log(`[STORE] Restarting process with config:`, config.name);
    return await executeCommand(config);
  };



  return {
    // State
    configs,
    history,
    currentRun,
    consoleOutput,
    initialized,

    // Computed properties
    getConfigs,
    getHistory,
    getCurrentRun,

    // Methods
    addConfig,
    updateConfig,
    deleteConfig,
    getConfig,
    importConfigs,
    addHistory,
    clearHistory,
    removeHistory,
    updateHistory,
    appendConsoleOutput,
    clearConsole,
    setCurrentRun,
    executeCommand,
    stopCurrentRun,
    restartProcess,
    loadConfigs,
    saveConfigs,
    loadHistory,
    saveHistory,
    openLogsFolder,
    cleanupOldLogs,
    getProcessStats,
    readLogFile,
  };
});