/**
 * Mock Backend Adapter
 * 
 * Implementation of BackendAdapter for website demo and testing
 * Simulates backend operations with fake data
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
} from './types';

// Simulated file system
const mockFileSystem: Map<string, string> = new Map();
const mockDirectories: Set<string> = new Set(['/']);

// Simulated storage
const mockStorage: Map<string, any> = new Map();

// Pre-populate mock data for demo
const mockDemoData = {
  // Task folders
  taskFolders: ['/demo/my-vue-app'],
  
  // User groups with sample tasks
  userGroups: [
    {
      id: 'default',
      name: 'Default',
      tasks: [
        {
          id: 'user-task-1',
          name: 'Start Dev Server',
          command: 'npm',
          args: ['run', 'dev'],
          cwd: '/demo/my-vue-app',
          source: 'user',
          type: 'shell',
          group: 'build',
        },
        {
          id: 'user-task-2',
          name: 'Build Production',
          command: 'npm',
          args: ['run', 'build'],
          cwd: '/demo/my-vue-app',
          source: 'user',
          type: 'shell',
          group: 'build',
        },
        {
          id: 'user-task-3',
          name: 'Run Tests',
          command: 'npm',
          args: ['test'],
          cwd: '/demo/my-vue-app',
          source: 'user',
          type: 'shell',
          group: 'test',
        },
        {
          id: 'user-task-4',
          name: 'Lint & Fix',
          command: 'npm',
          args: ['run', 'lint:fix'],
          cwd: '/demo/my-vue-app',
          source: 'user',
          type: 'shell',
        },
      ],
    },
    {
      id: 'group-docker',
      name: 'Docker',
      tasks: [
        {
          id: 'user-task-5',
          name: 'Docker Build',
          command: 'docker',
          args: ['build', '-t', 'my-app', '.'],
          cwd: '/demo/my-vue-app',
          source: 'user',
          type: 'shell',
        },
        {
          id: 'user-task-6',
          name: 'Docker Run',
          command: 'docker',
          args: ['run', '-p', '3000:3000', 'my-app'],
          cwd: '/demo/my-vue-app',
          source: 'user',
          type: 'shell',
        },
      ],
    },
  ],
  
  // Favorite tasks
  favoriteTasks: ['user-task-1', 'user-task-2'],
  
  // Task run statistics (for recent tasks)
  taskRunStats: [
    { taskId: 'user-task-1', runCount: 15, lastRunTime: Date.now() - 1000 * 60 * 5 },
    { taskId: 'user-task-2', runCount: 8, lastRunTime: Date.now() - 1000 * 60 * 30 },
    { taskId: 'user-task-3', runCount: 12, lastRunTime: Date.now() - 1000 * 60 * 60 },
  ],
};

// Terminal simulation
let terminalIdCounter = 0;
const activeTerminals: Map<string, { 
  params: CreateTerminalParams;
  dataCallbacks: Set<(event: TerminalDataEvent) => void>;
  exitCallbacks: Set<(event: TerminalExitEvent) => void>;
  interval?: ReturnType<typeof setInterval>;
}> = new Map();

// Simulated output for different commands
const commandOutputs: Record<string, string[]> = {
  'npm run dev': [
    '\x1b[36m> rebebuca@0.2.1 dev\x1b[0m',
    '\x1b[36m> vite\x1b[0m',
    '',
    '\x1b[32m  VITE v6.0.5  ready in 342 ms\x1b[0m',
    '',
    '  \x1b[36m➜\x1b[0m  \x1b[1mLocal\x1b[0m:   http://localhost:\x1b[36m1420\x1b[0m/',
    '  \x1b[36m➜\x1b[0m  \x1b[1mNetwork\x1b[0m: use \x1b[36m--host\x1b[0m to expose',
  ],
  'npm run build': [
    '\x1b[36m> rebebuca@0.2.1 build\x1b[0m',
    '\x1b[36m> vue-tsc --noEmit && vite build\x1b[0m',
    '',
    '\x1b[32mvite v6.0.5 building for production...\x1b[0m',
    '\x1b[32m✓\x1b[0m 156 modules transformed.',
    '\x1b[36mdist/index.html\x1b[0m                  0.42 kB │ gzip:  0.27 kB',
    '\x1b[36mdist/assets/index-DiwrgTda.css\x1b[0m  24.15 kB │ gzip:  5.12 kB',
    '\x1b[36mdist/assets/index-BqeWRy9h.js\x1b[0m  312.45 kB │ gzip: 98.23 kB',
    '\x1b[32m✓ built in 3.42s\x1b[0m',
  ],
  'npm test': [
    '\x1b[36m> rebebuca@0.2.1 test\x1b[0m',
    '\x1b[36m> vitest run\x1b[0m',
    '',
    ' \x1b[32m✓\x1b[0m src/utils/platform.test.ts (3 tests) 12ms',
    ' \x1b[32m✓\x1b[0m src/stores/taskManager.test.ts (8 tests) 45ms',
    ' \x1b[32m✓\x1b[0m src/providers/npmScripts.test.ts (5 tests) 23ms',
    '',
    ' \x1b[1mTest Files\x1b[0m  \x1b[32m3 passed\x1b[0m (3)',
    ' \x1b[1mTests\x1b[0m       \x1b[32m16 passed\x1b[0m (16)',
    ' \x1b[1mDuration\x1b[0m    1.23s',
  ],
  'npm install': [
    '\x1b[36madded 156 packages in 8s\x1b[0m',
    '',
    '\x1b[32m42 packages are looking for funding\x1b[0m',
    '  run `npm fund` for details',
  ],
  default: [
    'Command executed successfully.',
  ],
};

/**
 * Mock Terminal Adapter
 */
