/**
 * Backend Adapter Types
 * 
 * Defines the interface for backend adapters that abstract away
 * the underlying platform (Tauri, Server, Mock)
 */

// Terminal types
/** Optional metadata stored server-side for PTY session restore after refresh */
export interface PtySessionMeta {
  label?: string;
  taskId?: string;
  tabType?: 'task' | 'shell';
  historyId?: string;
  commandDisplay?: string;
}

export interface PtySessionInfo {
  ptyId: string;
  pid: number;
  running: boolean;
  meta: PtySessionMeta;
}

export interface CreateTerminalParams {
  /** Optional client-specified PTY ID. If not provided, server generates one. */
  ptyId?: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  logPath?: string;
  shellPath?: string | null;
  rows?: number;
  cols?: number;
  /** Passed to node-server for list/restore (optional) */
  meta?: PtySessionMeta;
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

// Port types (enriched; see port-whisperer-style metadata in node-server/handlers/port-enrichment.js)
export type PortListenerStatus = 'healthy' | 'orphaned' | 'zombie';

export interface PortInfo {
  port: number;
  pid: number;
  process: string;
  protocol: string;
  command?: string;
  cwd?: string;
  project?: string;
  framework?: string | null;
  uptime?: string | null;
  status?: PortListenerStatus;
  memory?: string | null;
  dockerContainer?: string;
  dockerImage?: string;
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
  /** Server mode: running PTYs for refresh recovery */
  listPtySessions?(): Promise<PtySessionInfo[]>;
  getPtyScrollback?(ptyId: string): Promise<string>;
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
  getHomeDir(): Promise<string>;
  openExternal(url: string): Promise<void>;
  openInSystemTerminal(command: string, cwd?: string, env?: Record<string, string>): Promise<void>;
  openInSpecificTerminal(terminalId: string, command: string, cwd?: string, env?: Record<string, string>): Promise<void>;
  getAvailableTerminals(): Promise<SystemTerminalInfo[]>;
  getAvailableShells(): Promise<ShellInfo[]>;
  executeWithAdmin(command: string, args: string[]): Promise<AdminExecuteResult>;
  getProcessInfo(pid: number): Promise<ProcessInfo | null>;
  listPorts(options?: { showAll?: boolean }): Promise<PortInfo[]>;
  killProcess(pid: number): Promise<void>;
  killProcessForce(pid: number): Promise<void>;
  generateLogPath(taskId: string, pid?: number): Promise<LogPathInfo>;
  renameLogFile(oldFilename: string, taskId: string, pid: number): Promise<string>;
  readLogFile(logFilename: string): Promise<string>;
  /** Check if app has Full Disk Access on macOS (always returns true on other platforms) */
  checkFullDiskAccess(): Promise<boolean>;
  /** Open macOS System Settings to Full Disk Access panel */
  openFullDiskAccessSettings(): Promise<void>;
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

// =============================================================================
// Orchestration Types (for AI Agent Collaboration)
// =============================================================================

/**
 * Provider configuration for AI models
 */
export interface ProviderConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Orchestration configuration
 */
export interface OrchestrationConfig {
  projectPath: string;
  supervisorProvider: ProviderConfig;
  workerProvider: ProviderConfig;
  maxRounds?: number;
  autoApprovePermissions?: boolean;
}

/**
 * Task goal for orchestration
 */
export interface TaskGoal {
  objective: string;
  taskName?: string;
  acceptanceCriteria: string[];
  context?: string;
  constraints?: string[];
}

/**
 * Orchestration status
 */
export interface OrchestrationStatus {
  sessionId: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  currentRound: number;
  maxRounds: number;
  currentAction: string;
}

/**
 * Orchestration events
 */
export interface OrchestrationProgressEvent {
  sessionId: string;
  currentStep: number;
  totalSteps: number;
  currentRound: number;
  maxRounds: number;
  currentAction: string;
}

export interface OrchestrationAgentMessageEvent {
  sessionId: string;
  fromAgent: string;
  toAgent: string;
  messageType: 'instruction' | 'report' | 'decision';
  content: string;
  timestamp: string;
}

export interface OrchestrationToolUseEvent {
  sessionId: string;
  toolName: string;
  status: 'start' | 'complete' | 'error';
  args?: Record<string, unknown>;
  result?: string;
  timestamp: string;
}

export interface OrchestrationWorkerStreamEvent {
  sessionId: string;
  content: string;
  isComplete: boolean;
  timestamp: string;
  from?: string;
}

export interface OrchestrationCompleteEvent {
  sessionId: string;
  success: boolean;
  summary: string;
  durationMs: number;
  timestamp: string;
}

export interface OrchestrationErrorEvent {
  sessionId: string;
  error: string;
  agent?: string;
  recoverable: boolean;
  timestamp: string;
}

export interface OrchestrationUsageEvent {
  sessionId: string;
  agent?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: string;
}

// Room Info types
export interface RoomInfo {
  RoomId: string;
  Name: string;
  Owner: string;
  OnlineCount: number;
  MaxCount: number;
  CreateTime: string;
}

export interface GetRoomInfoResult {
  ErrorCode: number;
  ErrorInfo: string;
  ActionStatus: string;
  RequestId: string;
  Data: RoomInfo;
}

export type OrchestrationEvent =
  | { type: 'progress'; data: OrchestrationProgressEvent }
  | { type: 'agent_message'; data: OrchestrationAgentMessageEvent }
  | { type: 'tool_use'; data: OrchestrationToolUseEvent }
  | { type: 'worker_stream'; data: OrchestrationWorkerStreamEvent }
  | { type: 'complete'; data: OrchestrationCompleteEvent }
  | { type: 'error'; data: OrchestrationErrorEvent }
  | { type: 'usage'; data: OrchestrationUsageEvent };

/**
 * Boulder State Info
 */
export interface BoulderStateInfo {
  exists: boolean;
  session_id?: string;
  plan_name?: string;
  goal?: TaskGoal;
  progress?: {
    current_round: number;
    current_action: string;
  };
  created_at?: string;
  updated_at?: string;
}

/**
 * Orchestration Adapter Interface
 */
export interface OrchestrationAdapter {
  /** Create a new orchestration session */
  createSession(config: OrchestrationConfig): Promise<string>;
  
