/**
 * Server Backend Adapter
 * 
 * Implementation of BackendAdapter for remote server execution
 * Connects to rebebuca-server via WebSocket
 */

import { showDirectoryPicker, setDirectoryPickerFsAdapter } from '../services/directoryPickerService';
import { showFilePicker, setFilePickerFsAdapter } from '../services/filePickerService';
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
  RunningProcessInfo,
  FavoriteTaskInfo,
  RecentTaskInfo,
  CreateTerminalParams,
  TerminalInfo,
  PtySessionInfo,
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
  PtyProcessStats,
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
  BoulderStateInfo,
  SshAdapter,
  SshExecuteByConfigIdParams,
  SshExecuteInlineParams,
} from './types';

// ============================================================================
// WebSocket Protocol Types
// ============================================================================

interface Request {
  id: string;
  method: string;
  params: any;
}

interface Response {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

interface Event {
  event: string;
  data: any;
}

type IncomingMessage = Response | Event;

// ============================================================================
// WebSocket Client
// ============================================================================

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }> = new Map();
  private eventHandlers: Map<string, Set<(data: any) => void>> = new Map();
  private requestIdCounter = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connected = false;
  /** In-flight connect; prevents overlapping connect() from orphan sockets. */
  private connectInFlight: Promise<void> | null = null;
  /** When true, onclose must not schedule reconnect (e.g. adapter.dispose). */
  private closingIntentionally = false;

  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    if (this.connectInFlight) {
      return this.connectInFlight;
    }

    this.closingIntentionally = false;

    this.connectInFlight = new Promise((resolve, reject) => {
      try {
        if (this.ws) {
          const stale = this.ws;
          stale.onopen = null;
          stale.onclose = null;
          stale.onerror = null;
          stale.onmessage = null;
          try {
            stale.close();
          } catch {
            // ignore
          }
          this.ws = null;
        }

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected to', this.url);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.connectInFlight = null;
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('[WebSocket] Disconnected:', event.code, event.reason);
          this.connected = false;
          this.connectInFlight = null;
          this.handleDisconnect();
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          if (!this.connected) {
            this.connectInFlight = null;
            reject(new Error('WebSocket connection failed'));
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.connectInFlight = null;
        reject(error);
      }
    });

    return this.connectInFlight;
  }

  private handleMessage(data: string) {
    try {
      const message: IncomingMessage = JSON.parse(data);

      // Check if it's a response (has id and success)
      if ('id' in message && 'success' in message) {
        const response = message as Response;
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          if (response.success) {
            pending.resolve(response.result);
          } else {
            pending.reject(new Error(response.error || 'Unknown error'));
          }
        }
      }
      // Check if it's an event (has event field)
      else if ('event' in message) {
        const event = message as Event;
        const handlers = this.eventHandlers.get(event.event);
        if (handlers) {
          handlers.forEach(handler => handler(event.data));
        }
      }
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  }

  private handleDisconnect() {
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error('WebSocket disconnected'));
    });
    this.pendingRequests.clear();

    if (this.closingIntentionally) {
      return;
    }

    // Attempt reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[WebSocket] Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.connect().catch(console.error);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  async request<T>(method: string, params: any = {}): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const id = `req-${++this.requestIdCounter}`;
    const request: Request = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(request));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  on(event: string, handler: (data: any) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  close() {
    this.closingIntentionally = true;
    this.reconnectAttempts = this.maxReconnectAttempts;
    this.connectInFlight = null;
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }
}

// ============================================================================
// Server Terminal Adapter
// ============================================================================

class ServerTerminalAdapter implements TerminalAdapter {
  private client: WebSocketClient;
  private dataCallbacks: Set<(event: TerminalDataEvent) => void> = new Set();
  private exitCallbacks: Set<(event: TerminalExitEvent) => void> = new Set();
  private unsubscribeData?: () => void;
  private unsubscribeExit?: () => void;

  constructor(client: WebSocketClient) {
    this.client = client;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.unsubscribeData = this.client.on('terminal.data', (data: TerminalDataEvent) => {
      this.dataCallbacks.forEach(cb => cb(data));
    });

    this.unsubscribeExit = this.client.on('terminal.exit', (data: TerminalExitEvent) => {
      this.exitCallbacks.forEach(cb => cb(data));
    });
  }