class MockTerminalAdapter implements TerminalAdapter {
  async create(params: CreateTerminalParams): Promise<TerminalInfo> {
    const ptyId = `mock-pty-${++terminalIdCounter}`;
    
    activeTerminals.set(ptyId, {
      params,
      dataCallbacks: new Set(),
      exitCallbacks: new Set(),
    });
    
    // Simulate command output after a short delay
    setTimeout(() => this.simulateOutput(ptyId, params), 100);
    
    return { ptyId, pid: 10000 + terminalIdCounter };
  }

  private simulateOutput(ptyId: string, params: CreateTerminalParams) {
    const terminal = activeTerminals.get(ptyId);
    if (!terminal) return;

    const fullCommand = params.args?.length 
      ? `${params.command} ${params.args.join(' ')}`
      : params.command;
    
    const outputs = commandOutputs[fullCommand] || commandOutputs.default;
    let lineIndex = 0;

    // Send output line by line
    terminal.interval = setInterval(() => {
      if (lineIndex < outputs.length) {
        const data = outputs[lineIndex] + '\r\n';
        terminal.dataCallbacks.forEach(cb => cb({ ptyId, data }));
        lineIndex++;
      } else {
        // Command finished
        clearInterval(terminal.interval);
        terminal.interval = undefined;
        
        // For 'dev' command, keep running; others exit
        if (!fullCommand.includes('dev')) {
          setTimeout(() => {
            terminal.exitCallbacks.forEach(cb => cb({ ptyId, exitCode: 0 }));
          }, 200);
        }
      }
    }, 150);
  }

  async write(ptyId: string, data: string): Promise<void> {
    const terminal = activeTerminals.get(ptyId);
    if (terminal) {
      // Echo input
      terminal.dataCallbacks.forEach(cb => cb({ ptyId, data }));
    }
  }

  async resize(_ptyId: string, _cols: number, _rows: number): Promise<void> {
    // No-op for mock
  }

  async kill(ptyId: string): Promise<void> {
    const terminal = activeTerminals.get(ptyId);
    if (terminal) {
      if (terminal.interval) {
        clearInterval(terminal.interval);
      }
      terminal.exitCallbacks.forEach(cb => cb({ ptyId, exitCode: 130 }));
      activeTerminals.delete(ptyId);
    }
  }

  onData(callback: (event: TerminalDataEvent) => void): () => void {
    // Add callback to all active terminals
    activeTerminals.forEach(terminal => {
      terminal.dataCallbacks.add(callback);
    });
    
    return () => {
      activeTerminals.forEach(terminal => {
        terminal.dataCallbacks.delete(callback);
      });
    };
  }

  onExit(callback: (event: TerminalExitEvent) => void): () => void {
    activeTerminals.forEach(terminal => {
      terminal.exitCallbacks.add(callback);
    });
    
    return () => {
      activeTerminals.forEach(terminal => {
        terminal.exitCallbacks.delete(callback);
      });
    };
  }
}

/**
 * Mock File System Adapter
 */