  /** Start orchestration with a goal */
  start(sessionId: string, goal: TaskGoal): Promise<void>;
  
  /** Stop orchestration */
  stop(sessionId: string): Promise<void>;
  
  /** Get orchestration status */
  getStatus(sessionId: string): Promise<OrchestrationStatus>;
  
  /** Remove session */
  removeSession(sessionId: string): Promise<void>;
  
  /** Check if boulder state exists for a project path */
  checkBoulderState(projectPath: string): Promise<BoulderStateInfo | null>;
  
  /** Subscribe to orchestration events */
  onProgress(callback: (event: OrchestrationProgressEvent) => void): () => void;
  onAgentMessage(callback: (event: OrchestrationAgentMessageEvent) => void): () => void;
  onToolUse(callback: (event: OrchestrationToolUseEvent) => void): () => void;
  onWorkerStream(callback: (event: OrchestrationWorkerStreamEvent) => void): () => void;
  onComplete(callback: (event: OrchestrationCompleteEvent) => void): () => void;
  onError(callback: (event: OrchestrationErrorEvent) => void): () => void;
  onUsage(callback: (event: OrchestrationUsageEvent) => void): () => void;
}

/** SSH remote execution (Node server + ssh2 only) */
export interface SshExecuteByConfigIdParams {
  configId: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface SshExecuteInlineParams {
  /** Saved-config shape or run-config inline shape (host, port, username, auth, …) */
  config: Record<string, unknown>;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface SshAdapter {
  poolConnect(configId: string): Promise<void>;
  poolDisconnect(configId: string): Promise<void>;
  executeByConfigId(params: SshExecuteByConfigIdParams): Promise<string>;
  executeInline(params: SshExecuteInlineParams): Promise<string>;
  killExecution(execId: string): Promise<void>;
  testWithConfig(config: Record<string, unknown>): Promise<string>;
  probeConfigId(configId: string): Promise<boolean>;
  listDirectory(
    configId: string,
    remotePath: string,
  ): Promise<Array<{ name: string; path: string; is_dir: boolean; size?: number }>>;
  getHomeDirectory(configId: string): Promise<string>;
  getRemoteShells(
    configId: string,
  ): Promise<Array<{ id: string; name: string; path: string; is_default: boolean }>>;
}

/**
 * Main Backend Adapter Interface
 * 
 * This is the main interface that combines all sub-adapters
 */
export interface BackendAdapter {
  readonly type: 'server' | 'mock';
  
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
  /** Present when `type === 'server'` (WebSocket backend implements ssh.*) */
  ssh?: SshAdapter;
  
  // Initialization
  init(): Promise<void>;
  
  // Cleanup
  dispose(): Promise<void>;
}

/**
 * Backend type for environment detection
 */
export type BackendType = 'server' | 'mock';