  async create(params: CreateTerminalParams): Promise<TerminalInfo> {
    return this.client.request<TerminalInfo>('terminal.create', params);
  }

  async write(ptyId: string, data: string): Promise<void> {
    await this.client.request('terminal.write', { ptyId, data });
  }

  async resize(ptyId: string, cols: number, rows: number): Promise<void> {
    await this.client.request('terminal.resize', { ptyId, cols, rows });
  }

  async kill(ptyId: string): Promise<void> {
    await this.client.request('terminal.kill', { ptyId });
  }

  async forceKill(ptyId: string): Promise<void> {
    await this.client.request('terminal.forceKill', { ptyId });
  }

  async isRunning(ptyId: string): Promise<boolean> {
    return this.client.request<boolean>('terminal.isRunning', { ptyId });
  }

  async getProcessStats(ptyId: string): Promise<PtyProcessStats | null> {
    return this.client.request<PtyProcessStats | null>('terminal.getProcessStats', { ptyId });
  }

  async listPtySessions(): Promise<PtySessionInfo[]> {
    return this.client.request<PtySessionInfo[]>('terminal.list', {});
  }

  async getPtyScrollback(ptyId: string): Promise<string> {
    return this.client.request<string>('terminal.getScrollback', { ptyId });
  }

  onData(callback: (event: TerminalDataEvent) => void): () => void {
    this.dataCallbacks.add(callback);
    return () => {
      this.dataCallbacks.delete(callback);
    };
  }

  onExit(callback: (event: TerminalExitEvent) => void): () => void {
    this.exitCallbacks.add(callback);
    return () => {
      this.exitCallbacks.delete(callback);
    };
  }

  dispose() {
    this.unsubscribeData?.();
    this.unsubscribeExit?.();
    this.dataCallbacks.clear();
    this.exitCallbacks.clear();
  }
}

// ============================================================================
// Server File System Adapter
// ============================================================================

class ServerFileSystemAdapter implements FileSystemAdapter {
  private client: WebSocketClient;

  constructor(client: WebSocketClient) {
    this.client = client;
  }

  async readTextFile(path: string): Promise<string> {
    return this.client.request<string>('fs.readTextFile', { path });
  }

  async readDir(path: string): Promise<DirEntry[]> {
    return this.client.request<DirEntry[]>('fs.readDir', { path });
  }

  async exists(path: string): Promise<boolean> {
    return this.client.request<boolean>('fs.exists', { path });
  }

  async stat(path: string): Promise<FileInfo> {
    return this.client.request<FileInfo>('fs.stat', { path });
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await this.client.request('fs.writeTextFile', { path, content });
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await this.client.request('fs.mkdir', { path, recursive: options?.recursive ?? false });
  }

  async remove(path: string, options?: { recursive?: boolean }): Promise<void> {
    await this.client.request('fs.remove', { path, recursive: options?.recursive ?? false });
  }
}

// ============================================================================
// Server System Adapter
// ============================================================================

class ServerSystemAdapter implements SystemAdapter {
  private client: WebSocketClient;

  constructor(client: WebSocketClient) {
    this.client = client;
  }

  async getPlatform(): Promise<'darwin' | 'windows' | 'linux'> {
    return this.client.request<'darwin' | 'windows' | 'linux'>('system.getPlatform');
  }

  async getArch(): Promise<string> {
    return this.client.request<string>('system.getArch');
  }

  async getHomeDir(): Promise<string> {
    return this.client.request<string>('system.getHomeDirectory');
  }

  async openExternal(url: string): Promise<void> {
    // Open in browser for server mode
    window.open(url, '_blank');
  }

  async openInSystemTerminal(_command: string, _cwd?: string): Promise<void> {
    console.warn('[Server] openInSystemTerminal not available in server mode');
  }

  async openInSpecificTerminal(_terminalId: string, _command: string, _cwd?: string): Promise<void> {
    console.warn('[Server] openInSpecificTerminal not available in server mode');
  }

  async getAvailableTerminals(): Promise<SystemTerminalInfo[]> {
    return this.client.request<SystemTerminalInfo[]>('system.getAvailableTerminals');
  }

  async getAvailableShells(): Promise<ShellInfo[]> {
    return this.client.request<ShellInfo[]>('system.getAvailableShells');
  }

