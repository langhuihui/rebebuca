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
const safeInvoke = async (command: string, args?: any) => {
  if (!isTauri()) {
    // Silent fallback in browser environment
    throw new Error(`Command '${command}' not available in browser environment`);
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke(command, args);
  } catch (error) {
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
        const savedConfigs = await storeInstance.get<any[]>('configs');

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
        const savedHistory = await storeInstance.get<any[]>('history');

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
    } catch (error) {
      console.error('Failed to load history:', error);
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

  // Execute command using Tauri
  const executeCommand = async (config: RunConfig): Promise<{ processId: string; historyId: string; }> => {
    // Create run record
    const runRecord: Omit<RunHistory, 'id'> = {
      configId: config.id,
      name: config.name,
      command: config.command,
      status: 'running',
      timestamp: new Date()
    };

    const newHistory = await addHistory(runRecord);
    setCurrentRun(newHistory);

    // Convert RunConfig to TauriRunConfig format
    const tauriConfig: TauriRunConfig = {
      name: config.name,
      command: config.command,
      working_directory: config.workingDirectory,
      environment: config.environment,
      arguments: config.arguments
    };

    try {
      // Call Tauri command to execute the process
      const result = await safeInvoke<string>('execute_command', {
        config: tauriConfig
      });

      // Parse the result to get process_id and log_filename
      const { process_id, log_filename } = JSON.parse(result);

      // Update history with log filename
      const index = history.value.findIndex(h => h.id === newHistory.id);
      if (index !== -1) {
        history.value[index] = {
          ...history.value[index],
          logFilename: log_filename
        };
        await saveHistory();
      }

      // Return both process ID and history ID
      return { processId: process_id, historyId: newHistory.id };
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

  // Stop current run
  const stopCurrentRun = async (processId: string) => {
    try {
      await safeInvoke('kill_process', { processId });
      appendConsoleOutput('\n> 进程已停止\n');
    } catch (error) {
      const errorMessage = `停止进程失败: ${error instanceof Error ? error.message : String(error)}\n`;
      appendConsoleOutput(errorMessage);
      throw error;
    }
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
    addHistory,
    clearHistory,
    removeHistory,
    updateHistory,
    appendConsoleOutput,
    clearConsole,
    setCurrentRun,
    executeCommand,
    stopCurrentRun,
    loadConfigs,
    saveConfigs,
    loadHistory,
    saveHistory,
    openLogsFolder,
  };
});