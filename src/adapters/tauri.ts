/**
 * Tauri Backend Adapter
 * 
 * Implementation of BackendAdapter for Tauri desktop application
 */

import type {
  BackendAdapter,
  TerminalAdapter,
  FileSystemAdapter,
  DialogAdapter,
  StorageAdapter,
  SystemAdapter,
  WindowAdapter,
  UpdaterAdapter,
  NotificationAdapter,
  TrayAdapter,
  OrchestrationAdapter,
  BoulderStateInfo,
  RunningProcessInfo,
  FavoriteTaskInfo,
  RecentTaskInfo,
  CreateTerminalParams,
  TerminalInfo,
  TerminalDataEvent,
  TerminalExitEvent,
  DirEntry,
  FileInfo,
  AdminExecuteResult,
  PortInfo,
  ProcessInfo,
  LogPathInfo,
  SystemTerminalInfo,
  ShellInfo,
  OrchestrationConfig,
  TaskGoal,
  OrchestrationStatus,
  OrchestrationProgressEvent,
  OrchestrationAgentMessageEvent,
  OrchestrationToolUseEvent,
  OrchestrationWorkerStreamEvent,
  OrchestrationCompleteEvent,
  OrchestrationErrorEvent,
  OrchestrationUsageEvent,
} from './types';

// Lazy imports for Tauri APIs
let tauriCore: typeof import('@tauri-apps/api/core') | null = null;
let tauriEvent: typeof import('@tauri-apps/api/event') | null = null;
let tauriFs: typeof import('@tauri-apps/plugin-fs') | null = null;
let tauriDialog: typeof import('@tauri-apps/plugin-dialog') | null = null;
let tauriStore: typeof import('@tauri-apps/plugin-store') | null = null;
let tauriOs: typeof import('@tauri-apps/plugin-os') | null = null;
let tauriOpener: typeof import('@tauri-apps/plugin-opener') | null = null;
let tauriShell: typeof import('@tauri-apps/plugin-shell') | null = null;
let tauriProcess: typeof import('@tauri-apps/plugin-process') | null = null;
let tauriNotification: typeof import('@tauri-apps/plugin-notification') | null = null;
let tauriUpdater: typeof import('@tauri-apps/plugin-updater') | null = null;

// Store instance cache
let storeInstance: any = null;
let loadingPromise: Promise<void> | null = null;

async function loadTauriModules() {
  if (!loadingPromise) {
    loadingPromise = (async () => {
      tauriCore = await import('@tauri-apps/api/core');
      tauriEvent = await import('@tauri-apps/api/event');
      tauriFs = await import('@tauri-apps/plugin-fs');
      tauriDialog = await import('@tauri-apps/plugin-dialog');
      tauriStore = await import('@tauri-apps/plugin-store');
      tauriOs = await import('@tauri-apps/plugin-os');
      tauriShell = await import('@tauri-apps/plugin-shell');
      tauriOpener = await import('@tauri-apps/plugin-opener');
      tauriProcess = await import('@tauri-apps/plugin-process');
      tauriNotification = await import('@tauri-apps/plugin-notification');
      tauriUpdater = await import('@tauri-apps/plugin-updater');
    })();
  }
  await loadingPromise;
}

/**
 * Tauri Terminal Adapter
 */
class TauriTerminalAdapter implements TerminalAdapter {
  private dataListeners: Map<string, () => void> = new Map();
  private exitListeners: Map<string, () => void> = new Map();

  async create(params: CreateTerminalParams): Promise<TerminalInfo> {
    await loadTauriModules();
    // Generate a unique ptyId for the task
    const ptyId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    // Use execute_task for running specific commands
    const result = await tauriCore!.invoke<string>('execute_task', {
      ptyId,
      command: params.command,
      args: params.args || [],
      options: {
        cwd: params.cwd || null,
        env: params.env || null,
        log_path: params.logPath || null,
        shell_path: params.shellPath || null,
      },
    });
    
    // execute_task returns the ptyId as string
    return { ptyId: result };
  }