class MockFileSystemAdapter implements FileSystemAdapter {
  async readTextFile(path: string): Promise<string> {
    const content = mockFileSystem.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async readDir(path: string): Promise<DirEntry[]> {
    const entries: DirEntry[] = [];
    const prefix = path.endsWith('/') ? path : path + '/';
    
    // Find all files and directories under this path
    mockFileSystem.forEach((_, filePath) => {
      if (filePath.startsWith(prefix)) {
        const relativePath = filePath.slice(prefix.length);
        const parts = relativePath.split('/');
        if (parts.length === 1) {
          entries.push({
            name: parts[0],
            path: filePath,
            isDirectory: false,
            isFile: true,
          });
        }
      }
    });
    
    mockDirectories.forEach(dirPath => {
      if (dirPath.startsWith(prefix) && dirPath !== path) {
        const relativePath = dirPath.slice(prefix.length);
        const parts = relativePath.split('/').filter(Boolean);
        if (parts.length === 1) {
          entries.push({
            name: parts[0],
            path: dirPath,
            isDirectory: true,
            isFile: false,
          });
        }
      }
    });
    
    return entries;
  }

  async exists(path: string): Promise<boolean> {
    return mockFileSystem.has(path) || mockDirectories.has(path);
  }

  async stat(path: string): Promise<FileInfo> {
    const isDir = mockDirectories.has(path);
    const isFile = mockFileSystem.has(path);
    
    if (!isDir && !isFile) {
      throw new Error(`Path not found: ${path}`);
    }
    
    return {
      path,
      size: isFile ? (mockFileSystem.get(path)?.length || 0) : 0,
      isDirectory: isDir,
      isFile,
      modifiedAt: Date.now(),
    };
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    mockFileSystem.set(path, content);
  }

  async mkdir(path: string, _options?: { recursive?: boolean }): Promise<void> {
    mockDirectories.add(path);
  }

  async remove(path: string, _options?: { recursive?: boolean }): Promise<void> {
    mockFileSystem.delete(path);
    mockDirectories.delete(path);
  }
}

/**
 * Mock Dialog Adapter
 */
class MockDialogAdapter implements DialogAdapter {
  async selectFolder(_options?: { title?: string; defaultPath?: string }): Promise<string | null> {
    // Return a mock folder path
    return '/mock/project';
  }

  async selectFile(_options?: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null> {
    return '/mock/project/file.txt';
  }

  async showMessage(_options: { title: string; message: string; type?: 'info' | 'warning' | 'error' }): Promise<void> {
    // No-op for mock, could show browser alert
  }

  async confirm(_options: { title: string; message: string }): Promise<boolean> {
    return true;
  }
}

/**
 * Mock Storage Adapter
 */
class MockStorageAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    // First check mockStorage
    const value = mockStorage.get(key);
    if (value !== undefined) {
      return value;
    }
    
    // Fall back to demo data
    if (key in mockDemoData) {
      return (mockDemoData as Record<string, any>)[key] as T;
    }
    
    return null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    mockStorage.set(key, value);
  }

  async delete(key: string): Promise<void> {
    mockStorage.delete(key);
  }

  async save(): Promise<void> {
    // Persist to localStorage if available
    if (typeof localStorage !== 'undefined') {
      const data: Record<string, any> = {};
      mockStorage.forEach((value, key) => {
        data[key] = value;
      });
      localStorage.setItem('rebebuca-mock-storage', JSON.stringify(data));
    }
  }
}

/**
 * Mock System Adapter
 */
class MockSystemAdapter implements SystemAdapter {
  async getPlatform(): Promise<'darwin' | 'windows' | 'linux'> {
    // Detect from browser user agent
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    if (ua.includes('mac')) return 'darwin';
    if (ua.includes('win')) return 'windows';
    return 'linux';
  }

  async getArch(): Promise<string> {
    return 'x86_64';
  }

  async openExternal(url: string): Promise<void> {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  async openInSystemTerminal(_command: string, _cwd?: string): Promise<void> {
    console.log('[Mock] openInSystemTerminal not available in browser');
  }

  async executeWithAdmin(_command: string, _args: string[]): Promise<AdminExecuteResult> {
    return { success: true, stdout: 'Mock admin execution', stderr: '' };
  }

  async getProcessInfo(_pid: number): Promise<ProcessInfo | null> {
    return { pid: _pid, name: 'mock-process', cpuUsage: 5.2, memoryUsage: 128 };
  }

  async listPorts(): Promise<PortInfo[]> {
    return [
      { port: 3000, pid: 12345, process: 'node', protocol: 'tcp' },
      { port: 5173, pid: 12346, process: 'vite', protocol: 'tcp' },
      { port: 8080, pid: 12347, process: 'nginx', protocol: 'tcp' },
      { port: 3306, pid: 12348, process: 'mysqld', protocol: 'tcp' },
      { port: 6379, pid: 12349, process: 'redis-server', protocol: 'tcp' },
      { port: 27017, pid: 12350, process: 'mongod', protocol: 'tcp' },
    ];
  }

  async killProcess(_pid: number): Promise<void> {
    console.log('[Mock] killProcess:', _pid);
  }

  async generateLogPath(): Promise<LogPathInfo> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return {
      logFilename: `task-${timestamp}.log`,
      logPath: `/mock/logs/task-${timestamp}.log`,
    };
  }
}