  async executeWithAdmin(_command: string, _args: string[]): Promise<AdminExecuteResult> {
    return { success: false, stdout: '', stderr: 'Admin execution not available in server mode' };
  }

  async getProcessInfo(pid: number): Promise<ProcessInfo | null> {
    return this.client.request<ProcessInfo | null>('system.getProcessInfo', { pid });
  }

  async listPorts(): Promise<PortInfo[]> {
    return this.client.request<PortInfo[]>('system.listPorts');
  }

  async killProcess(pid: number): Promise<void> {
    await this.client.request('system.killProcess', { pid });
  }

  async generateLogPath(taskId: string, pid?: number): Promise<LogPathInfo> {
    return this.client.request<LogPathInfo>('system.generateLogPath', { taskId, pid });
  }

  async renameLogFile(_oldFilename: string, taskId: string, pid: number): Promise<string> {
    // Simple implementation
    const timestamp = Date.now();
    return `${taskId}_${pid}_${timestamp}.log`;
  }

  async checkFullDiskAccess(): Promise<boolean> {
    return true;
  }

  async openFullDiskAccessSettings(): Promise<void> {
    console.warn('[Server] openFullDiskAccessSettings not available');
  }
}

// ============================================================================
// Server Storage Adapter
// ============================================================================

class ServerStorageAdapter implements StorageAdapter {
  private client: WebSocketClient;

  constructor(client: WebSocketClient) {
    this.client = client;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.client.request<T | null>('storage.get', { key });
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.client.request('storage.set', { key, value });
  }

  async delete(key: string): Promise<void> {
    await this.client.request('storage.delete', { key });
  }

  async save(): Promise<void> {
    await this.client.request('storage.save');
  }
}

// ============================================================================
// Server Dialog Adapter (Browser fallbacks)
// ============================================================================

class ServerDialogAdapter implements DialogAdapter {
  async selectFolder(options?: { title?: string; defaultPath?: string }): Promise<string | null> {
    // Use the directory picker service to show remote directory browser
    return showDirectoryPicker(options);
  }

  async selectFile(options?: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null> {
    // Use the file picker service to show remote file browser
    return showFilePicker(options);
  }

  async showMessage(options: { title: string; message: string; type?: 'info' | 'warning' | 'error' }): Promise<void> {
    alert(`${options.title}\n\n${options.message}`);
  }

  async confirm(options: { title: string; message: string }): Promise<boolean> {
    return window.confirm(`${options.title}\n\n${options.message}`);
  }

  async saveFile(_options?: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null> {
    return prompt('Enter save path:');
  }
}

// ============================================================================
// Server Window Adapter (No-op for browser)
// ============================================================================

class ServerWindowAdapter implements WindowAdapter {
  async minimize(): Promise<void> {}
  async maximize(): Promise<void> {}
  async close(): Promise<void> {}
  async isMaximized(): Promise<boolean> { return false; }
  async setTitle(title: string): Promise<void> {
    document.title = title;
  }
  async show(): Promise<void> {}
  async hide(): Promise<void> {}
}

// ============================================================================
// Server Updater Adapter (Check updates via remote server)
// ============================================================================

class ServerUpdaterAdapter implements UpdaterAdapter {
  private client: WebSocketClient;
  private progressCallback: ((progress: number) => void) | null = null;

  constructor(client: WebSocketClient) {
    this.client = client;
  }

  async checkForUpdates(): Promise<{ available: boolean; version?: string; notes?: string; currentVersion?: string } | null> {
    try {
      const result = await this.client.request<{
        available: boolean;
        currentVersion: string;
        latestVersion: string;
        notes: string;
      }>('updater.checkForUpdates', {});
      
      return {
        available: result.available,
        version: result.latestVersion,
        notes: result.notes,
        currentVersion: result.currentVersion
      };
    } catch (error) {
      // Silent fail for update check errors
      return { available: false };
    }
  }

  async downloadAndInstall(): Promise<void> {
    try {
      // Notify progress start
      if (this.progressCallback) {
        this.progressCallback(10);
      }
      
      const result = await this.client.request<{
        success: boolean;
        message: string;
      }>('updater.downloadAndInstall', {});
      
      if (this.progressCallback) {
        this.progressCallback(100);
      }
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      console.log('[ServerUpdater] Update installed:', result.message);
      
      // The server will restart, we need to wait and reconnect
      // Show a message to the user
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      console.error('[ServerUpdater] Failed to download and install update:', error);
      throw error;
    }
  }

  onProgress(callback: (progress: number) => void): () => void {
    this.progressCallback = callback;
    return () => {
      this.progressCallback = null;
    };
  }
}

// ============================================================================
// Server Notification Adapter
// ============================================================================

class ServerNotificationAdapter implements NotificationAdapter {
  async show(options: { title: string; body: string; icon?: string }): Promise<void> {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(options.title, { body: options.body });
    }
  }

  async requestPermission(): Promise<boolean> {
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      return result === 'granted';
    }
    return false;
  }
}