  async write(ptyId: string, data: string): Promise<void> {
    await loadTauriModules();
    await tauriCore!.invoke('write_pty', { ptyId, data });
  }

  async resize(ptyId: string, cols: number, rows: number): Promise<void> {
    await loadTauriModules();
    await tauriCore!.invoke('resize_pty', { ptyId, cols, rows });
  }

  async kill(ptyId: string): Promise<void> {
    await loadTauriModules();
    // For tasks, try kill_task first; for shells use close_pty
    // Since this adapter's create() uses execute_task, we should use kill_task
    try {
      await tauriCore!.invoke('kill_task', { ptyId });
    } catch {
      // Fallback to close_pty for shell PTYs
      await tauriCore!.invoke('close_pty', { ptyId });
    }
  }

  async forceKill(ptyId: string): Promise<void> {
    await loadTauriModules();
    try {
      await tauriCore!.invoke('force_kill_task', { ptyId });
    } catch {
      // Fallback to close_pty for shell PTYs
      await tauriCore!.invoke('close_pty', { ptyId });
    }
  }

  async isRunning(ptyId: string): Promise<boolean> {
    await loadTauriModules();
    try {
      return await tauriCore!.invoke('is_task_running', { ptyId });
    } catch {
      return false;
    }
  }

  async getProcessStats(ptyId: string): Promise<import('./types').PtyProcessStats | null> {
    await loadTauriModules();
    try {
      const stats = await tauriCore!.invoke<{
        pty_id: string;
        pid: number;
        cpu_usage: number;
        memory_usage: number;
        memory_usage_mb: string;
      }>('get_pty_process_stats', { ptyId });
      
      if (!stats) return null;
      
      return {
        ptyId: stats.pty_id,
        pid: stats.pid,
        cpuUsage: stats.cpu_usage,
        memoryUsage: stats.memory_usage,
        memoryUsageMb: stats.memory_usage_mb,
      };
    } catch {
      return null;
    }
  }

  onData(callback: (event: TerminalDataEvent) => void): () => void {
    const id = Math.random().toString(36).slice(2);
    let unlisten: (() => void) | null = null;

    loadTauriModules().then(async () => {
      unlisten = await tauriEvent!.listen<{ pty_id: string; data: string }>('pty-output', (e) => {
        callback({ ptyId: e.payload.pty_id, data: e.payload.data });
      });
      this.dataListeners.set(id, unlisten);
    });

    return () => {
      const fn = this.dataListeners.get(id);
      if (fn) {
        fn();
        this.dataListeners.delete(id);
      }
    };
  }

  onExit(callback: (event: TerminalExitEvent) => void): () => void {
    const id = Math.random().toString(36).slice(2);
    let unlisten: (() => void) | null = null;

    loadTauriModules().then(async () => {
      unlisten = await tauriEvent!.listen<{ pty_id: string; exit_code: number | null }>('pty-exit', (e) => {
        callback({ ptyId: e.payload.pty_id, exitCode: e.payload.exit_code });
      });
      this.exitListeners.set(id, unlisten);
    });

    return () => {
      const fn = this.exitListeners.get(id);
      if (fn) {
        fn();
        this.exitListeners.delete(id);
      }
    };
  }
}

/**
 * Tauri File System Adapter
 */
class TauriFileSystemAdapter implements FileSystemAdapter {
  async readTextFile(path: string): Promise<string> {
    await loadTauriModules();
    return await tauriFs!.readTextFile(path);
  }

  async readDir(path: string): Promise<DirEntry[]> {
    await loadTauriModules();
    const entries = await tauriFs!.readDir(path);
    return entries.map((e) => ({
      name: e.name,
      path: `${path}/${e.name}`,
      isDirectory: e.isDirectory,
      isFile: e.isFile,
    }));
  }

