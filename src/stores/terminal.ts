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
import { ref, computed, shallowRef } from 'vue';

/** Terminal workspace split: single pane, 1×2, or 2×2 grid */
export type SplitLayoutKind = 'single' | 'dual' | 'quad';
import { getAdapter, type BackendAdapter, type TerminalExitEvent } from '../adapters';
import { defaultShellForPlatform } from '../utils/defaultShell';

export type TerminalStatus = 'pending' | 'running' | 'success' | 'error' | 'closed';
export type TerminalType = 'task' | 'shell' | 'settings' | 'notifications' | 'port-management' | 'room-info' | 'ffmpeg-encoder' | 'mcp-task' | 'agent-task';

/**
 * 终端截图结果
 */
export interface TerminalScreenshotResult {
  /** Base64 编码的 PNG 图片 (data URL 格式) */
  screenshot: string | null;
  /** 终端文本内容 */
  textContent: string | null;
  /** 终端 Tab ID */
  tabId: string;
  /** PTY ID */
  ptyId: string;
  /** 终端尺寸 (列数) */
  cols?: number;
  /** 终端尺寸 (行数) */
  rows?: number;
}

export interface TaskExecutionParams {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  logPath?: string;
  shellPath?: string | null;
  /**
   * Optional input to write after detecting a specific pattern in PTY output.
   * Used for auto-entering SSH passwords after the password prompt appears.
   * NOTE: should be cleared after use (may contain sensitive data).
   */
  autoInput?: {
    /** Pattern to match in PTY output (case-insensitive) */
    pattern: string;
    /** Input to write when pattern is detected */
    input: string;
    /** Timeout in ms (default: 30000) */
    timeout?: number;
  };
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
  sshConfigId?: string; // SSH 配置 ID（用于 SSH 任务）
  sshExecId?: string;   // SSH 执行 ID（用于 SSH 任务）
  roomInfo?: any;       // 对于 room-info 类型，存储房间信息数据
  isFFmpegTask?: boolean; // 是否为 FFmpeg 任务
  ffmpegTaskId?: string; // FFmpeg 任务 ID（用于进度追踪）
  ffmpegFileName?: string; // FFmpeg 任务文件名（用于进度显示）
  isAgentTask?: boolean; // 是否为 Agent 任务
  agentOutput?: string; // Agent 任务的 JSON 输出（用于可视化）
  agentResult?: any; // Agent 任务的最后结果（从 JSON 中提取）
  /** Server PTY scrollback replay after page refresh */
  restoredScrollback?: string;
}