// ============================================================================
// Server Tray Adapter (No-op for browser)
// ============================================================================

class ServerTrayAdapter implements TrayAdapter {
  async setIcon(_icon: string): Promise<void> {}
  async setTooltip(_tooltip: string): Promise<void> {}
  async setMenu(_items: Array<{ label: string; action?: string; enabled?: boolean }>): Promise<void> {}
  onAction(_callback: (action: string) => void): () => void { return () => {}; }
  async updateRunningProcesses(_processes: RunningProcessInfo[]): Promise<void> {}
  async updateFavorites(_favorites: FavoriteTaskInfo[]): Promise<void> {}
  async updateRecentTasks(_recent: RecentTaskInfo[]): Promise<void> {}
  onRestartProcess(_callback: (processId: string) => void): () => void { return () => {}; }
  onStopProcess(_callback: (processId: string) => void): () => void { return () => {}; }
  onForceStopProcess(_callback: (processId: string) => void): () => void { return () => {}; }
  onRunFavorite(_callback: (taskId: string) => void): () => void { return () => {}; }
  onRunRecent(_callback: (taskId: string) => void): () => void { return () => {}; }
}

// ============================================================================
// Orchestration Adapter
// ============================================================================

class ServerOrchestrationAdapter implements OrchestrationAdapter {
  private client: WebSocketClient;
  
  constructor(client: WebSocketClient) {
    this.client = client;
  }

  async createSession(config: OrchestrationConfig): Promise<string> {
    return await this.client.request('orchestration.createSession', { config });
  }

  async start(sessionId: string, goal: TaskGoal): Promise<void> {
    await this.client.request('orchestration.start', { sessionId, goal });
  }

  async stop(sessionId: string): Promise<void> {
    await this.client.request('orchestration.stop', { sessionId });
  }

  async getStatus(sessionId: string): Promise<OrchestrationStatus> {
    return await this.client.request('orchestration.getStatus', { sessionId });
  }

  async removeSession(sessionId: string): Promise<void> {
    await this.client.request('orchestration.removeSession', { sessionId });
  }

  async checkBoulderState(projectPath: string): Promise<BoulderStateInfo | null> {
    try {
      return await this.client.request('orchestration.checkBoulderState', { projectPath });
    } catch (error) {
      console.error('[ServerOrchestrationAdapter] Failed to check boulder state:', error);
      return null;
    }
  }

  onProgress(callback: (event: OrchestrationProgressEvent) => void): () => void {
    return this.client.on('orchestration.progress', callback);
  }

  onAgentMessage(callback: (event: OrchestrationAgentMessageEvent) => void): () => void {
    return this.client.on('orchestration.agent_message', callback);
  }

  onToolUse(callback: (event: OrchestrationToolUseEvent) => void): () => void {
    return this.client.on('orchestration.tool_use', callback);
  }

  onComplete(callback: (event: OrchestrationCompleteEvent) => void): () => void {
    return this.client.on('orchestration.complete', callback);
  }

  onWorkerStream(callback: (event: OrchestrationWorkerStreamEvent) => void): () => void {
    return this.client.on('orchestration.worker_stream', callback);
  }

  onError(callback: (event: OrchestrationErrorEvent) => void): () => void {
    return this.client.on('orchestration.error', callback);
  }

  onUsage(callback: (event: OrchestrationUsageEvent) => void): () => void {
    return this.client.on('orchestration.usage', callback);
  }
}