  async exists(path: string): Promise<boolean> {
    await loadTauriModules();
    return await tauriFs!.exists(path);
  }

  async stat(path: string): Promise<FileInfo> {
    await loadTauriModules();
    const stat = await tauriFs!.stat(path);
    return {
      path,
      size: stat.size,
      isDirectory: stat.isDirectory,
      isFile: stat.isFile,
      modifiedAt: stat.mtime ? new Date(stat.mtime).getTime() : undefined,
    };
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await loadTauriModules();
    await tauriFs!.writeTextFile(path, content);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await loadTauriModules();
    await tauriFs!.mkdir(path, { recursive: options?.recursive });
  }

  async remove(path: string, options?: { recursive?: boolean }): Promise<void> {
    await loadTauriModules();
    await tauriFs!.remove(path, { recursive: options?.recursive });
  }
}

/**
 * Tauri Dialog Adapter
 */
class TauriDialogAdapter implements DialogAdapter {
  async selectFolder(options?: { title?: string; defaultPath?: string }): Promise<string | null> {
    await loadTauriModules();
    const result = await tauriDialog!.open({
      directory: true,
      title: options?.title,
      defaultPath: options?.defaultPath,
    });
    return result as string | null;
  }

  async selectFile(options?: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null> {
    await loadTauriModules();
    const result = await tauriDialog!.open({
      directory: false,
      title: options?.title,
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    });
    return result as string | null;
  }

  async showMessage(options: { title: string; message: string; type?: 'info' | 'warning' | 'error' }): Promise<void> {
    await loadTauriModules();
    await tauriDialog!.message(options.message, { title: options.title, kind: options.type });
  }

  async confirm(options: { title: string; message: string }): Promise<boolean> {
    await loadTauriModules();
    return await tauriDialog!.confirm(options.message, { title: options.title });
  }

  async saveFile(options?: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null> {
    await loadTauriModules();
    const result = await tauriDialog!.save({
      title: options?.title,
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    });
    return result as string | null;
  }
}

/**
 * Tauri Storage Adapter
 */
class TauriStorageAdapter implements StorageAdapter {
  private storeName: string;

  constructor(storeName: string = 'rebebuca-config.json') {
    this.storeName = storeName;
  }

  private async getStore() {
    if (!storeInstance) {
      await loadTauriModules();
      
      // Check for named export or default export (handling different bundler behaviors)
      const StoreClass = tauriStore?.Store || (tauriStore as any)?.default?.Store;

      if (!StoreClass) {
        console.error('[TauriStorageAdapter] Store plugin not available. Module content:', tauriStore);
        throw new Error('Store plugin not available');
      }
      
      try {
        storeInstance = await StoreClass.load(this.storeName);
      } catch (err) {
        console.error('[TauriStorageAdapter] Failed to load store instance:', err);
        throw err;
      }
    }
    return storeInstance;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const store = await this.getStore();
      return (await store.get(key)) as T | null;
    } catch (error) {
      console.error('[TauriStorageAdapter] Failed to get value:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const store = await this.getStore();
    await store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    const store = await this.getStore();
    await store.delete(key);
  }

  async save(): Promise<void> {
    const store = await this.getStore();
    await store.save();
  }
}

/**
 * Tauri System Adapter
 */
class TauriSystemAdapter implements SystemAdapter {
  async getPlatform(): Promise<'darwin' | 'windows' | 'linux'> {
    await loadTauriModules();
    const platform = await tauriOs!.platform();
    if (platform === 'macos') return 'darwin';
    if (platform === 'windows') return 'windows';
    return 'linux';
  }

  async getArch(): Promise<string> {
    await loadTauriModules();
    return await tauriOs!.arch();
  }

  async getHomeDir(): Promise<string> {
    const { homeDir } = await import('@tauri-apps/api/path');
    return homeDir();
  }

  async openExternal(url: string): Promise<void> {
    await loadTauriModules();
    try {
      // Try using opener plugin (preferred in v2)
      // @ts-ignore - The type definition might be missing 'open' in some versions
      const opener = tauriOpener as any;
      // For file paths, ensure we use absolute path
      if (!url.includes('://')) {
        // It's a file path - try openPath first
        if (opener.openPath) {
          try {
            await opener.openPath(url);
            return;
          } catch (error) {
            console.warn('[TauriAdapter] openPath failed, trying other methods:', error);
          }
        }
        // Fallback to shell.open for file paths
        if (tauriShell && tauriShell.open) {
          console.log('[TauriAdapter] Using shell.open for file path');
          await tauriShell.open(url);
          return;
        }
      } else {
        // It's a URL
        if (opener.open) {
          await opener.open(url);
          return;
        } 
        if (opener.openUrl) {
          await opener.openUrl(url);
          return;
        }
      }
    } catch (error) {
      console.warn('[TauriAdapter] opener plugin failed:', error);
      // Fallback to shell plugin (v1 style, but still available in v2 via plugin-shell)
      if (tauriShell && tauriShell.open) {
        console.log('[TauriAdapter] Falling back to shell.open');
        await tauriShell.open(url);
        return;
      }
      throw error;
    }
  }

  async openInSystemTerminal(command: string, cwd?: string): Promise<void> {
    await loadTauriModules();
    await tauriCore!.invoke('open_in_system_terminal', { command, cwd: cwd || null });
  }

  async openInSpecificTerminal(terminalId: string, command: string, cwd?: string): Promise<void> {
    await loadTauriModules();
    await tauriCore!.invoke('open_in_specific_terminal', { terminalId, command, cwd: cwd || null });
  }

  async getAvailableTerminals(): Promise<SystemTerminalInfo[]> {
    await loadTauriModules();
    const terminals = await tauriCore!.invoke<Array<{ id: string; name: string; path: string; available: boolean; is_default: boolean }>>('get_available_terminals');
    return terminals.map(t => ({
      id: t.id,
      name: t.name,
      path: t.path,
      available: t.available,
      is_default: t.is_default,
    }));
  }

  async getAvailableShells(): Promise<ShellInfo[]> {
    await loadTauriModules();
    const shells = await tauriCore!.invoke<Array<{ id: string; name: string; path: string; available: boolean; is_default: boolean }>>('get_available_shells');
    return shells.map(s => ({
      id: s.id,
      name: s.name,
      path: s.path,
      available: s.available,
      is_default: s.is_default,
    }));
  }

  async executeWithAdmin(command: string, args: string[]): Promise<AdminExecuteResult> {
    await loadTauriModules();
    const result = await tauriCore!.invoke<{ success: boolean; stdout: string; stderr: string }>(
      'execute_with_admin',
      { command, args }
    );
    return result;
  }

  async getProcessInfo(pid: number): Promise<ProcessInfo | null> {
    await loadTauriModules();
    try {
      const info = await tauriCore!.invoke<ProcessInfo | null>('get_process_info', { pid });
      return info;
    } catch {
      return null;
    }
  }

  async listPorts(): Promise<PortInfo[]> {
    await loadTauriModules();
    const result = await tauriCore!.invoke<Array<{ port: number; pid: number; name: string; command: string }>>('get_port_processes');
    return result.map(p => ({
      port: p.port,
      pid: p.pid,
      process: p.name,
      protocol: 'tcp',
    }));
  }

  async killProcess(pid: number): Promise<void> {
    await loadTauriModules();
    // Use port::kill_process_by_pid for killing by PID, not process::kill_process_cmd
    await tauriCore!.invoke('kill_process_by_pid', { pid });
  }

  async generateLogPath(taskId: string, pid?: number): Promise<LogPathInfo> {
    await loadTauriModules();
    const result = await tauriCore!.invoke<{ log_filename: string; log_path: string }>('generate_log_path', {
      taskId,
      pid: pid || null,
    });
    return { logFilename: result.log_filename, logPath: result.log_path };
  }

  async renameLogFile(oldFilename: string, taskId: string, pid: number): Promise<string> {
    await loadTauriModules();
    const newFilename = await tauriCore!.invoke<string>('rename_log_file', {
      oldFilename,
      taskId,
      pid,
    });
    return newFilename;
  }

  async checkFullDiskAccess(): Promise<boolean> {
    await loadTauriModules();
    return await tauriCore!.invoke<boolean>('check_full_disk_access');
  }

  async openFullDiskAccessSettings(): Promise<void> {
    await loadTauriModules();
    await tauriCore!.invoke('open_full_disk_access_settings');
  }
}

/**
 * Tauri Window Adapter
 */
class TauriWindowAdapter implements WindowAdapter {
  private async getWindow() {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return getCurrentWindow();
  }

  async minimize(): Promise<void> {
    const win = await this.getWindow();
    await win.minimize();
  }

  async maximize(): Promise<void> {
    const win = await this.getWindow();
    const isMax = await win.isMaximized();
    if (isMax) {
      await win.unmaximize();
    } else {
      await win.maximize();
    }
  }

  async close(): Promise<void> {
    const win = await this.getWindow();
    await win.close();
  }

  async isMaximized(): Promise<boolean> {
    const win = await this.getWindow();
    return await win.isMaximized();
  }

  async setTitle(title: string): Promise<void> {
    const win = await this.getWindow();
    await win.setTitle(title);
  }

  async show(): Promise<void> {
    const win = await this.getWindow();
    await win.show();
  }

  async hide(): Promise<void> {
    const win = await this.getWindow();
    await win.hide();
  }
}

/**
 * Tauri Updater Adapter
 */
class TauriUpdaterAdapter implements UpdaterAdapter {
  private update: any = null;

  async checkForUpdates(): Promise<{ available: boolean; version?: string; notes?: string } | null> {
    await loadTauriModules();
    try {
      const update = await tauriUpdater!.check();
      if (update) {
        this.update = update;
        return {
          available: true,
          version: update.version,
          notes: update.body || undefined,
        };
      }
      return { available: false };
    } catch {
      return null;
    }
  }

  async downloadAndInstall(): Promise<void> {
    if (this.update) {
      await this.update.downloadAndInstall();
      await loadTauriModules();
      await tauriProcess!.relaunch();
    }
  }

  onProgress(_callback: (progress: number) => void): () => void {
    // Tauri updater doesn't have progress events in v2
    // Return a no-op unsubscribe function
    return () => {};
  }
}

/**
 * Tauri Notification Adapter
 */
class TauriNotificationAdapter implements NotificationAdapter {
  async show(options: { title: string; body: string; icon?: string }): Promise<void> {
    await loadTauriModules();
    await tauriNotification!.sendNotification({
      title: options.title,
      body: options.body,
    });
  }

  async requestPermission(): Promise<boolean> {
    await loadTauriModules();
    try {
      // Try different API versions
      const notification = tauriNotification as any;
      if (typeof notification.requestPermission === 'function') {
        const permission = await notification.requestPermission();
        return permission === 'granted';
      }
      // If no requestPermission, assume granted
      return true;
    } catch {
      return true;
    }
  }
}

/**
 * Tauri Tray Adapter - Manages system tray menu with running processes and favorites
 */
class TauriTrayAdapter implements TrayAdapter {
  private restartListeners: Map<string, () => void> = new Map();
  private stopListeners: Map<string, () => void> = new Map();
  private favoriteListeners: Map<string, () => void> = new Map();
  private recentListeners: Map<string, () => void> = new Map();

  async setIcon(_icon: string): Promise<void> {
    // Tray icon is set in Rust side
  }

  async setTooltip(_tooltip: string): Promise<void> {
    // Tray tooltip is set in Rust side
  }

  async setMenu(_items: Array<{ label: string; action?: string; enabled?: boolean }>): Promise<void> {
    // Tray menu is set in Rust side
  }

  onAction(_callback: (action: string) => void): () => void {
    // Tray actions are handled in Rust side
    return () => {};
  }

  async updateRunningProcesses(processes: RunningProcessInfo[]): Promise<void> {
    await loadTauriModules();
    await tauriCore!.invoke('update_tray_running_processes', { 
      processes: processes.map(p => ({
        id: p.id,
        name: p.name,
        task_id: p.taskId || null,
      }))
    });
  }

  async updateFavorites(favorites: FavoriteTaskInfo[]): Promise<void> {
    await loadTauriModules();
    await tauriCore!.invoke('update_tray_favorites', { 
      favorites: favorites.map(f => ({
        id: f.id,
        name: f.name,
        command: f.command,
        cwd: f.cwd || null,
      }))
    });
  }

  async updateRecentTasks(recent: RecentTaskInfo[]): Promise<void> {
    await loadTauriModules();
    await tauriCore!.invoke('update_tray_recent_tasks', { 
      recent: recent.map(r => ({
        id: r.id,
        name: r.name,
        command: r.command,
        cwd: r.cwd || null,
        timestamp: r.timestamp,
      }))
    });
  }

  onRestartProcess(callback: (processId: string) => void): () => void {
    const id = Math.random().toString(36).slice(2);
    let unlisten: (() => void) | null = null;

    loadTauriModules().then(async () => {
      unlisten = await tauriEvent!.listen<string>('tray-restart-process', (e) => {
        callback(e.payload);
      });
      this.restartListeners.set(id, unlisten);
    });

    return () => {
      const fn = this.restartListeners.get(id);
      if (fn) {
        fn();
        this.restartListeners.delete(id);
      }
    };
  }

  onStopProcess(callback: (processId: string) => void): () => void {
    const id = Math.random().toString(36).slice(2);
    let unlisten: (() => void) | null = null;

    loadTauriModules().then(async () => {
      unlisten = await tauriEvent!.listen<string>('tray-stop-process', (e) => {
        callback(e.payload);
      });
      this.stopListeners.set(id, unlisten);
    });

    return () => {
      const fn = this.stopListeners.get(id);
      if (fn) {
        fn();
        this.stopListeners.delete(id);
      }
    };
  }

  onForceStopProcess(callback: (processId: string) => void): () => void {
    const id = Math.random().toString(36).slice(2);
    let unlisten: (() => void) | null = null;

    loadTauriModules().then(async () => {
      unlisten = await tauriEvent!.listen<string>('tray-force-stop-process', (e) => {
        callback(e.payload);
      });
      this.stopListeners.set(id, unlisten);
    });

    return () => {
      const fn = this.stopListeners.get(id);
      if (fn) {
        fn();
        this.stopListeners.delete(id);
      }
    };
  }

  onRunFavorite(callback: (taskId: string) => void): () => void {
    const id = Math.random().toString(36).slice(2);
    let unlisten: (() => void) | null = null;

    loadTauriModules().then(async () => {
      unlisten = await tauriEvent!.listen<string>('tray-run-favorite', (e) => {
        callback(e.payload);
      });
      this.favoriteListeners.set(id, unlisten);
    });

    return () => {
      const fn = this.favoriteListeners.get(id);
      if (fn) {
        fn();
        this.favoriteListeners.delete(id);
      }
    };
  }

  onRunRecent(callback: (taskId: string) => void): () => void {
    const id = Math.random().toString(36).slice(2);
    let unlisten: (() => void) | null = null;

    loadTauriModules().then(async () => {
      unlisten = await tauriEvent!.listen<string>('tray-run-recent', (e) => {
        callback(e.payload);
      });
      this.recentListeners.set(id, unlisten);
    });

    return () => {
      const fn = this.recentListeners.get(id);
      if (fn) {
        fn();
        this.recentListeners.delete(id);
      }
    };
  }
}

/**
 * Tauri Orchestration Adapter
 */
class TauriOrchestrationAdapter implements OrchestrationAdapter {
  private progressListeners = new Map<string, () => void>();
  private agentMessageListeners = new Map<string, () => void>();
  private toolUseListeners = new Map<string, () => void>();
  private workerStreamListeners = new Map<string, () => void>();
  private completeListeners = new Map<string, () => void>();
  private errorListeners = new Map<string, () => void>();
  private usageListeners = new Map<string, () => void>();

  async createSession(config: OrchestrationConfig): Promise<string> {
    await loadTauriModules();
    return await tauriCore!.invoke('create_orchestration_session', { config });
  }

  async start(sessionId: string, goal: TaskGoal): Promise<void> {
    console.log('[TauriOrchestrationAdapter] Starting orchestration:', sessionId, goal);
    await loadTauriModules();
    try {
      await tauriCore!.invoke('start_orchestration', { sessionId, goal });
      console.log('[TauriOrchestrationAdapter] start_orchestration command sent successfully');
    } catch (error) {
      console.error('[TauriOrchestrationAdapter] Failed to start orchestration:', error);
      throw error;
    }
  }

  async stop(sessionId: string): Promise<void> {
    await loadTauriModules();
    await tauriCore!.invoke('stop_orchestration', { sessionId });
  }

  async getStatus(sessionId: string): Promise<OrchestrationStatus> {
    await loadTauriModules();
    return await tauriCore!.invoke('get_orchestration_status', { sessionId });
  }

  async removeSession(sessionId: string): Promise<void> {
    await loadTauriModules();
    await tauriCore!.invoke('remove_orchestration_session', { sessionId });
  }

  async checkBoulderState(projectPath: string): Promise<BoulderStateInfo | null> {
    await loadTauriModules();
    try {
      const result = await tauriCore!.invoke<BoulderStateInfo | null>('check_boulder_state', { projectPath });
      return result;
    } catch (error) {
      console.error('[TauriOrchestrationAdapter] Failed to check boulder state:', error);
      return null;
    }
  }

  onProgress(callback: (event: OrchestrationProgressEvent) => void): () => void {
    const id = Math.random().toString(36).slice(2);
    console.log('[TauriOrchestrationAdapter] Setting up progress listener:', id);
    loadTauriModules().then(async () => {
      console.log('[TauriOrchestrationAdapter] Tauri modules loaded, registering progress listener');
      const unlisten = await tauriEvent!.listen<OrchestrationProgressEvent>('orchestration:progress', (e) => {
        console.log('[TauriOrchestrationAdapter] Progress event received:', e.payload);
        callback(e.payload);
      });
      this.progressListeners.set(id, unlisten);
      console.log('[TauriOrchestrationAdapter] Progress listener registered');
    }).catch(err => {
      console.error('[TauriOrchestrationAdapter] Failed to setup progress listener:', err);
    });
    return () => {
      const fn = this.progressListeners.get(id);
      if (fn) {
        fn();
        this.progressListeners.delete(id);
      }
    };
  }

  onAgentMessage(callback: (event: OrchestrationAgentMessageEvent) => void): () => void {
    const id = Math.random().toString(36).slice(2);
    loadTauriModules().then(async () => {
      const unlisten = await tauriEvent!.listen<OrchestrationAgentMessageEvent>('orchestration:agent_message', (e) => {
        callback(e.payload);
      });
      this.agentMessageListeners.set(id, unlisten);
    });
    return () => {
      const fn = this.agentMessageListeners.get(id);
      if (fn) {
        fn();
        this.agentMessageListeners.delete(id);
      }
    };
  }

  onToolUse(callback: (event: OrchestrationToolUseEvent) => void): () => void {
    const id = Math.random().toString(36).slice(2);
    loadTauriModules().then(async () => {
      const unlisten = await tauriEvent!.listen<OrchestrationToolUseEvent>('orchestration:tool_use', (e) => {
        callback(e.payload);
      });
      this.toolUseListeners.set(id, unlisten);
    });
    return () => {
      const fn = this.toolUseListeners.get(id);
      if (fn) {
        fn();
        this.toolUseListeners.delete(id);
      }
    };
  }

  onWorkerStream(callback: (event: OrchestrationWorkerStreamEvent) => void): () => void {
    const id = Math.random().toString(36).slice(2);
    loadTauriModules().then(async () => {
      const unlisten = await tauriEvent!.listen<OrchestrationWorkerStreamEvent>('orchestration:worker_stream', (e) => {
        callback(e.payload);
      });
      this.workerStreamListeners.set(id, unlisten);
    });
    return () => {
      const fn = this.workerStreamListeners.get(id);
      if (fn) {
        fn();
        this.workerStreamListeners.delete(id);
      }
    };
  }

  onComplete(callback: (event: OrchestrationCompleteEvent) => void): () => void {
    const id = Math.random().toString(36).slice(2);
    loadTauriModules().then(async () => {
      const unlisten = await tauriEvent!.listen<OrchestrationCompleteEvent>('orchestration:complete', (e) => {
        callback(e.payload);
      });
      this.completeListeners.set(id, unlisten);
    });
    return () => {
      const fn = this.completeListeners.get(id);
      if (fn) {
        fn();
        this.completeListeners.delete(id);
      }
    };
  }

  onError(callback: (event: OrchestrationErrorEvent) => void): () => void {
    const id = Math.random().toString(36).slice(2);
    loadTauriModules().then(async () => {
      const unlisten = await tauriEvent!.listen<OrchestrationErrorEvent>('orchestration:error', (e) => {
        callback(e.payload);
      });
      this.errorListeners.set(id, unlisten);
    });
    return () => {
      const fn = this.errorListeners.get(id);
      if (fn) {
        fn();
        this.errorListeners.delete(id);
      }
    };
  }

  onUsage(callback: (event: OrchestrationUsageEvent) => void): () => void {
    const id = Math.random().toString(36).slice(2);
    loadTauriModules().then(async () => {
      const unlisten = await tauriEvent!.listen<OrchestrationUsageEvent>('orchestration:usage', (e) => {
        callback(e.payload);
      });
      this.usageListeners.set(id, unlisten);
    });
    return () => {
      const fn = this.usageListeners.get(id);
      if (fn) {
        fn();
        this.usageListeners.delete(id);
      }
    };
  }
}

/**
 * Tauri Backend Adapter - Main class
 */
export class TauriAdapter implements BackendAdapter {
  readonly type = 'tauri' as const;

  terminal: TerminalAdapter;
  fs: FileSystemAdapter;
  dialog: DialogAdapter;
  storage: StorageAdapter;
  system: SystemAdapter;
  window: WindowAdapter;
  updater: UpdaterAdapter;
  notification: NotificationAdapter;
  tray: TrayAdapter;
  orchestration: OrchestrationAdapter;

  constructor() {
    this.terminal = new TauriTerminalAdapter();
    this.fs = new TauriFileSystemAdapter();
    this.dialog = new TauriDialogAdapter();
    this.storage = new TauriStorageAdapter();
    this.system = new TauriSystemAdapter();
    this.window = new TauriWindowAdapter();
    this.updater = new TauriUpdaterAdapter();
    this.notification = new TauriNotificationAdapter();
    this.tray = new TauriTrayAdapter();
    this.orchestration = new TauriOrchestrationAdapter();
  }

  async init(): Promise<void> {
    await loadTauriModules();
  }

  async dispose(): Promise<void> {
    // Cleanup if needed
    storeInstance = null;
  }
}

export function createTauriAdapter(): BackendAdapter {
  return new TauriAdapter();
}