export const useTerminalStore = defineStore('terminal', () => {
  // Terminal tabs
  const tabs = ref<TerminalTab[]>([]);

  // Currently active tab ID
  const activeTabId = ref<string | null>(null);

  // Split screen state
  const splitLayout = ref<SplitLayoutKind>('single');
  const isSplitMode = computed(() => splitLayout.value !== 'single');
  const splitTabs = ref<(string | null)[]>([null, null, null, null]);

  // Event listeners cleanup function
  let unlistenExit: (() => void) | null = null;
  let unlistenData: (() => void) | null = null;

  /** Serialize initListeners — App + ConsoleArea + stores can mount in parallel. */
  let listenersInitPromise: Promise<void> | null = null;

  // FFmpeg 进度处理
  const ffmpegProgressCache = new Map<string, string[]>(); // ptyId -> 输出行缓存

  // Adapter instance (cached)
  let adapter: BackendAdapter | null = null;

  // Pending auto-input handlers (ptyId -> config)
  // Used to auto-enter passwords after detecting prompts in PTY output
  const pendingAutoInputs = new Map<string, {
    pattern: RegExp;
    input: string;
    timeoutId: ReturnType<typeof setTimeout>;
  }>();

  // Terminal screenshot handler (will be set by ConsoleArea)
  // 使用 shallowRef 来存储函数引用，避免深度响应式
  const screenshotHandler = shallowRef<((tabId: string) => Promise<TerminalScreenshotResult | null>) | null>(null);

  // 注册截图处理器（由 ConsoleArea 调用）
  const registerScreenshotHandler = (handler: (tabId: string) => Promise<TerminalScreenshotResult | null>) => {
    screenshotHandler.value = handler;
  };

  // 注销截图处理器
  const unregisterScreenshotHandler = () => {
    screenshotHandler.value = null;
  };

  // 获取终端截图（供外部调用，如 MCP Server）
  const takeTerminalScreenshot = async (tabIdOrPtyId: string): Promise<TerminalScreenshotResult | null> => {
    // 首先尝试按 tabId 查找
    let tab = tabs.value.find(t => t.id === tabIdOrPtyId);

    // 如果没找到，尝试按 ptyId 查找
    if (!tab) {
      tab = tabs.value.find(t => t.ptyId === tabIdOrPtyId);
    }

    if (!tab) {
      console.warn('[Terminal Store] Cannot take screenshot: tab not found:', tabIdOrPtyId);
      return null;
    }

    if (tab.type !== 'task' && tab.type !== 'shell') {
      console.warn('[Terminal Store] Cannot take screenshot: not a terminal tab:', tab.type);
      return null;
    }

    if (!screenshotHandler.value) {
      console.warn('[Terminal Store] Cannot take screenshot: no handler registered');
      return null;
    }

    return await screenshotHandler.value(tab.id);
  };

  // 获取所有可用于截图的终端列表
  const getScreenshotableTerminals = (): Array<{ tabId: string; ptyId: string; label: string; status: TerminalStatus; }> => {
    return tabs.value
      .filter(t => t.type === 'task' || t.type === 'shell')
      .map(t => ({
        tabId: t.id,
        ptyId: t.ptyId,
        label: t.label,
        status: t.status,
      }));
  };

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

  const tryRestorePtySessions = async (adapterInstance: BackendAdapter) => {
    try {
      const listFn = adapterInstance.terminal.listPtySessions;
      const scrollFn = adapterInstance.terminal.getPtyScrollback;
      if (typeof listFn !== 'function' || typeof scrollFn !== 'function') {
        return;
      }

      const sessions = await listFn.call(adapterInstance.terminal);
      if (!sessions?.length) return;

      const { useTaskManagerStore } = await import('./taskManager');
      const taskManager = useTaskManagerStore();

      let restoredCount = 0;
      let lastRestoredTabId: string | null = null;
      for (const s of sessions) {
        if (!s.running) continue;
        if (tabs.value.some(t => t.ptyId === s.ptyId)) continue;

        const meta = s.meta || {};
        const scrollback = await scrollFn.call(adapterInstance.terminal, s.ptyId);
        const id = generateId();
        const tabType = meta.tabType === 'shell' ? 'shell' : 'task';

        const tab: TerminalTab = {
          id,
          type: tabType,
          label: meta.label || s.ptyId,
          ptyId: s.ptyId,
          taskId: meta.taskId,
          historyId: meta.historyId,
          status: 'running',
          startTime: Date.now(),
          command: meta.commandDisplay,
          pid: s.pid,
          restoredScrollback: scrollback || undefined,
        };

        tabs.value.push(tab);
        restoredCount += 1;
        lastRestoredTabId = id;

        if (tab.taskId) {
          taskManager.onTaskStart(tab.taskId, tab.id);
        }
      }

      if (restoredCount > 0) {
        console.log('[Terminal Store] Restored PTY session(s) after reconnect:', restoredCount);
        if (lastRestoredTabId && !activeTabId.value) {
          setActiveTab(lastRestoredTabId);
        }
      }
    } catch (e) {
      console.warn('[Terminal Store] PTY session restore skipped:', e);
    }
  };

  /**
   * Single path for PTY exit → tab UI + side effects.
   * Used by adapter onExit and by TerminalView @exit (fallback when adapter event is missed).
   */
  const applyPtyExitToTab = async (tab: TerminalTab, exitCode: number | null) => {
    if (tab.type !== 'task' && tab.type !== 'shell') return;
    if (tab.status === 'success' || tab.status === 'error' || tab.status === 'closed') return;

    const success = exitCode === 0 || exitCode === null;
    tab.exitCode = exitCode ?? undefined;
    tab.status = success ? 'success' : 'error';

    if (tab.isFFmpegTask && tab.ffmpegTaskId) {
      try {
        const { useFFmpegProgressStore } = await import('../ffmpeg/stores/progressStore');
        const ffmpegStore = useFFmpegProgressStore();
        ffmpegStore.finishTask(tab.ffmpegTaskId, exitCode ?? undefined);
        console.log('[Terminal Store] FFmpeg progress tracking finished:', tab.ffmpegTaskId);
      } catch (error) {
        console.warn('[Terminal Store] Failed to finish FFmpeg progress:', error);
      }
    }

    try {
      const { useTaskManagerStore } = await import('./taskManager');
      const taskManager = useTaskManagerStore();
      taskManager.onTaskExit(tab.id);
    } catch (error) {
      console.error('[Terminal Store] Failed to notify taskManager:', error);
    }

    if (tab.historyId) {
      try {
        const { useRunConfigStore } = await import('./runConfig');
        const runConfigStore = useRunConfigStore();
        const historyItem = runConfigStore.history.find(h => h.id === tab.historyId);

        if (historyItem) {
          const duration = historyItem.startTime ? Date.now() - historyItem.startTime : undefined;
          await runConfigStore.updateHistory(tab.historyId, {
            status: success ? 'success' : 'error',
            duration,
          });
          console.log('[Terminal Store] Updated history record:', tab.historyId);
        }
      } catch (error) {
        console.error('[Terminal Store] Failed to update history:', error);
      }
    }
  };

  /** Called from TerminalView @exit — keeps tab status in sync if store adapter exit was not delivered. */
  const applyPtyExitForTabId = (tabId: string, exitCode: number | null) => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (tab) {
      void applyPtyExitToTab(tab, exitCode);
    }
  };

  // Initialize event listeners
  const initListeners = async () => {
    if (unlistenExit) return; // Already initialized

    if (listenersInitPromise) {
      try {
        await listenersInitPromise;
      } catch {
        // Primary initListeners caller already logged / cleaned up
      }
      return;
    }

    listenersInitPromise = (async () => {
      const adapterInstance = await getAdapterInstance();

      // Listen for PTY data events to handle auto-input (e.g., SSH password prompts)
      unlistenData = adapterInstance.terminal.onData(async (event) => {
        const { ptyId, data } = event;

        // 处理 FFmpeg 进度解析
        const tab = tabs.value.find(t => t.ptyId === ptyId);
        if (tab && tab.isFFmpegTask && tab.ffmpegTaskId) {
          try {
            // 缓存输出行
            if (!ffmpegProgressCache.has(ptyId)) {
              ffmpegProgressCache.set(ptyId, []);
            }
            const cache = ffmpegProgressCache.get(ptyId)!;
            cache.push(data);

            // 逐行解析
            const lines = data.split('\n');
            for (const line of lines) {
              if (line.trim()) {
                const { useFFmpegProgressStore } = await import('../ffmpeg/stores/progressStore');
                const ffmpegStore = useFFmpegProgressStore();
                ffmpegStore.updateTask(tab.ffmpegTaskId, line);
              }
            }

            // 如果检测到 muxing，更新状态
            if (data.toLowerCase().includes('muxing')) {
              const { useFFmpegProgressStore } = await import('../ffmpeg/stores/progressStore');
              const ffmpegStore = useFFmpegProgressStore();
              ffmpegStore.setMuxing(tab.ffmpegTaskId);
            }
          } catch (error) {
            console.warn('[Terminal Store] FFmpeg progress parse error:', error);
          }
        }

        // Check if there's a pending auto-input for this PTY
        const pending = pendingAutoInputs.get(ptyId);
        if (pending && pending.pattern.test(data)) {
          console.log('[Terminal Store] Auto-input pattern matched for:', ptyId);

          // Clear the pending entry
          clearTimeout(pending.timeoutId);
          pendingAutoInputs.delete(ptyId);

          // Write the input
          try {
            await adapterInstance.terminal.write(ptyId, pending.input);
          } catch (error) {
            console.error('[Terminal Store] Failed to write auto-input:', error);
          }
        }
      });

      // Listen for PTY exit events via adapter
      unlistenExit = adapterInstance.terminal.onExit(async (event: TerminalExitEvent) => {
        const { ptyId, exitCode } = event;
        console.log('[Terminal Store] PTY exit event:', ptyId, exitCode);

        const tab = tabs.value.find(t => t.ptyId === ptyId);
        if (tab) {
          await applyPtyExitToTab(tab, exitCode);
        }
      });

      await tryRestorePtySessions(adapterInstance);
    })();

    try {
      await listenersInitPromise;
    } catch (error) {
      console.error('[Terminal Store] Failed to init listeners:', error);
      cleanupListeners();
    } finally {
      listenersInitPromise = null;
    }
  };

  // Cleanup listeners
  const cleanupListeners = () => {
    listenersInitPromise = null;
    if (unlistenData) {
      unlistenData();
      unlistenData = null;
    }
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
      status: 'pending', // wait until TerminalView is ready, then startShell()
      startTime: Date.now(),
      execParams: {
        command: 'default',
        cwd: options?.cwd,
        env: options?.env,
      },
    };

    tabs.value.push(tab);
    setActiveTab(id);

    return tab;
  };

  // Start a pending shell - call this after terminal is ready (only for shell tabs)
  const startShell = async (tabId: string): Promise<void> => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (!tab || tab.type !== 'shell' || tab.status !== 'pending') {
      console.warn('[Terminal Store] Cannot start shell - invalid state:', tabId, tab?.status);
      return;
    }

    try {
      tab.status = 'running';

      const adapterInstance = await getAdapterInstance();
        const { useSettingsStore } = await import('./settings');
        const settingsStore = useSettingsStore();
        const platform = await adapterInstance.system.getPlatform();
        const shell = settingsStore.settings.preferredShell || defaultShellForPlatform(platform);

        // Use command "default" so node-server spawns an interactive shell (no -lc one-shot).
        // Passing the shell path as command made the backend wrap it with -lc and exit immediately.
        const result = await adapterInstance.terminal.create({
          ptyId: tab.ptyId,
          command: 'default',
          args: [],
          shellPath: shell,
          cwd: tab.execParams?.cwd,
          env: tab.execParams?.env ?? {},
          rows: 24,
          cols: 80,
          meta: {
            label: tab.label,
            tabType: 'shell',
          },
        });

        // If backend generated a different ptyId, update the tab so listeners match
        if (result?.ptyId && result.ptyId !== tab.ptyId) {
          tab.ptyId = result.ptyId;
        }

        if (result?.pid) {
          tab.pid = result.pid;
        }

      console.log('[Terminal Store] Shell started:', tab.ptyId);
    } catch (error) {
      console.error('[Terminal Store] Failed to start shell:', error);
      tab.status = 'error';
      throw error;
    }
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
    /** Auto-input config: write input after detecting pattern in PTY output */
    autoInput?: {
      pattern: string;
      input: string;
      timeout?: number;
    };
    /** 是否为 FFmpeg 任务 */
    isFFmpegTask?: boolean;
    /** FFmpeg 任务文件名（用于进度显示） */
    ffmpegFileName?: string;
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
        autoInput: options.autoInput,
      },
      shellName: getShellName(options.shellPath),
      isFFmpegTask: options.isFFmpegTask || false,
      ffmpegFileName: options.ffmpegFileName || '',
    };

    tabs.value.push(tab);
    setActiveTab(id);

    console.log('[Terminal Store] Task tab created (pending):', ptyId, {
      label: options.label,
      command: options.command,
      args: options.args,
      cwd: options.cwd,
      shellPath: options.shellPath ?? null,
      envKeys: options.env ? Object.keys(options.env).sort() : [],
      taskId: options.taskId,
    });
    return tab;
  };

  // Execute an SSH task in a new terminal tab
  const executeSshTask = async (options: {
    sshConfigId: string;
    sshConfigName: string;
    sshExecId: string;
    command: string;
    taskId?: string;
    historyId?: string;
    label: string;
  }): Promise<TerminalTab> => {
    const id = generateId();
    // Use sshExecId as ptyId so TerminalView can receive pty-output events
    const ptyId = options.sshExecId;

    const tab: TerminalTab = {
      id,
      type: 'task',
      label: `[SSH] ${options.label}`,
      ptyId,
      taskId: options.taskId,
      historyId: options.historyId,
      status: 'running',
      startTime: Date.now(),
      command: options.command,
      shellName: `SSH: ${options.sshConfigName}`,
      sshConfigId: options.sshConfigId,
      sshExecId: options.sshExecId,
    };

    tabs.value.push(tab);
    setActiveTab(id);

    console.log('[Terminal Store] SSH task tab created:', ptyId, 'execId:', options.sshExecId);
    return tab;
  };

  // Start a pending task - call this after terminal is ready (only for task tabs)
  const startTask = async (tabId: string): Promise<void> => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (!tab || tab.type !== 'task' || tab.status !== 'pending' || !tab.execParams) {
      console.warn('[Terminal Store] Cannot start task — skipping PTY spawn:', {
        tabId,
        found: !!tab,
        type: tab?.type,
        status: tab?.status,
        hasExecParams: !!tab?.execParams,
        hint: 'Usually means TerminalView did not fire @ready while tab was still pending, or status changed early.',
      });
      return;
    }

    const { command, args, cwd, env, logPath, shellPath } = tab.execParams;

    console.log('[Terminal Store] startTask → adapter.terminal.create', {
      tabId,
      ptyId: tab.ptyId,
      label: tab.label,
      command,
      args,
      cwd,
      shellPath: shellPath ?? null,
      envKeys: env ? Object.keys(env).sort() : [],
    });

    try {
      tab.status = 'running';

      const adapterInstance = await getAdapterInstance();
      const result = await adapterInstance.terminal.create({
        ptyId: tab.ptyId,
        command,
        args,
        cwd,
        env,
        logPath,
        shellPath,
        meta: {
          label: tab.label,
          taskId: tab.taskId,
          tabType: 'task',
          historyId: tab.historyId,
          commandDisplay: tab.command,
        },
      });

      // Update tab with actual ptyId from adapter
      tab.ptyId = result.ptyId;
      if (result.pid) {
        tab.pid = result.pid;
      }

      // Register auto-input handler if configured (e.g., for SSH password)
      if (tab.execParams?.autoInput) {
        const { pattern, input, timeout = 30000 } = tab.execParams.autoInput;

        // Create case-insensitive regex
        const regex = new RegExp(pattern, 'i');

        // Set up timeout to clean up if pattern is never matched
        const timeoutId = setTimeout(() => {
          console.log('[Terminal Store] Auto-input timeout for:', tab.ptyId);
          pendingAutoInputs.delete(tab.ptyId);
        }, timeout);

        pendingAutoInputs.set(tab.ptyId, {
          pattern: regex,
          input,
          timeoutId,
        });

        console.log('[Terminal Store] Registered auto-input for:', tab.ptyId, 'pattern:', pattern);

        // Clear sensitive data from execParams
        tab.execParams.autoInput = undefined;
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

      // 初始化 FFmpeg 进度追踪
      if (tab.isFFmpegTask && tab.ffmpegFileName) {
        try {
          const ffmpegTaskId = `ffmpeg-${tab.id}-${Date.now()}`;
          tab.ffmpegTaskId = ffmpegTaskId;

          const { useFFmpegProgressStore } = await import('../ffmpeg/stores/progressStore');
          const ffmpegStore = useFFmpegProgressStore();
          ffmpegStore.createTask(ffmpegTaskId, tab.id, tab.ffmpegFileName);

          console.log('[Terminal Store] FFmpeg progress tracking started:', ffmpegTaskId);
        } catch (error) {
          console.warn('[Terminal Store] Failed to initialize FFmpeg progress:', error);
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

    // Kill OS process tree for any tab that was started (not pending): stopping only the PTY
    // shell leaves pnpm/node children on Windows.
    if (
      tab.status !== 'pending' &&
      (tab.type === 'task' || tab.type === 'shell')
    ) {
      try {
        const adapterInstance = await getAdapterInstance();
        if (tab.sshExecId && adapterInstance.ssh) {
          await adapterInstance.ssh.killExecution(tab.sshExecId);
        } else {
          await adapterInstance.terminal.kill(tab.ptyId);
        }
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

    // Remove tab
    const index = tabs.value.findIndex(t => t.id === tabId);
    if (index !== -1) {
      tabs.value.splice(index, 1);
    }

    // Split mode handling: remove from splitTabs
    const splitIndex = splitTabs.value.indexOf(tabId);
    if (splitIndex !== -1) {
      const newSplits = [...splitTabs.value];
      newSplits[splitIndex] = null;
      splitTabs.value = newSplits;
    }

    // Update active tab if needed
    if (activeTabId.value === tabId) {
      // If in split mode, we might not want to jump to another tab automatically if other splits are active?
      // But standard behavior: fall back to last tab.
      // If split mode is active, maybe we just de-select?
      // Let's keep existing logic but just update the pointer.
      activeTabId.value = tabs.value.length > 0 ? tabs.value[tabs.value.length - 1].id : null;
    }
  };

  // Stop a running task (only for task/shell tabs)
  const stopTask = async (tabId: string) => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (!tab || (tab.type !== 'task' && tab.type !== 'shell') || tab.status !== 'running') return;

    // SSH remote exec: stop stream on the server
    if (tab.sshConfigId && tab.sshExecId) {
      console.log('[Terminal Store] Stopping SSH exec:', tab.sshExecId);
      try {
        const adapterInstance = await getAdapterInstance();
        if (adapterInstance.ssh) {
          await adapterInstance.ssh.killExecution(tab.sshExecId);
        }
      } catch (e) {
        console.warn('[Terminal Store] SSH killExecution failed:', e);
      }
      tab.status = 'success';
      return;
    }

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

    // Notify taskManager that the old task has exited (will be re-registered in startTask)
    if (tab.taskId) {
      try {
        const { useTaskManagerStore } = await import('./taskManager');
        const taskManager = useTaskManagerStore();
        taskManager.onTaskExit(tab.id);
      } catch (error) {
        console.warn('[Terminal Store] Failed to notify taskManager of task exit:', error);
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

    // 清理旧的 FFmpeg 进度追踪
    if (tab.isFFmpegTask && tab.ffmpegTaskId) {
      try {
        const { useFFmpegProgressStore } = await import('../ffmpeg/stores/progressStore');
        const ffmpegStore = useFFmpegProgressStore();
        ffmpegStore.removeTask(tab.ffmpegTaskId);
      } catch (error) {
        console.warn('[Terminal Store] Failed to remove FFmpeg progress:', error);
      }
    }

    // Set as active tab
    activeTabId.value = tab.id;

    console.log('[Terminal Store] Task tab restarted (pending):', newPtyId, 'tabId:', tab.id);

    // Actually start the task
    await startTask(tabId);

    return tab;
  };

  // Set active tab
  const setActiveTab = (tabId: string | null) => {
    if (!tabId) {
      activeTabId.value = null;
      return;
    }

    if (isSplitMode.value) {
      const maxSlots = splitLayout.value === 'dual' ? 2 : 4;

      // Check if target tab is already visible in a split
      const existingSplitIndex = splitTabs.value.indexOf(tabId);

      if (existingSplitIndex !== -1 && existingSplitIndex < maxSlots) {
        // Case 1: Tab is already visible in a split
        // Just focus it (set as active)
        activeTabId.value = tabId;
      } else {
        // Case 2: Tab is not currently visible in any split
        // We need to show it in a split pane.
        // Priority 1: Fill an empty split if available.
        // Priority 2: Replace the currently active split.

        let targetSplitIndex = -1;

        // Priority 1: Check for empty slots (only within current layout)
        let emptySlotIndex = -1;
        for (let i = 0; i < maxSlots; i++) {
          if (splitTabs.value[i] === null) {
            emptySlotIndex = i;
            break;
          }
        }
        if (emptySlotIndex !== -1) {
          targetSplitIndex = emptySlotIndex;
        } else {
          // Priority 2: Replace active tab's slot (within layout slots only)
          const currentActiveTabId = activeTabId.value;
          if (currentActiveTabId) {
            const idx = splitTabs.value.indexOf(currentActiveTabId);
            if (idx !== -1 && idx < maxSlots) {
              targetSplitIndex = idx;
            }
          }

          if (targetSplitIndex === -1 || targetSplitIndex >= maxSlots) {
            targetSplitIndex = 0;
          }
        }

        // Place tab in target pane; remove duplicates from other slots first
        const newSplits = splitTabs.value.map((id) => (id === tabId ? null : id));
        newSplits[targetSplitIndex] = tabId;
        splitTabs.value = newSplits;

        // Set new tab as active
        activeTabId.value = tabId;
      }
    } else {
      // Normal mode
      activeTabId.value = tabId;
    }
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
  const updateTabStats = (tabId: string, stats: { cpuUsage?: string; memoryUsage?: string; pid?: number; }) => {
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
    if (!tab || (tab.type !== 'task' && tab.type !== 'shell') || tab.status !== 'running') {
      return null;
    }

    try {
      const adapterInstance = await getAdapterInstance();
      const stats = await adapterInstance.terminal.getProcessStats(tab.ptyId);

      if (!stats) return null;

      const cpuUsage = `${stats.cpuUsage.toFixed(1)}%`;
      const memoryUsage = stats.memoryUsageMb;

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
    setActiveTab(id);
    return tab;
  };

  // Create a notifications tab
  const createNotificationsTab = (): TerminalTab => {
    // Check if notifications tab already exists
    const existingTab = tabs.value.find(t => t.type === 'notifications');
    if (existingTab) {
      setActiveTab(existingTab.id);
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
    setActiveTab(id);
    return tab;
  };

  // Create a port management tab
  const createPortManagementTab = (): TerminalTab => {
    // Check if port management tab already exists
    const existingTab = tabs.value.find(t => t.type === 'port-management');
    if (existingTab) {
      setActiveTab(existingTab.id);
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
    setActiveTab(id);
    return tab;
  };

  // Create an FFmpeg encoder tab
  const createFFmpegEncoderTab = (): TerminalTab => {
    // Check if FFmpeg encoder tab already exists
    const existingTab = tabs.value.find(t => t.type === 'ffmpeg-encoder');
    if (existingTab) {
      setActiveTab(existingTab.id);
      return existingTab;
    }

    const id = generateId();
    const tab: TerminalTab = {
      id,
      type: 'ffmpeg-encoder',
      label: 'FFmpeg 编码器',
      ptyId: '', // No PTY for FFmpeg encoder tab
      status: 'running',
      startTime: Date.now(),
    };

    tabs.value.push(tab);
    setActiveTab(id);
    return tab;
  };

  // Create a room info tab
  const createRoomInfoTab = (roomInfo: any): TerminalTab => {
    // Check if room info tab already exists for this room
    const existingTab = tabs.value.find(t => t.type === 'room-info' && t.roomInfo?.RoomId === roomInfo.RoomId);
    if (existingTab) {
      existingTab.roomInfo = roomInfo; // Update info
      setActiveTab(existingTab.id);
      return existingTab;
    }

    const id = generateId();
    const tab: TerminalTab = {
      id,
      type: 'room-info',
      label: roomInfo.Name || 'Room Info',
      ptyId: '', // No PTY for room info tab
      status: 'running',
      startTime: Date.now(),
      roomInfo,
    };

    tabs.value.push(tab);
    setActiveTab(id);
    return tab;
  };

  const initSplitSlots = (paneCount: 2 | 4) => {
    const validTabs = tabs.value.filter(t => t.type === 'task' || t.type === 'shell');
    const newSplits: (string | null)[] = [null, null, null, null];
    let availableTabs = [...validTabs];

    if (activeTabId.value) {
      const activeIdx = availableTabs.findIndex(t => t.id === activeTabId.value);
      if (activeIdx !== -1) {
        newSplits[0] = activeTabId.value;
        availableTabs.splice(activeIdx, 1);
      }
    }

    for (let i = 0; i < paneCount; i++) {
      if (newSplits[i] === null && availableTabs.length > 0) {
        newSplits[i] = availableTabs.shift()!.id;
      }
    }

    splitTabs.value = newSplits;
  };

  const setSplitLayout = (kind: SplitLayoutKind) => {
    if (kind === 'single') {
      splitLayout.value = 'single';
      splitTabs.value = [null, null, null, null];
      return;
    }

    if (kind === 'dual') {
      if (splitLayout.value === 'single') {
        splitLayout.value = 'dual';
        initSplitSlots(2);
      } else if (splitLayout.value === 'quad') {
        splitLayout.value = 'dual';
        const ns = [...splitTabs.value];
        ns[2] = null;
        ns[3] = null;
        splitTabs.value = ns;
      }
      return;
    }

    // quad
    if (splitLayout.value === 'single') {
      splitLayout.value = 'quad';
      initSplitSlots(4);
    } else if (splitLayout.value === 'dual') {
      splitLayout.value = 'quad';
      const validTabs = tabs.value.filter(t => t.type === 'task' || t.type === 'shell');
      const used = new Set(
        [splitTabs.value[0], splitTabs.value[1]].filter(Boolean) as string[],
      );
      const available = validTabs.filter(t => !used.has(t.id));
      const ns = [...splitTabs.value];
      let alloc = [...available];
      for (let i = 2; i < 4; i++) {
        if (ns[i] === null && alloc.length > 0) {
          ns[i] = alloc.shift()!.id;
        }
      }
      splitTabs.value = ns;
    }
  };

  // Toggle split mode (single <-> quad; same shortcut / title bar behavior as before)
  const toggleSplitMode = () => {
    if (splitLayout.value === 'single') {
      setSplitLayout('quad');
    } else {
      setSplitLayout('single');
    }
  };

  // Set a tab to a specific split index
  const setSplitTab = (index: number, tabId: string | null) => {
    const maxSlots = splitLayout.value === 'dual' ? 2 : 4;
    if (index >= 0 && index < maxSlots) {
      const newSplits = [...splitTabs.value];

      // If tab is already in another split, remove it from there (or swap?)
      // For simplicity, just remove it from old position. 
      // Ideally we might want to swap if we drag one split to another.
      if (tabId) {
        const existingIndex = newSplits.indexOf(tabId);
        if (existingIndex !== -1 && existingIndex !== index) {
          newSplits[existingIndex] = null;
        }
      }

      newSplits[index] = tabId;
      splitTabs.value = newSplits;
    }
  };

  return {
    // State
    tabs,
    activeTabId,
    splitLayout,
    isSplitMode,
    splitTabs,

    // Computed
    activeTabs,
    runningTabs,
    activeTab,

    // Methods
    initListeners,
    cleanupListeners,
    createShellTerminal,
    startShell,
    executeTask,
    executeSshTask,
    startTask,
    closeTab,
    stopTask,
    restartTask,
    setActiveTab,
    findTabByHistoryId,
    findTabByPtyId,
    applyPtyExitForTabId,
    updateTabStatus,
    updateTabStats,
    getTabProcessStats,
    clearClosedTabs,
    createSettingsTab,
    createNotificationsTab,
    createPortManagementTab,
    createFFmpegEncoderTab,
    toggleSplitMode,
    setSplitLayout,
    setSplitTab,
    createRoomInfoTab,
    // Screenshot related
    registerScreenshotHandler,
    unregisterScreenshotHandler,
    takeTerminalScreenshot,
    getScreenshotableTerminals,
  };
});