// ============================================================================
// Server SSH Adapter
// ============================================================================

class ServerSshAdapter implements SshAdapter {
  constructor(private client: WebSocketClient) {}

  async poolConnect(configId: string): Promise<void> {
    await this.client.request('ssh.poolConnect', { configId });
  }

  async poolDisconnect(configId: string): Promise<void> {
    await this.client.request('ssh.poolDisconnect', { configId });
  }

  async executeByConfigId(params: SshExecuteByConfigIdParams): Promise<string> {
    return this.client.request<string>('ssh.executeByConfigId', params);
  }

  async executeInline(params: SshExecuteInlineParams): Promise<string> {
    return this.client.request<string>('ssh.executeInline', params);
  }

  async killExecution(execId: string): Promise<void> {
    await this.client.request('ssh.killExecution', { execId });
  }

  async testWithConfig(config: Record<string, unknown>): Promise<string> {
    return this.client.request<string>('ssh.testWithConfig', { config });
  }

  async probeConfigId(configId: string): Promise<boolean> {
    return this.client.request<boolean>('ssh.probeConfigId', { configId });
  }

  async listDirectory(
    configId: string,
    remotePath: string,
  ): Promise<Array<{ name: string; path: string; is_dir: boolean; size?: number }>> {
    return this.client.request('ssh.listDirectory', { configId, path: remotePath });
  }

  async getHomeDirectory(configId: string): Promise<string> {
    return this.client.request<string>('ssh.getHomeDirectory', { configId });
  }

  async getRemoteShells(
    configId: string,
  ): Promise<Array<{ id: string; name: string; path: string; is_default: boolean }>> {
    return this.client.request('ssh.getRemoteShells', { configId });
  }
}

// ============================================================================
// Server Backend Adapter
// ============================================================================

export class ServerAdapter implements BackendAdapter {
  readonly type: 'server' | 'mock' = 'server';

  private client: WebSocketClient;
  private serverTerminalAdapter: ServerTerminalAdapter | null = null;

  terminal!: TerminalAdapter;
  fs!: FileSystemAdapter;
  dialog!: DialogAdapter;
  storage!: StorageAdapter;
  system!: SystemAdapter;
  window!: WindowAdapter;
  updater!: UpdaterAdapter;
  notification!: NotificationAdapter;
  tray!: TrayAdapter;
  orchestration!: OrchestrationAdapter;
  ssh!: SshAdapter;

  constructor(serverUrl: string = 'ws://localhost:8765/ws') {
    this.client = new WebSocketClient(serverUrl);
  }

  async init(): Promise<void> {
    // Connect to WebSocket server
    await this.client.connect();

    // Initialize adapters
    this.serverTerminalAdapter = new ServerTerminalAdapter(this.client);
    this.terminal = this.serverTerminalAdapter;
    this.fs = new ServerFileSystemAdapter(this.client);
    this.dialog = new ServerDialogAdapter();
    this.storage = new ServerStorageAdapter(this.client);
    this.system = new ServerSystemAdapter(this.client);
    this.window = new ServerWindowAdapter();
    this.updater = new ServerUpdaterAdapter(this.client);
    this.notification = new ServerNotificationAdapter();
    this.tray = new ServerTrayAdapter();
    this.orchestration = new ServerOrchestrationAdapter(this.client);
    this.ssh = new ServerSshAdapter(this.client);

    // Set fs adapter for directory picker service
    setDirectoryPickerFsAdapter(this.fs);
    
    // Set fs adapter for file picker service
    setFilePickerFsAdapter(this.fs);

    console.log('[Server] Server adapter initialized');
  }

  async dispose(): Promise<void> {
    this.serverTerminalAdapter?.dispose();
    this.client.close();
    console.log('[Server] Server adapter disposed');
  }

  isConnected(): boolean {
    return this.client.isConnected();
  }
}

export function createServerAdapter(serverUrl?: string): BackendAdapter {
  // Auto-detect WebSocket URL based on current page location
  let url = serverUrl || import.meta.env.VITE_SERVER_URL;
  
  if (!url && typeof window !== 'undefined') {
    // Build WebSocket URL from current page location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    url = `${protocol}//${host}/ws`;
  }
  
  return new ServerAdapter(url || 'ws://localhost:8765/ws');
}
