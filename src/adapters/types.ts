/**
 * Backend Adapter Types
 * 
 * Defines the interface for backend adapters that abstract away
 * the underlying platform (Tauri, Server, Mock)
 */

// Terminal types
export interface CreateTerminalParams {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  logPath?: string;
  shellPath?: string | null;
}

export interface TerminalInfo {
  ptyId: string;
  pid?: number;
}

export interface TerminalDataEvent {
  ptyId: string;
  data: string;
}

export interface TerminalExitEvent {
  ptyId: string;
  exitCode: number | null;
}

// File system types
export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface FileInfo {
  path: string;
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  modifiedAt?: number;
}

// Process types
export interface ProcessInfo {
  pid: number;
  name: string;
  cpuUsage?: number;
  memoryUsage?: number;
}

export interface AdminExecuteResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

// Port types
export interface PortInfo {
  port: number;
  pid: number;
  process: string;
  protocol: string;
}

// Log types
export interface LogPathInfo {
  logFilename: string;
  logPath: string;
}

// System Terminal types
export interface SystemTerminalInfo {
  id: string;
  name: string;
  path: string;
  available: boolean;
  is_default: boolean;
}

// Shell Program types (for internal PTY terminal)
export interface ShellInfo {
  id: string;
  name: string;
  path: string;
  available: boolean;
  is_default: boolean;
}

// PTY Process Stats types
export interface PtyProcessStats {
  ptyId: string;
  pid: number;
  cpuUsage: number;
  memoryUsage: number;
  memoryUsageMb: string;
}

/**
 * Terminal Adapter Interface
 */
export interface TerminalAdapter {
  create(params: CreateTerminalParams): Promise<TerminalInfo>;
  write(ptyId: string, data: string): Promise<void>;
  resize(ptyId: string, cols: number, rows: number): Promise<void>;
  kill(ptyId: string): Promise<void>;
  forceKill(ptyId: string): Promise<void>;
  isRunning(ptyId: string): Promise<boolean>;
  getProcessStats(ptyId: string): Promise<PtyProcessStats | null>;
  onData(callback: (event: TerminalDataEvent) => void): () => void;
  onExit(callback: (event: TerminalExitEvent) => void): () => void;
}

/**
 * File System Adapter Interface
 */
export interface FileSystemAdapter {
  readTextFile(path: string): Promise<string>;
  readDir(path: string): Promise<DirEntry[]>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileInfo>;
  writeTextFile(path: string, content: string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  remove(path: string, options?: { recursive?: boolean }): Promise<void>;
}

/**
 * Dialog Adapter Interface
 */
export interface DialogAdapter {
  selectFolder(options?: { title?: string; defaultPath?: string }): Promise<string | null>;
  selectFile(options?: { 
    title?: string; 
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null>;
  showMessage(options: { title: string; message: string; type?: 'info' | 'warning' | 'error' }): Promise<void>;
  confirm(options: { title: string; message: string }): Promise<boolean>;
  saveFile(options?: { 
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null>;
}

/**
 * Storage Adapter Interface
 */
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  save(): Promise<void>;
}

/**
 * System Adapter Interface
 */
export interface SystemAdapter {
  getPlatform(): Promise<'darwin' | 'windows' | 'linux'>;
  getArch(): Promise<string>;
  openExternal(url: string): Promise<void>;
  openInSystemTerminal(command: string, cwd?: string): Promise<void>;
  openInSpecificTerminal(terminalId: string, command: string, cwd?: string): Promise<void>;
  getAvailableTerminals(): Promise<SystemTerminalInfo[]>;
  getAvailableShells(): Promise<ShellInfo[]>;
  executeWithAdmin(command: string, args: string[]): Promise<AdminExecuteResult>;
  getProcessInfo(pid: number): Promise<ProcessInfo | null>;
  listPorts(): Promise<PortInfo[]>;
  killProcess(pid: number): Promise<void>;
  generateLogPath(taskId: string, pid?: number): Promise<LogPathInfo>;
  renameLogFile(oldFilename: string, taskId: string, pid: number): Promise<string>;
}

/**
 * Window Adapter Interface
 */
export interface WindowAdapter {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  setTitle(title: string): Promise<void>;
  show(): Promise<void>;
  hide(): Promise<void>;
}

/**
 * Updater Adapter Interface
 */
export interface UpdaterAdapter {
  checkForUpdates(): Promise<{ available: boolean; version?: string; notes?: string } | null>;
  downloadAndInstall(): Promise<void>;
  onProgress(callback: (progress: number) => void): () => void;
}

/**
 * Notification Adapter Interface
 */
export interface NotificationAdapter {
  show(options: { title: string; body: string; icon?: string }): Promise<void>;
  requestPermission(): Promise<boolean>;
}

/**
 * Tray Adapter Interface
 */
export interface RunningProcessInfo {
  id: string;           // PTY ID or process ID
  name: string;         // Display name
  taskId?: string;      // Associated task ID (for restart)
}

export interface FavoriteTaskInfo {
  id: string;           // Task ID
  name: string;         // Display name
  command: string;      // Command to execute
  cwd?: string;         // Working directory
}

export interface RecentTaskInfo {
  id: string;           // Task ID
  name: string;         // Display name
  command: string;      // Command to execute
  cwd?: string;         // Working directory
  timestamp: number;    // Last run timestamp (ms)
}

export interface TrayAdapter {
  setIcon(icon: string): Promise<void>;
  setTooltip(tooltip: string): Promise<void>;
  setMenu(items: Array<{ label: string; action?: string; enabled?: boolean }>): Promise<void>;
  onAction(callback: (action: string) => void): () => void;
  // Dynamic tray menu updates
  updateRunningProcesses(processes: RunningProcessInfo[]): Promise<void>;
  updateFavorites(favorites: FavoriteTaskInfo[]): Promise<void>;
  updateRecentTasks(recent: RecentTaskInfo[]): Promise<void>;
  // Event listeners for tray menu actions
  onRestartProcess(callback: (processId: string) => void): () => void;
  onStopProcess(callback: (processId: string) => void): () => void;
  onForceStopProcess(callback: (processId: string) => void): () => void;
  onRunFavorite(callback: (taskId: string) => void): () => void;
  onRunRecent(callback: (taskId: string) => void): () => void;
}

/**
 * Main Backend Adapter Interface
 * 
 * This is the main interface that combines all sub-adapters
 */
export interface BackendAdapter {
  readonly type: 'tauri' | 'server' | 'mock';
  
  terminal: TerminalAdapter;
  fs: FileSystemAdapter;
  dialog: DialogAdapter;
  storage: StorageAdapter;
  system: SystemAdapter;
  window: WindowAdapter;
  updater: UpdaterAdapter;
  notification: NotificationAdapter;
  tray: TrayAdapter;
  
  // Initialization
  init(): Promise<void>;
  
  // Cleanup
  dispose(): Promise<void>;
}

/**
 * Backend type for environment detection
 */
export type BackendType = 'tauri' | 'server' | 'mock';