/**
 * Mock Window Adapter
 */
class MockWindowAdapter implements WindowAdapter {
  async minimize(): Promise<void> {
    console.log('[Mock] minimize');
  }

  async maximize(): Promise<void> {
    console.log('[Mock] maximize');
  }

  async close(): Promise<void> {
    console.log('[Mock] close');
  }

  async isMaximized(): Promise<boolean> {
    return false;
  }

  async setTitle(title: string): Promise<void> {
    if (typeof document !== 'undefined') {
      document.title = title;
    }
  }

  async show(): Promise<void> {
    console.log('[Mock] show');
  }

  async hide(): Promise<void> {
    console.log('[Mock] hide');
  }
}

/**
 * Mock Updater Adapter
 */
class MockUpdaterAdapter implements UpdaterAdapter {
  async checkForUpdates(): Promise<{ available: boolean; version?: string; notes?: string } | null> {
    return { available: false };
  }

  async downloadAndInstall(): Promise<void> {
    console.log('[Mock] downloadAndInstall');
  }

  onProgress(_callback: (progress: number) => void): () => void {
    return () => {};
  }
}

/**
 * Mock Notification Adapter
 */
class MockNotificationAdapter implements NotificationAdapter {
  async show(options: { title: string; body: string; icon?: string }): Promise<void> {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(options.title, { body: options.body });
    } else {
      console.log('[Mock] Notification:', options.title, options.body);
    }
  }

  async requestPermission(): Promise<boolean> {
    if (typeof Notification !== 'undefined') {
      const result = await Notification.requestPermission();
      return result === 'granted';
    }
    return false;
  }
}

/**
 * Mock Tray Adapter
 */
class MockTrayAdapter implements TrayAdapter {
  async setIcon(_icon: string): Promise<void> {}
  async setTooltip(_tooltip: string): Promise<void> {}
  async setMenu(_items: Array<{ label: string; action?: string; enabled?: boolean }>): Promise<void> {}
  onAction(_callback: (action: string) => void): () => void {
    return () => {};
  }
  async updateRunningProcesses(_processes: RunningProcessInfo[]): Promise<void> {
    console.log('[MockTray] updateRunningProcesses:', _processes.length);
  }
  async updateFavorites(_favorites: FavoriteTaskInfo[]): Promise<void> {
    console.log('[MockTray] updateFavorites:', _favorites.length);
  }
  async updateRecentTasks(_recent: RecentTaskInfo[]): Promise<void> {
    console.log('[MockTray] updateRecentTasks:', _recent.length);
  }
  onRestartProcess(_callback: (processId: string) => void): () => void {
    return () => {};
  }
  onStopProcess(_callback: (processId: string) => void): () => void {
    return () => {};
  }
  onRunFavorite(_callback: (taskId: string) => void): () => void {
    return () => {};
  }
  onRunRecent(_callback: (taskId: string) => void): () => void {
    return () => {};
  }
}

/**
 * Mock Backend Adapter - Main class
 */
export class MockAdapter implements BackendAdapter {
  readonly type: 'tauri' | 'server' | 'mock' = 'mock';

  terminal: TerminalAdapter;
  fs: FileSystemAdapter;
  dialog: DialogAdapter;
  storage: StorageAdapter;
  system: SystemAdapter;
  window: WindowAdapter;
  updater: UpdaterAdapter;
  notification: NotificationAdapter;
  tray: TrayAdapter;

  constructor() {
    this.terminal = new MockTerminalAdapter();
    this.fs = new MockFileSystemAdapter();
    this.dialog = new MockDialogAdapter();
    this.storage = new MockStorageAdapter();
    this.system = new MockSystemAdapter();
    this.window = new MockWindowAdapter();
    this.updater = new MockUpdaterAdapter();
    this.notification = new MockNotificationAdapter();
    this.tray = new MockTrayAdapter();
  }

  async init(): Promise<void> {
    // Load from localStorage if available
    if (typeof localStorage !== 'undefined') {
      try {
        const data = localStorage.getItem('rebebuca-mock-storage');
        if (data) {
          const parsed = JSON.parse(data);
          Object.entries(parsed).forEach(([key, value]) => {
            mockStorage.set(key, value);
          });
        }
      } catch (e) {
        console.warn('[Mock] Failed to load storage:', e);
      }
    }
  }

  async dispose(): Promise<void> {
    // Clear active terminals
    activeTerminals.forEach((terminal) => {
      if (terminal.interval) {
        clearInterval(terminal.interval);
      }
    });
    activeTerminals.clear();
  }
}

export function createMockAdapter(): BackendAdapter {
  return new MockAdapter();
}
