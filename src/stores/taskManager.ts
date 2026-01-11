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
import { getAdapter, type BackendAdapter } from '../adapters';
import { 
  Task, 
  TaskProvider, 
  TaskSource, 
  TaskFolder,
  TaskTreeItem,
  TaskExecutionOptions,
} from '../providers/types';
import { vscodeTasksProvider } from '../providers/vscodeTasksProvider';
import { npmScriptsProvider } from '../providers/npmScriptsProvider';
import { scriptsProvider } from '../providers/scriptsProvider';
import { useTerminalStore } from './terminal';
import { useRunConfigStore } from './runConfig';
import { useSettingsStore } from './settings';
import { useNotificationStore } from './notification';
import { checkNeedsAdmin, executeWithAdmin, stripSudoPrefix, buildFullCommand } from '../utils/admin';
import { useSshStore } from './ssh';
import { safeInvoke } from '../utils/programUtils';
import { startMonitoring as startSupervisorMonitoring } from '../services/supervisorAIService';
import { useSupervisorAIStore } from './supervisorAI';
import type { AIToolType } from './aiTools';

/**
 * Check if command contains sudo and inject password if stored
 * Returns modified command/args or original if no sudo or no password stored
 */
function injectSudoPassword(
  command: string,
  args: string[],
  sudoPassword: string | null
): { command: string; args: string[]; modified: boolean } {
  // Only process on non-Windows platforms
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('win');
  if (isWindows || !sudoPassword) {
    return { command, args, modified: false };
  }
  
  // Escape password for shell (single quotes are safest)
  // Replace single quotes with '\'' (end quote, escaped quote, start quote)
  const escapedPassword = sudoPassword.replace(/'/g, "'\\''");
  
  // Check if command is a shell executor (sh, bash, zsh, etc.) with -c flag
  // In this case, the actual command is in args[1]
  const cmdLower = command.toLowerCase().trim();
  const isShellExecutor = ['sh', 'bash', 'zsh', 'fish', 'csh', 'tcsh', 'ksh'].includes(cmdLower);
  
  if (isShellExecutor && args.length >= 2 && args[0] === '-c') {
    // Command is executed via shell: sh -c "actual command"
    const actualCommand = args.slice(1).join(' ');
    
    // Check if actual command contains sudo
    const sudoPattern = /\bsudo\b/i;
    if (sudoPattern.test(actualCommand)) {
      // Replace 'sudo ' with 'echo password | sudo -S '
      const modifiedCommand = actualCommand.replace(
        /\bsudo\s+/gi,
        `echo '${escapedPassword}' | sudo -S `
      );
      
      if (modifiedCommand !== actualCommand) {
        return { 
          command, 
          args: ['-c', modifiedCommand], 
          modified: true 
        };
      }
    }
  }
  
  // Build full command string for checking
  const fullCommandStr = args.length > 0 ? `${command} ${args.join(' ')}` : command;
  
  // Check if command contains sudo (case-insensitive)
  const sudoPattern = /\bsudo\b/i;
  if (!sudoPattern.test(fullCommandStr)) {
    return { command, args, modified: false };
  }
  
  // Case 1: Command is exactly 'sudo' or starts with 'sudo '
  if (cmdLower === 'sudo' || cmdLower.startsWith('sudo ')) {
    // Extract the actual command after sudo
    let actualCommand: string;
    if (cmdLower === 'sudo') {
      // Command is 'sudo', actual command is in args
      actualCommand = args.length > 0 ? args.join(' ') : '';
    } else {
      // Command is 'sudo something', extract 'something' and combine with args
      const afterSudo = command.substring(5).trim();
      actualCommand = args.length > 0 ? `${afterSudo} ${args.join(' ')}` : afterSudo;
    }
    
    if (actualCommand) {
      // Build: echo 'password' | sudo -S <actual command>
      const newCommand = `echo '${escapedPassword}' | sudo -S ${actualCommand}`;
      return { command: 'sh', args: ['-c', newCommand], modified: true };
    }
  }
  
  // Case 2: Command string contains 'sudo' (e.g., "sudo apt update" or "npm run build && sudo deploy")
  // This is a shell command that needs to be wrapped
  // Replace all occurrences of 'sudo ' with 'echo password | sudo -S '
  const modifiedCommand = fullCommandStr.replace(
      /\bsudo\s+/gi,
      `echo '${escapedPassword}' | sudo -S `
    );
  
  // If modification was made, wrap in shell
  if (modifiedCommand !== fullCommandStr) {
    return { command: 'sh', args: ['-c', modifiedCommand], modified: true };
  }
  
  return { command, args, modified: false };
}

/**
 * Parse a command line string into command and arguments
 * Handles quoted arguments properly
 */
function parseCommandLine(cmdLine: string): { command: string; args: string[] } {
  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;
  
  for (let i = 0; i < cmdLine.length; i++) {
    const char = cmdLine[i];
    
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    
    if (char === '\\') {
      escaped = true;
      continue;
    }
    
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    
    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    
    current += char;
  }
  
  if (current) {
    tokens.push(current);
  }
  
  if (tokens.length === 0) {
    return { command: '', args: [] };
  }
  
  return {
    command: tokens[0],
    args: tokens.slice(1),
  };
}

// Adapter instance for persistence
let adapter: BackendAdapter | null = null;

// Initialize adapter
const initAdapter = async () => {
  if (!adapter) {
    try {
      adapter = await getAdapter();
    } catch (error) {
      console.warn('[TaskManager] Failed to initialize adapter:', error);
      return null;
    }
  }
  return adapter;
};

// User task group interface
export interface UserTaskGroup {
  id: string;
  name: string;
  tasks: Task[];
}

// Task run statistics interface
export interface TaskRunStats {
  taskId: string;
  runCount: number;       // Total run count
  lastRunTime: number;    // Last run timestamp
}

// Default group ID
const DEFAULT_GROUP_ID = 'default';
const DEFAULT_GROUP_NAME = 'Default';

// Task execution timeout (1 hour)
const TASK_EXECUTION_TIMEOUT_MS = 3600000;

/**
 * Task Manager Store
 * 
 * Manages task providers, scanned tasks, and task execution
 */
export const useTaskManagerStore = defineStore('taskManager', () => {
  // ============================================
  // State
  // ============================================
  
  // Registered task providers
  const providers = shallowRef<TaskProvider[]>([
    vscodeTasksProvider,
    npmScriptsProvider,
    scriptsProvider,
  ]);
  
  // Currently scanned folders
  const folders = ref<TaskFolder[]>([]);
  
  // User-defined task groups (stored in app config)
  const userGroups = ref<UserTaskGroup[]>([
    { id: DEFAULT_GROUP_ID, name: DEFAULT_GROUP_NAME, tasks: [] }
  ]);
  
  // All tasks (flat list) - from folders only
  const allTasks = ref<Task[]>([]);
  
  // Favorite task IDs (ordered array for drag-and-drop reordering)
  const favoriteTaskIds = ref<string[]>([]);
  
  // Loading state
  const isScanning = ref(false);
  
  // Initialization flag
  const initialized = ref(false);
  
  // Last scan time
  const lastScanTime = ref<number | null>(null);
  
  // Error messages
  const errors = ref<string[]>([]);
  
  // Scan options
  const scanRecursively = ref(true);
  
  // Running tasks: Map<taskId, tabId>
  const runningTasks = ref<Map<string, string>>(new Map());
  
  // Task run statistics: Map<taskId, TaskRunStats>
  // Using shallowRef for better reactivity with Map
  const taskRunStats = shallowRef<Map<string, TaskRunStats>>(new Map());
  
  // Recent tasks sort mode: 'time' (most recent first) or 'frequency' (most frequent first)
  const recentSortMode = ref<'time' | 'frequency'>('time');
  
  // ============================================
  // Computed
  // ============================================
  
  // All user tasks from all groups
  const allUserTasks = computed(() => 
    userGroups.value.flatMap(g => g.tasks)
  );
  
  // Combined all tasks (folder tasks + user tasks)
  const combinedTasks = computed(() => [
    ...allTasks.value,
    ...allUserTasks.value
  ]);
  
  // Favorite tasks (ordered by favoriteTaskIds order)
  const favoriteTasks = computed(() => {
    const taskMap = new Map(combinedTasks.value.map(t => [t.id, t]));
    return favoriteTaskIds.value
      .map(id => taskMap.get(id))
      .filter((t): t is Task => t !== undefined);
  });
  
  // Non-favorite tasks
  const regularTasks = computed(() => {
    const favoriteSet = new Set(favoriteTaskIds.value);
    return combinedTasks.value.filter(t => !favoriteSet.has(t.id));
  });
  
  // Recent tasks (sorted by last run time or frequency based on recentSortMode)
  const recentTasks = computed(() => {
    const settingsStore = useSettingsStore();
    const count = settingsStore.settings.recentTasksCount ?? 5;
    
    // Force dependency on taskRunStats by accessing its size
    const statsSize = taskRunStats.value.size;
    
    console.log('[TaskManager] recentTasks computed:', {
      count,
      taskRunStatsSize: statsSize,
      sortMode: recentSortMode.value,
    });
    
    if (count === 0) return [];
    if (statsSize === 0) return [];
    
    // Filter tasks that have run stats (include favorites - they can appear in both sections)
    const matchingTasks = combinedTasks.value.filter(t => taskRunStats.value.has(t.id));
    
    const tasksWithStats = matchingTasks
      .map(task => {
        const stats = taskRunStats.value.get(task.id)!;
        return { task, lastRunTime: stats.lastRunTime, runCount: stats.runCount };
      })
      .sort((a, b) => {
        // Sort based on mode
        if (recentSortMode.value === 'frequency') {
          return b.runCount - a.runCount; // Most frequent first
        }
        return b.lastRunTime - a.lastRunTime; // Most recent first
      })
      .slice(0, count)
      .map(item => item.task);
    
    console.log('[TaskManager] recentTasks result:', tasksWithStats.length, tasksWithStats.map(t => t.name));
    return tasksWithStats;
  });
  
  // Recent tasks with timestamp (for tray menu)
  // Returns tasks with their last run timestamp for display in dock/tray menu
  const recentTasksWithTimestamp = computed(() => {
    const settingsStore = useSettingsStore();
    const count = settingsStore.settings.recentTasksCount ?? 5;
    
    const statsSize = taskRunStats.value.size;
    if (count === 0 || statsSize === 0) return [];
    
    const matchingTasks = combinedTasks.value.filter(t => taskRunStats.value.has(t.id));
    
    return matchingTasks
      .map(task => {
        const stats = taskRunStats.value.get(task.id)!;
        return {
          id: task.id,
          name: task.name,
          command: task.command,
          cwd: task.cwd,
          timestamp: stats.lastRunTime,
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
      .slice(0, count);
  });
  
  // Check if a task is running
  const isTaskRunning = (taskId: string): boolean => {
    return runningTasks.value.has(taskId);
  };
  
  // Get the tab ID for a running task
  const getTaskTabId = (taskId: string): string | undefined => {
    return runningTasks.value.get(taskId);
  };
  
  // Tasks grouped by source
  const tasksBySource = computed(() => {
    const grouped = new Map<TaskSource, Task[]>();
    for (const task of combinedTasks.value) {
      const tasks = grouped.get(task.source) || [];
      tasks.push(task);
      grouped.set(task.source, tasks);
    }
    return grouped;
  });
  
  // Tasks grouped by folder
  const tasksByFolder = computed(() => {
    const grouped = new Map<string, Task[]>();
    for (const task of combinedTasks.value) {
      const folder = task.cwd || '';
      const tasks = grouped.get(folder) || [];
      tasks.push(task);
      grouped.set(folder, tasks);
    }
    return grouped;
  });
  
  // Build tasks
  const buildTasks = computed(() => 
    combinedTasks.value.filter(t => t.group === 'build')
  );
  
  // Test tasks
  const testTasks = computed(() => 
    combinedTasks.value.filter(t => t.group === 'test')
  );
  
  // Tree view structure
  const treeItems = computed((): TaskTreeItem[] => {
    const items: TaskTreeItem[] = [];
    
    for (const folder of folders.value) {
      const folderItem: TaskTreeItem = {
        id: `folder:${folder.path}`,
        label: folder.name,
        type: 'folder',
        expanded: true,
        children: [],
        hasError: folder.hasError,
        errorMessage: folder.errorMessage
      };
      
      // Group tasks by their cwd (subfolder), then by source
      // First, collect all tasks and group by their relative path
      const tasksBySubfolder = new Map<string, Map<TaskSource, Task[]>>();
      
      for (const [source, tasks] of folder.tasksBySource) {
        for (const task of tasks) {
          // Determine the subfolder relative path
          const taskCwd = task.cwd || folder.path;
          let relativePath = '';
          
          if (taskCwd.startsWith(folder.path)) {
            relativePath = taskCwd.slice(folder.path.length).replace(/^[/\\]+/, '');
          }
          
          // Use empty string for root folder tasks
          const subfolderKey = relativePath || '';
          
          if (!tasksBySubfolder.has(subfolderKey)) {
            tasksBySubfolder.set(subfolderKey, new Map());
          }
          
          const sourceMap = tasksBySubfolder.get(subfolderKey)!;
          if (!sourceMap.has(source)) {
            sourceMap.set(source, []);
          }
          sourceMap.get(source)!.push(task);
        }
      }
      
      // Convert to tree structure
      // Sort subfolder keys: root first, then alphabetically
      const sortedSubfolders = Array.from(tasksBySubfolder.keys()).sort((a, b) => {
        if (a === '') return -1;
        if (b === '') return 1;
        return a.localeCompare(b);
      });
      
      for (const subfolderPath of sortedSubfolders) {
        const sourceMap = tasksBySubfolder.get(subfolderPath)!;
        
        if (subfolderPath === '') {
          // Root folder tasks - add sources directly to folder
          for (const [source, tasks] of sourceMap) {
            if (tasks.length === 0) continue;
            
            const sourceItem: TaskTreeItem = {
              id: `source:${folder.path}:${source}`,
              label: getSourceLabel(source),
              type: 'source',
              icon: getSourceIcon(source),
              expanded: true,
              children: tasks.map(task => ({
                id: task.id,
                label: task.name,
                type: 'task' as const,
                task,
                icon: getTaskIcon(task),
              })),
            };
            
            folderItem.children?.push(sourceItem);
          }
        } else {
          // Subfolder - create subfolder node with sources as children
          const subfolderName = subfolderPath.split(/[/\\]/).pop() || subfolderPath;
          const subfolderItem: TaskTreeItem = {
            id: `subfolder:${folder.path}:${subfolderPath}`,
            label: subfolderName,
            type: 'subfolder',
            expanded: true,
            relativePath: subfolderPath,
            children: [],
          };
          
          for (const [source, tasks] of sourceMap) {
            if (tasks.length === 0) continue;
            
            const sourceItem: TaskTreeItem = {
              id: `source:${folder.path}:${subfolderPath}:${source}`,
              label: getSourceLabel(source),
              type: 'source',
              icon: getSourceIcon(source),
              expanded: true,
              children: tasks.map(task => ({
                id: task.id,
                label: task.name,
                type: 'task' as const,
                task,
                icon: getTaskIcon(task),
              })),
            };
            
            subfolderItem.children?.push(sourceItem);
          }
          
          if (subfolderItem.children && subfolderItem.children.length > 0) {
            folderItem.children?.push(subfolderItem);
          }
        }
      }
      
      // Always add folder item even if empty, so users can remove invalid/empty folders
      items.push(folderItem);
    }
    
    return items;
  });
  
  // User groups tree items
  const userGroupTreeItems = computed((): TaskTreeItem[] => {
    return userGroups.value.map(group => ({
      id: `group:${group.id}`,
      label: group.name,
      type: 'group' as const,
      expanded: true,
      children: group.tasks.map(task => ({
        id: task.id,
        label: task.name,
        type: 'task' as const,
        task,
        icon: getTaskIcon(task),
      })),
    }));
  });
  
  // ============================================
  // Methods
  // ============================================
  
  /**
   * Register a new task provider
   */
  function registerProvider(provider: TaskProvider) {
    if (!providers.value.find(p => p.id === provider.id)) {
      providers.value = [...providers.value, provider];
    }
  }
  
  /**
   * Unregister a task provider
   */
  function unregisterProvider(providerId: string) {
    providers.value = providers.value.filter(p => p.id !== providerId);
  }
  
  /**
   * Scan a folder for tasks using all providers
   */
  async function scanFolder(folderPath: string): Promise<TaskFolder> {
    console.log(`[TaskManager] Scanning folder: ${folderPath}`);
    const tasksBySource = new Map<TaskSource, Task[]>();
    const folderErrors: string[] = [];
    let hasPermissionError = false;
    
    for (const provider of providers.value) {
      try {
        console.log(`[TaskManager] Running provider: ${provider.id}`);
        const results = await provider.scan(folderPath, scanRecursively.value);
        console.log(`[TaskManager] Provider ${provider.id} returned ${results.length} results`);
        
        for (const result of results) {
          console.log(`[TaskManager] Result from ${result.path}: ${result.tasks.length} tasks`);
          if (result.errors) {
            console.warn(`[TaskManager] Errors:`, result.errors);
            folderErrors.push(...result.errors);
          }
          
          if (result.tasks.length > 0) {
            const existing = tasksBySource.get(provider.source) || [];
            tasksBySource.set(provider.source, [...existing, ...result.tasks]);
          }
        }
      } catch (error) {
        console.error(`[TaskManager] Provider ${provider.id} failed:`, error);
        const errorMessage = String(error);
        folderErrors.push(`${provider.name}: ${errorMessage}`);
        
        if (
          errorMessage.toLowerCase().includes('permission') || 
          errorMessage.toLowerCase().includes('access is denied') ||
          errorMessage.toLowerCase().includes('eacces')
        ) {
          hasPermissionError = true;
        }
      }
    }
    
    if (folderErrors.length > 0) {
      errors.value.push(...folderErrors);
      
      if (hasPermissionError) {
        const notificationStore = useNotificationStore();
        notificationStore.addError(
          'Folder Access Failed',
          `No permission to access folder: ${folderPath}\nPlease check permissions or try removing and re-adding the folder.`,
          'system'
        );
      }
    }
    
    // Extract folder name
    const parts = folderPath.split(/[/\\]/);
    const name = parts[parts.length - 1] || folderPath;
    
    return {
      path: folderPath,
      name,
      tasksBySource,
      hasError: folderErrors.length > 0,
      errorMessage: folderErrors.join('\n')
    };
  }
  
  /**
   * Save folder paths to persistent storage
   */
  async function saveFolderPaths(): Promise<void> {
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        const paths = folders.value.map(f => f.path);
        await adapterInstance.storage.set('taskFolders', paths);
        await adapterInstance.storage.save();
        console.log('[TaskManager] Saved folder paths:', paths);
      }
    } catch (error) {
      console.error('[TaskManager] Failed to save folder paths:', error);
    }
  }
  
  /**
   * Load folder paths from persistent storage
   */
  async function loadFolderPaths(): Promise<string[]> {
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        const paths = await adapterInstance.storage.get<string[]>('taskFolders');
        if (paths && Array.isArray(paths)) {
          console.log('[TaskManager] Loaded folder paths:', paths);
          return paths;
        }
      }
    } catch (error) {
      console.error('[TaskManager] Failed to load folder paths:', error);
    }
    return [];
  }
  
  /**
   * Save favorite task IDs to persistent storage
   */
  async function saveFavorites(): Promise<void> {
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        await adapterInstance.storage.set('favoriteTasks', favoriteTaskIds.value);
        await adapterInstance.storage.save();
        console.log('[TaskManager] Saved favorites:', favoriteTaskIds.value);
      }
    } catch (error) {
      console.error('[TaskManager] Failed to save favorites:', error);
    }
  }
  
  /**
   * Load favorite task IDs from persistent storage
   */
  async function loadFavorites(): Promise<void> {
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        const ids = await adapterInstance.storage.get<string[]>('favoriteTasks');
        if (ids && Array.isArray(ids)) {
          favoriteTaskIds.value = ids;
          console.log('[TaskManager] Loaded favorites:', ids);
        }
      }
    } catch (error) {
      console.error('[TaskManager] Failed to load favorites:', error);
    }
  }
  
  /**
   * Save task run statistics to persistent storage
   */
  async function saveTaskRunStats(): Promise<void> {
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        // Convert Map to array for storage
        const statsArray = Array.from(taskRunStats.value.values());
        await adapterInstance.storage.set('taskRunStats', statsArray);
        await adapterInstance.storage.save();
        console.log('[TaskManager] Saved task run stats:', statsArray.length, 'entries');
      }
    } catch (error) {
      console.error('[TaskManager] Failed to save task run stats:', error);
    }
  }
  
  /**
   * Load task run statistics from persistent storage
   */
  async function loadTaskRunStats(): Promise<void> {
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        const statsArray = await adapterInstance.storage.get<TaskRunStats[]>('taskRunStats');
        if (statsArray && Array.isArray(statsArray)) {
          taskRunStats.value = new Map(statsArray.map((s: TaskRunStats) => [s.taskId, s]));
          console.log('[TaskManager] Loaded task run stats:', statsArray.length, 'entries');
        }
        
        // Load recent sort mode
        const sortMode = await adapterInstance.storage.get<string>('recentSortMode');
        if (sortMode === 'time' || sortMode === 'frequency') {
          recentSortMode.value = sortMode;
          console.log('[TaskManager] Loaded recent sort mode:', sortMode);
        }
      }
    } catch (error) {
      console.error('[TaskManager] Failed to load task run stats:', error);
    }
  }
  
  /**
   * Toggle recent tasks sort mode between 'time' and 'frequency'
   */
  async function toggleRecentSortMode(): Promise<void> {
    recentSortMode.value = recentSortMode.value === 'time' ? 'frequency' : 'time';
    
    // Save the preference
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        await adapterInstance.storage.set('recentSortMode', recentSortMode.value);
        await adapterInstance.storage.save();
        console.log('[TaskManager] Saved recent sort mode:', recentSortMode.value);
      }
    } catch (error) {
      console.error('[TaskManager] Failed to save recent sort mode:', error);
    }
  }
  
  /**
   * Update task run statistics when a task is executed
   */
  async function updateTaskRunStats(taskId: string): Promise<void> {
    console.log('[TaskManager] updateTaskRunStats called for:', taskId);
    const existing = taskRunStats.value.get(taskId);
    const now = Date.now();
    
    if (existing) {
      existing.runCount += 1;
      existing.lastRunTime = now;
      console.log('[TaskManager] Updated existing stats:', existing);
    } else {
      const newStats = {
        taskId,
        runCount: 1,
        lastRunTime: now,
      };
      taskRunStats.value.set(taskId, newStats);
      console.log('[TaskManager] Created new stats:', newStats);
    }
    
    // Trigger reactivity
    taskRunStats.value = new Map(taskRunStats.value);
    console.log('[TaskManager] taskRunStats size after update:', taskRunStats.value.size);
    await saveTaskRunStats();
  }
  
  /**
   * Toggle task favorite status
   */
  async function toggleFavorite(taskId: string): Promise<void> {
    const index = favoriteTaskIds.value.indexOf(taskId);
    if (index !== -1) {
      favoriteTaskIds.value.splice(index, 1);
    } else {
      favoriteTaskIds.value.push(taskId);
    }
    // Trigger reactivity
    favoriteTaskIds.value = [...favoriteTaskIds.value];
    await saveFavorites();
  }
  
  /**
   * Check if a task is favorite
   */
  function isFavorite(taskId: string): boolean {
    return favoriteTaskIds.value.includes(taskId);
  }
  
  /**
   * Reorder favorite tasks
   */
  async function reorderFavorites(fromIndex: number, toIndex: number): Promise<void> {
    if (fromIndex < 0 || fromIndex >= favoriteTaskIds.value.length) return;
    if (toIndex < 0 || toIndex > favoriteTaskIds.value.length) return; // Allow toIndex == length for inserting at end
    if (fromIndex === toIndex) return;
    
    const ids = [...favoriteTaskIds.value];
    const [removed] = ids.splice(fromIndex, 1);
    // After removing, the valid range for insert is 0 to ids.length
    const insertIndex = Math.min(toIndex, ids.length);
    ids.splice(insertIndex, 0, removed);
    favoriteTaskIds.value = ids;
    await saveFavorites();
    console.log('[TaskManager] Reordered favorites:', fromIndex, '->', toIndex, 'result:', ids);
  }
  
  /**
   * Save user groups to persistent storage
   */
  async function saveUserGroups(): Promise<void> {
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        await adapterInstance.storage.set('userGroups', userGroups.value);
        await adapterInstance.storage.save();
        console.log('[TaskManager] Saved user groups:', userGroups.value.length);
      }
    } catch (error) {
      console.error('[TaskManager] Failed to save user groups:', error);
    }
  }
  
  /**
   * Load user groups from persistent storage
   */
  async function loadUserGroups(): Promise<void> {
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        const groups = await adapterInstance.storage.get<UserTaskGroup[]>('userGroups');
        if (groups && Array.isArray(groups) && groups.length > 0) {
          userGroups.value = groups;
          console.log('[TaskManager] Loaded user groups:', groups.length);
        }
      }
    } catch (error) {
      console.error('[TaskManager] Failed to load user groups:', error);
    }
  }
  
  /**
   * Create a new user group
   */
  async function createUserGroup(name: string): Promise<UserTaskGroup> {
    const group: UserTaskGroup = {
      id: `group-${Date.now()}`,
      name,
      tasks: [],
    };
    userGroups.value = [...userGroups.value, group];
    await saveUserGroups();
    return group;
  }
  
  /**
   * Rename a user group
   */
  async function renameUserGroup(groupId: string, newName: string): Promise<void> {
    const group = userGroups.value.find(g => g.id === groupId);
    if (group) {
      group.name = newName;
      userGroups.value = [...userGroups.value];
      await saveUserGroups();
    }
  }
  
  /**
   * Delete a user group (moves tasks to default group)
   */
  async function deleteUserGroup(groupId: string): Promise<void> {
    if (groupId === DEFAULT_GROUP_ID) return; // Cannot delete default group
    
    const group = userGroups.value.find(g => g.id === groupId);
    if (group) {
      // Move tasks to default group
      const defaultGroup = userGroups.value.find(g => g.id === DEFAULT_GROUP_ID);
      if (defaultGroup && group.tasks.length > 0) {
        defaultGroup.tasks = [...defaultGroup.tasks, ...group.tasks];
      }
      // Remove the group
      userGroups.value = userGroups.value.filter(g => g.id !== groupId);
      await saveUserGroups();
    }
  }
  
  /**
   * Add a task to a user group
   */
  async function addTaskToGroup(groupId: string, task: Omit<Task, 'id' | 'source'>): Promise<Task> {
    const group = userGroups.value.find(g => g.id === groupId);
    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }
    
    const newTask: Task = {
      ...task,
      id: `user-task-${Date.now()}`,
      source: 'user',
      name: task.name || 'Untitled Task',
      command: task.command || '',
    };
    
    group.tasks = [...group.tasks, newTask];
    userGroups.value = [...userGroups.value];
    await saveUserGroups();
    return newTask;
  }
  
  /**
   * Update a task in a user group
   */
  async function updateTaskInGroup(taskId: string, updates: Partial<Task>): Promise<void> {
    for (const group of userGroups.value) {
      const taskIndex = group.tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        group.tasks[taskIndex] = { ...group.tasks[taskIndex], ...updates };
        userGroups.value = [...userGroups.value];
        await saveUserGroups();
        return;
      }
    }
  }
  
  /**
   * Remove a task from user groups
   */
  async function removeTaskFromGroup(taskId: string): Promise<void> {
    for (const group of userGroups.value) {
      const taskIndex = group.tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        group.tasks = group.tasks.filter(t => t.id !== taskId);
        userGroups.value = [...userGroups.value];
        await saveUserGroups();
        return;
      }
    }
  }
  
  /**
   * Move a task to a different group
   */
  async function moveTaskToGroup(taskId: string, targetGroupId: string): Promise<void> {
    let task: Task | undefined;
    
    // Find and remove from current group
    for (const group of userGroups.value) {
      const taskIndex = group.tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        task = group.tasks[taskIndex];
        group.tasks = group.tasks.filter(t => t.id !== taskId);
        break;
      }
    }
    
    // Add to target group
    if (task) {
      const targetGroup = userGroups.value.find(g => g.id === targetGroupId);
      if (targetGroup) {
        targetGroup.tasks = [...targetGroup.tasks, task];
      }
    }
    
    userGroups.value = [...userGroups.value];
    await saveUserGroups();
  }
  
  /**
   * Scan a folder and return all tasks (for import preview)
   */
  async function scanFolderForTasks(folderPath: string): Promise<Task[]> {
    const folder = await scanFolder(folderPath);
    const tasks: Task[] = [];
    
    for (const sourceTasks of folder.tasksBySource.values()) {
      tasks.push(...sourceTasks);
    }
    
    return tasks;
  }
  
  /**
   * Import tasks from a folder to a user group
   */
  async function importTasksToGroup(groupId: string, folderPath: string): Promise<number> {
    // Scan the folder
    const folder = await scanFolder(folderPath);
    let importedCount = 0;
    
    // Get the target group
    const group = userGroups.value.find(g => g.id === groupId);
    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }
    
    // Import all tasks from the folder
    for (const tasks of folder.tasksBySource.values()) {
      for (const task of tasks) {
        const newTask: Task = {
          ...task,
          id: `user-task-${Date.now()}-${importedCount}`,
          source: 'user',
        };
        group.tasks = [...group.tasks, newTask];
        importedCount++;
      }
    }
    
    if (importedCount > 0) {
      userGroups.value = [...userGroups.value];
      await saveUserGroups();
    }
    
    console.log(`[TaskManager] Imported ${importedCount} tasks to group ${groupId}`);
    return importedCount;
  }
  
  /**
   * Import selected tasks to a user group with overwrite support
   */
  async function importTasksToGroupWithOverwrite(groupId: string, tasks: Task[]): Promise<number> {
    const group = userGroups.value.find(g => g.id === groupId);
    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }
    
    let importedCount = 0;
    
    for (const task of tasks) {
      // Check if task with same name exists
      const existingIndex = group.tasks.findIndex(t => t.name === task.name);
      
      const newTask: Task = {
        ...task,
        id: existingIndex >= 0 ? group.tasks[existingIndex].id : `user-task-${Date.now()}-${importedCount}`,
        source: 'user',
      };
      
      if (existingIndex >= 0) {
        // Overwrite existing task
        group.tasks[existingIndex] = newTask;
      } else {
        // Add new task
        group.tasks = [...group.tasks, newTask];
      }
      importedCount++;
    }
    
    if (importedCount > 0) {
      userGroups.value = [...userGroups.value];
      await saveUserGroups();
    }
    
    console.log(`[TaskManager] Imported ${importedCount} tasks to group ${groupId} (with overwrite)`);
    return importedCount;
  }

  /**
   * Export user groups to JSON string
   */
  async function exportUserGroups(): Promise<string> {
    const exportData = {
      version: '1.0',
      timestamp: Date.now(),
      groups: userGroups.value
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import user groups from JSON string
   */
  async function importUserGroups(jsonContent: string, mode: 'merge' | 'replace' = 'merge'): Promise<void> {
    try {
      const data = JSON.parse(jsonContent);
      if (!data.groups || !Array.isArray(data.groups)) {
        throw new Error('Invalid task configuration file');
      }

      if (mode === 'replace') {
        userGroups.value = data.groups;
      } else {
        // Merge
        for (const importedGroup of data.groups as UserTaskGroup[]) {
          const existingGroup = userGroups.value.find(g => g.name === importedGroup.name);
          if (existingGroup) {
             // Simplest merge: Append tasks from imported group to existing group (avoiding dups by ID)
             for (const task of importedGroup.tasks) {
                // Generate new ID to avoid conflict
                if (!existingGroup.tasks.some(t => t.name === task.name && t.command === task.command)) {
                    // Clone task with new ID
                    const newTask = { ...task, id: `user-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
                    existingGroup.tasks.push(newTask);
                }
             }
          } else {
             // Create new group
             userGroups.value.push(importedGroup);
          }
        }
      }
      await saveUserGroups();
    } catch (error) {
       console.error('Failed to import tasks:', error);
       throw error;
    }
  }
  
  /**
   * Initialize - load saved folders and scan them
   */
  async function initialize(): Promise<void> {
    if (initialized.value) return;
    
    initialized.value = true;
    
    // Load favorites first
    await loadFavorites();
    
    // Load task run statistics
    await loadTaskRunStats();
    
    // Load user groups
    await loadUserGroups();
    
    // Then load and scan folders
    const paths = await loadFolderPaths();
    
    if (paths.length > 0) {
      console.log('[TaskManager] Restoring folders:', paths);
      await scanFolders(paths);
    }
  }
  
  /**
   * Scan multiple folders (replaces existing folders)
   */
  async function scanFolders(folderPaths: string[]): Promise<void> {
    isScanning.value = true;
    errors.value = [];
    
    try {
      const scannedFolders: TaskFolder[] = [];
      const scannedTasks: Task[] = [];
      
      for (const path of folderPaths) {
        const folder = await scanFolder(path);
        scannedFolders.push(folder);
        
        // Collect all tasks
        for (const tasks of folder.tasksBySource.values()) {
          scannedTasks.push(...tasks);
        }
      }
      
      folders.value = scannedFolders;
      allTasks.value = scannedTasks;
      lastScanTime.value = Date.now();
      
      // Save folder paths
      await saveFolderPaths();
      
      console.log(`[TaskManager] Scan complete: ${scannedTasks.length} tasks found in ${scannedFolders.length} folders`);
    } finally {
      isScanning.value = false;
    }
  }
  
  /**
   * Add a folder to scan (keeps existing folders)
   */
  async function addFolder(folderPath: string): Promise<void> {
    // Check if folder already exists
    if (folders.value.some(f => f.path === folderPath)) {
      console.log(`[TaskManager] Folder already added: ${folderPath}`);
      return;
    }
    
    isScanning.value = true;
    
    try {
      const folder = await scanFolder(folderPath);
      
      // Add folder to existing list
      folders.value = [...folders.value, folder];
      
      // Collect all tasks from the new folder
      const newTasks: Task[] = [];
      for (const tasks of folder.tasksBySource.values()) {
        newTasks.push(...tasks);
      }
      allTasks.value = [...allTasks.value, ...newTasks];
      lastScanTime.value = Date.now();
      
      // Save folder paths
      await saveFolderPaths();
      
      console.log(`[TaskManager] Added folder: ${folderPath} with ${newTasks.length} tasks`);
    } finally {
      isScanning.value = false;
    }
  }
  
  /**
   * Remove a folder from the list
   */
  async function removeFolder(folderPath: string): Promise<void> {
    const folderIndex = folders.value.findIndex(f => f.path === folderPath);
    if (folderIndex === -1) return;
    
    // Remove folder
    folders.value = folders.value.filter(f => f.path !== folderPath);
    
    // Remove tasks from that folder
    allTasks.value = allTasks.value.filter(t => {
      // Check if task belongs to this folder
      const taskFolderPath = t.sourceFile?.split('.vscode')[0]?.replace(/\/$/, '') || t.cwd;
      return taskFolderPath !== folderPath;
    });
    
    // Save folder paths
    await saveFolderPaths();
    
    console.log(`[TaskManager] Removed folder: ${folderPath}`);
  }
  
  /**
   * Refresh tasks by rescanning all folders
   */
  async function refresh(): Promise<void> {
    const currentFolders = folders.value.map(f => f.path);
    if (currentFolders.length > 0) {
      await scanFolders(currentFolders);
    }
  }
  
  /**
   * Clear all tasks
   */
  function clear() {
    folders.value = [];
    allTasks.value = [];
    errors.value = [];
    lastScanTime.value = null;
  }
  
  /**
   * Resolve task dependencies recursively
   * Returns an array of task IDs in execution order
   */
  function resolveTaskDependencies(taskId: string, visited: Set<string> = new Set(), path: string[] = []): string[] {
    // Detect circular dependencies
    if (visited.has(taskId)) {
      const cycle = [...path, taskId].join(' → ');
      console.error(`[TaskManager] Circular dependency detected: ${cycle}`);
      return [];
    }
    
    visited.add(taskId);
    const currentPath = [...path, taskId];
    
    const task = findTask(taskId);
    if (!task) {
      console.error(`[TaskManager] Task not found: ${taskId}`);
      return [];
    }
    
    // If task has no dependencies, return just this task
    if (!task.dependsOn || task.dependsOn.length === 0) {
      return [taskId];
    }
    
    // Recursively resolve dependencies
    const resolvedDeps: string[] = [];
    for (const depId of task.dependsOn) {
      const depResolved = resolveTaskDependencies(depId, new Set(visited), currentPath);
      // Add dependencies that aren't already in the list
      for (const id of depResolved) {
        if (!resolvedDeps.includes(id)) {
          resolvedDeps.push(id);
        }
      }
    }
    
    // Add this task after its dependencies
    resolvedDeps.push(taskId);
    
    return resolvedDeps;
  }
  
  /**
   * Execute tasks in serial (one after another)
   */
  async function executeTasksSerial(taskIds: string[], options?: TaskExecutionOptions): Promise<void> {
    console.log('[TaskManager] Executing tasks in serial:', taskIds);
    
    for (const taskId of taskIds) {
      const task = findTask(taskId);
      if (!task) {
        console.error(`[TaskManager] Task not found: ${taskId}`);
        continue;
      }
      
      console.log(`[TaskManager] Executing task: ${task.name}`);
      await executeTaskInternal(task, options);
      
      // Wait for task to complete before starting next one
      // We need to wait for the task to finish
      const tabId = runningTasks.value.get(task.id);
      if (tabId) {
        const terminalStore = useTerminalStore();
        const tab = terminalStore.tabs.find(t => t.id === tabId);
        if (tab) {
          // Wait for task completion
          await new Promise<void>((resolve) => {
            const checkInterval = setInterval(() => {
              const currentTab = terminalStore.tabs.find(t => t.id === tabId);
              if (!currentTab || currentTab.status !== 'running') {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
            
            // Timeout after 1 hour
            setTimeout(() => {
              clearInterval(checkInterval);
              resolve();
            }, TASK_EXECUTION_TIMEOUT_MS);
          });
        }
      }
    }
  }
  
  /**
   * Execute tasks in parallel (all at once)
   */
  async function executeTasksParallel(taskIds: string[], options?: TaskExecutionOptions): Promise<void> {
    console.log('[TaskManager] Executing tasks in parallel:', taskIds);
    
    const promises: Promise<void>[] = [];
    
    for (const taskId of taskIds) {
      const task = findTask(taskId);
      if (!task) {
        console.error(`[TaskManager] Task not found: ${taskId}`);
        continue;
      }
      
      console.log(`[TaskManager] Starting task: ${task.name}`);
      promises.push(executeTaskInternal(task, options));
    }
    
    // Wait for all tasks to start (not complete)
    await Promise.all(promises);
  }
  
  /**
   * Find a task by ID (searches both folder tasks and user group tasks)
   */
  function findTask(taskId: string): Task | undefined {
    // First check folder tasks
    const folderTask = allTasks.value.find(t => t.id === taskId);
    if (folderTask) return folderTask;
    
    // Then check user group tasks
    for (const group of userGroups.value) {
      const userTask = group.tasks.find(t => t.id === taskId);
      if (userTask) return userTask;
    }
    
    return undefined;
  }
  
  /**
   * Execute a task (handles macro tasks with dependencies)
   * If the task is currently running, it will be restarted (stop + start in same context)
   * If the task is not running, a new terminal tab will be created
   */
  async function executeTask(task: Task, options?: TaskExecutionOptions): Promise<void> {
    // Handle macro tasks (tasks that orchestrate other tasks, no command of their own)
    // Only tasks explicitly marked as 'macro' or compound tasks without commands are macro tasks
    const isMacroTask = task.type === 'macro' || (!task.command && (task.dependsOn || task.subTasks));
    
    if (isMacroTask) {
      console.log('[TaskManager] Executing macro task:', task.name);
      
      // Check if this is a parallel macro task
      if (task.executionMode === 'parallel' && task.subTasks) {
        await executeTasksParallel(task.subTasks, options);
      } else if (task.dependsOn) {
        // Serial execution with dependencies
        const resolvedTasks = resolveTaskDependencies(task.id);
        await executeTasksSerial(resolvedTasks, options);
      } else if (task.subTasks) {
        // Serial execution without dependencies (default)
        await executeTasksSerial(task.subTasks, options);
      }
      
      // Update task run statistics for macro task
      await updateTaskRunStats(task.id);
      return;
    }
    
    // For regular tasks with dependencies, first execute dependencies, then the task itself
    if (task.dependsOn && task.dependsOn.length > 0 && task.command) {
      console.log('[TaskManager] Task has dependencies, resolving:', task.name);
      const resolvedTasks = resolveTaskDependencies(task.id);
      await executeTasksSerial(resolvedTasks, options);
      return;
    }
    
    // Execute as a simple task
    await executeTaskInternal(task, options);
  }
  
  /**
   * Internal function to execute a single task (non-macro)
   */
  async function executeTaskInternal(task: Task, options?: TaskExecutionOptions): Promise<void> {
    // Guard: This function should only be called for tasks with commands
    if (!task.command) {
      console.error('[TaskManager] Cannot execute task without command:', task.name);
      return;
    }
    
    // Check if task uses SSH
    if (task.sshConfigId) {
      await executeTaskViaSsh(task, options);
      return;
    }
    
    const terminalStore = useTerminalStore();
    const runConfigStore = useRunConfigStore();
    await terminalStore.initListeners();
    
    const cwd = options?.cwd || task.cwd;
    const env = options?.env ? { ...task.env, ...options.env } : task.env;
    
    // Check if task should be executed in system terminal
    if (task.useSystemTerminal) {
      console.log('[TaskManager] Task configured to use system terminal:', task.name);
      await executeInSystemTerminal(task, cwd);
      // Update task run statistics for system terminal tasks
      await updateTaskRunStats(task.id);
      return;
    }
    
    // Check if task is already running - if so, this is a restart
    const existingTabId = runningTasks.value.get(task.id);
    if (existingTabId) {
      const existingTab = terminalStore.tabs.find(t => t.id === existingTabId);
      if (existingTab && existingTab.status === 'running') {
        // This is a restart - stop first, then close the old tab
        try {
          await terminalStore.stopTask(existingTabId);
          // Close the old tab
          await terminalStore.closeTab(existingTabId);
        } catch (error) {
          console.warn('[TaskManager] Failed to stop/close existing task:', error);
        }
      }
      // Remove from running tasks
      runningTasks.value.delete(task.id);
    }
    
    // Determine command and args
    let command: string;
    let args: string[];
    
    // Check if command contains spaces and no args provided
    // This indicates the command is a full shell command string
    const hasArgs = task.args && task.args.length > 0;
    const commandHasSpaces = task.command && task.command.includes(' ');
    
    // Helper function to check if command needs shell execution
    // Commands with shell operators (&&, ||, |, ;, >, <, sudo, etc.) need shell
    const needsShellExecution = (cmdLine: string): boolean => {
      // Shell operators that require shell execution
      const shellOperators = ['&&', '||', '|', ';', '>', '<', '>>', '<<', '2>', '2>>', '&>', '`', '$('];
      
      // Check for shell operators (outside of quotes)
      let inSingleQuote = false;
      let inDoubleQuote = false;
      
      for (let i = 0; i < cmdLine.length; i++) {
        const char = cmdLine[i];
        
        if (char === "'" && !inDoubleQuote) {
          inSingleQuote = !inSingleQuote;
          continue;
        }
        
        if (char === '"' && !inSingleQuote) {
          inDoubleQuote = !inDoubleQuote;
          continue;
        }
        
        if (!inSingleQuote && !inDoubleQuote) {
          // Check for shell operators at current position
          for (const op of shellOperators) {
            if (cmdLine.slice(i, i + op.length) === op) {
              return true;
            }
          }
        }
      }
      
      // Check if command starts with sudo or other commands that need shell
      const shellCommands = ['sudo', 'nohup', 'time', 'nice', 'env'];
      const firstToken = cmdLine.trim().split(/\s+/)[0];
      if (shellCommands.includes(firstToken)) {
        return true;
      }
      
      return false;
    };
    
    // Determine if task should be executed via shell
    // user and npm tasks: always use shell execution for the whole command string
    // vscode tasks: use command + args as configured
    const shouldUseShellExecution = task.source === 'user' || task.source === 'npm';
    
    if (shouldUseShellExecution && commandHasSpaces) {
      // Execute via shell for user/npm tasks
      // Use task's shellPath if specified, otherwise use platform default
      const isWindows = navigator.platform.toLowerCase().includes('win');
      if (isWindows) {
        if (task.shellPath) {
          // Use user-configured shell (e.g., PowerShell)
          command = task.shellPath;
          args = ['-Command', task.command];
        } else {
          // Default to cmd
          command = 'cmd';
          args = ['/c', task.command];
        }
      } else {
        // On macOS/Linux use user-configured shell or default to sh
        command = task.shellPath || 'sh';
        args = ['-c', task.command];
      }
    } else if (commandHasSpaces && !hasArgs) {
      if (needsShellExecution(task.command)) {
        // Execute via shell for commands with shell operators or sudo
        const isWindows = navigator.platform.toLowerCase().includes('win');
        if (isWindows) {
          if (task.shellPath) {
            // Use user-configured shell (e.g., PowerShell)
            command = task.shellPath;
            args = ['-Command', task.command];
          } else {
            // Default to cmd
            command = 'cmd';
            args = ['/c', task.command];
          }
        } else {
          // On macOS/Linux use user-configured shell or default to sh
          command = task.shellPath || 'sh';
          args = ['-c', task.command];
        }
      } else {
        // Parse command string into command and args (for vscode tasks without args)
        const parsed = parseCommandLine(task.command);
        command = parsed.command;
        args = parsed.args;
      }
    } else {
      command = task.command;
      args = task.args || [];
    }
    
    // Build the full command string for display
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
    
    // Check if we have stored sudo password
    const settingsStore = useSettingsStore();
    const sudoPassword = settingsStore.getSudoPassword();
    
    // Check if command needs admin privileges
    const needsAdmin = await checkNeedsAdmin(fullCommand);
    
    // If command contains sudo and we have stored password, skip admin execution
    // and use normal PTY execution with password injection instead
    const hasSudo = /\bsudo\b/i.test(fullCommand);
    const shouldUseSudoPassword = hasSudo && sudoPassword && !navigator.platform.toLowerCase().includes('win');
    
    if (needsAdmin && !shouldUseSudoPassword) {
      console.log('[TaskManager] Command requires admin privileges:', fullCommand);
      
      // For admin commands, we execute differently:
      // 1. Strip sudo prefix if present (admin execution handles elevation)
      // 2. Execute via system admin dialog
      // 3. Show result in a terminal-like output
      
      const strippedCmd = stripSudoPrefix(command, args);
      const adminFullCommand = buildFullCommand(strippedCmd.command, strippedCmd.args);
      
      // Create history record
      const historyRecord = await runConfigStore.addHistory({
        configId: task.id,
        name: task.name,
        command: `[ADMIN] ${fullCommand}`,
        status: 'running',
        timestamp: new Date(),
        startTime: Date.now(),
      });
      
      try {
        console.log('[TaskManager] Executing with admin privileges:', adminFullCommand);
        
        const result = await executeWithAdmin(strippedCmd.command, strippedCmd.args);
        
        // Update history with result
        const status = result.success ? 'success' : 'error';
        const output = result.stdout + (result.stderr ? `\n[STDERR] ${result.stderr}` : '');
        const duration = Date.now() - (historyRecord.startTime || Date.now());
        
        await runConfigStore.updateHistory(historyRecord.id, {
          status,
          output,
          duration,
        });
        
        // Update task run statistics
        await updateTaskRunStats(task.id);
        
        console.log(`[TaskManager] Admin task completed: ${task.name}, success: ${result.success}`);
        
        // If there's output, we could optionally show it in a terminal tab
        // For now, just log it
        if (result.stdout) {
          console.log('[TaskManager] Admin command stdout:', result.stdout);
        }
        if (result.stderr) {
          console.warn('[TaskManager] Admin command stderr:', result.stderr);
        }
        
        return;
      } catch (error) {
        // User cancelled or execution failed
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        await runConfigStore.updateHistory(historyRecord.id, {
          status: 'error',
          output: `Admin execution failed: ${errorMessage}`,
          duration: Date.now() - (historyRecord.startTime || Date.now()),
        });
        
        // Don't throw - user cancellation is not an error to propagate
        if (errorMessage.includes('cancel') || errorMessage.includes('Cancel')) {
          console.log('[TaskManager] User cancelled admin execution');
          return;
        }
        
        throw error;
      }
    }
    
    // Normal (non-admin) execution continues below
    
    // Check if we should inject sudo password
    const { command: finalCommand, args: finalArgs, modified: sudoModified } = injectSudoPassword(command, args, sudoPassword);
    
    if (sudoModified) {
      console.log('[TaskManager] Injected sudo password into command');
      // Update command and args for execution
      command = finalCommand;
      args = finalArgs;
      // Rebuild full command for display (but don't show password)
      const displayCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
      // Replace password in display with ***
      const sanitizedCommand = displayCommand.replace(/echo '[^']*' \| sudo -S/g, 'echo \'***\' | sudo -S');
      console.log('[TaskManager] Modified command (password hidden):', sanitizedCommand);
    }
    
    // Rebuild full command for history (sanitize if password was injected)
    const historyCommand = sudoModified 
      ? fullCommand.replace(/sudo/g, 'sudo [password provided]')
      : fullCommand;
    
    // Create history record first
    const historyRecord = await runConfigStore.addHistory({
      configId: task.id,
      name: task.name,
      command: historyCommand,
      status: 'running',
      timestamp: new Date(),
      startTime: Date.now(),
    });
    
    // Initialize log path variables
    let logPath: string | undefined;
    let logFilename: string | undefined;
    
    try {
      // Generate log path if saveLogs is enabled
      if (settingsStore.settings.saveLogs) {
        try {
          const adapterInstance = await initAdapter();
          if (adapterInstance) {
            // Generate log path with task id, pid will be 0 initially
            const logInfo = await adapterInstance.system.generateLogPath(task.id, 0);
            logPath = logInfo.logPath;
            logFilename = logInfo.logFilename;
            console.log('[TaskManager] Generated log path:', logPath);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('[TaskManager] Failed to generate log path:', error);
          // Add notification for log path generation failure
          const notificationStore = useNotificationStore();
          notificationStore.addError(
            'Failed to generate log path',
            `Task: ${task.name}\n${errorMessage}`,
            'frontend'
          );
        }
      }
      
      const tab = await terminalStore.executeTask({
        command,
        args,
        cwd,
        env,
        taskId: task.id,
        historyId: historyRecord.id,
        label: task.name,
        logPath,
        shellPath: task.shellPath || null,
      });
      
      // Track this task as running
      runningTasks.value.set(task.id, tab.id);
      
      // Start supervisor monitoring if this is an AI tool task
      if (task.aiTool) {
        try {
          const supervisorStore = useSupervisorAIStore();
          await supervisorStore.initialize();
          
          if (supervisorStore.config.enabled && supervisorStore.shouldMonitorTool(task.aiTool as AIToolType)) {
            const sessionId = startSupervisorMonitoring(
              tab.ptyId,
              tab.id,
              task.aiTool as AIToolType,
              task.name,
              {
                maxIterations: supervisorStore.config.defaultMaxIterations,
                idleTimeout: supervisorStore.config.idleTimeout,
                autoMode: supervisorStore.config.autoModeEnabled,
              }
            );
            if (sessionId) {
              console.log(`[TaskManager] Started supervisor monitoring for AI tool task: ${task.name}, session: ${sessionId}`);
            }
          }
        } catch (error) {
          console.warn('[TaskManager] Failed to start supervisor monitoring:', error);
          // Don't fail the task execution if supervisor fails
        }
      }
      
      // Update task run statistics
      await updateTaskRunStats(task.id);
      
      // Update history with PTY ID, terminal tab ID, and log filename
      // Note: Log file will be renamed in terminal store when PID is available
      await runConfigStore.updateHistory(historyRecord.id, {
        ptyId: tab.ptyId,
        terminalTabId: tab.id,
        logFilename,
      });
      
      console.log(`[TaskManager] Task started: ${task.name}, historyId: ${historyRecord.id}`);
    } catch (error) {
      // Update history to error status if execution failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      await runConfigStore.updateHistory(historyRecord.id, {
        status: 'error',
        output: `Failed to start task: ${errorMessage}`,
      });
      
      // Add notification for task execution failure
      const notificationStore = useNotificationStore();
      notificationStore.addError(
        'Task execution failed',
        `Task: ${task.name}\n${errorMessage}`,
        'frontend'
      );
      
    throw error;
  }
}

  /**
   * Execute task via SSH
   */
  async function executeTaskViaSsh(task: Task, options?: TaskExecutionOptions): Promise<void> {
    if (!task.sshConfigId) {
      throw new Error('SSH config ID is required for SSH execution');
    }
    
    const sshStore = useSshStore();
    const runConfigStore = useRunConfigStore();
    const notificationStore = useNotificationStore();
    
    // Ensure SSH store is initialized
    await sshStore.initialize();
    
    // Get SSH config
    const sshConfig = sshStore.getConfig(task.sshConfigId);
    if (!sshConfig) {
      throw new Error(`SSH config not found: ${task.sshConfigId}`);
    }
    
    // Check connection status and connect if needed
    const status = sshStore.getConnectionStatus(task.sshConfigId);
    if (!status || (status.status !== 'connected' && status.status !== 'agent_ready')) {
      console.log(`[TaskManager] Connecting to SSH ${task.sshConfigId}...`);
      try {
        await sshStore.connect(task.sshConfigId);
        
        // Test agent after connecting
        const agentReady = await sshStore.testAgent(task.sshConfigId);
        if (!agentReady) {
          notificationStore.addWarning(
            'SSH Agent Not Ready',
            `SSH connection established but agent is not ready. Task may fail.`,
            'frontend'
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        notificationStore.addError(
          'SSH Connection Failed',
          `Failed to connect to SSH server: ${errorMessage}`,
          'frontend'
        );
        throw error;
      }
    }
    
    const cwd = options?.cwd || task.cwd;
    const env = options?.env ? { ...task.env, ...options.env } : task.env;
    
    // Build command and args
    let command: string;
    let args: string[];
    
    const hasArgs = task.args && task.args.length > 0;
    const commandHasSpaces = task.command && task.command.includes(' ');
    
    // Similar logic to local execution for determining command/args
    const needsShellExecution = (cmdLine: string): boolean => {
      const shellOperators = ['&&', '||', '|', ';', '>', '<', '>>', '<<', '2>', '2>>', '&>', '`', '$('];
      let inSingleQuote = false;
      let inDoubleQuote = false;
      
      for (let i = 0; i < cmdLine.length; i++) {
        const char = cmdLine[i];
        
        if (char === "'" && !inDoubleQuote) {
          inSingleQuote = !inSingleQuote;
          continue;
        }
        
        if (char === '"' && !inSingleQuote) {
          inDoubleQuote = !inDoubleQuote;
          continue;
        }
        
        if (!inSingleQuote && !inDoubleQuote) {
          for (const op of shellOperators) {
            if (cmdLine.slice(i, i + op.length) === op) {
              return true;
            }
          }
        }
      }
      
      const shellCommands = ['sudo', 'nohup', 'time', 'nice', 'env'];
      const firstToken = cmdLine.trim().split(/\s+/)[0];
      if (shellCommands.includes(firstToken)) {
        return true;
      }
      
      return false;
    };
    
    const shouldUseShellExecution = task.source === 'user' || task.source === 'npm';
    
    if (shouldUseShellExecution && commandHasSpaces) {
      const isWindows = navigator.platform.toLowerCase().includes('win');
      if (isWindows) {
        command = task.shellPath ?? 'cmd';
        args = ['/c', task.command ?? ''];
      } else {
        command = task.shellPath ?? 'sh';
        args = ['-c', task.command ?? ''];
      }
    } else if (commandHasSpaces && !hasArgs) {
      if (needsShellExecution(task.command ?? '')) {
        const isWindows = navigator.platform.toLowerCase().includes('win');
        if (isWindows) {
          command = task.shellPath ?? 'cmd';
          args = ['/c', task.command ?? ''];
        } else {
          command = task.shellPath ?? 'sh';
          args = ['-c', task.command ?? ''];
        }
      } else {
        const parsed = parseCommandLine(task.command ?? '');
        command = parsed.command;
        args = parsed.args;
      }
    } else {
      command = task.command ?? '';
      args = task.args || [];
    }
    
    // Create history record
    const historyRecord = await runConfigStore.addHistory({
      configId: task.id,
      name: task.name,
      command: `[SSH:${sshConfig.name}] ${command} ${args.join(' ')}`,
      status: 'running',
      timestamp: new Date(),
      startTime: Date.now(),
    });
    
    try {
      // Execute via SSH using config ID
      const execId = await safeInvoke<string>('execute_ssh_command_by_id', {
        config_id: task.sshConfigId,
        task_id: task.id,
        command,
        args: args.length > 0 ? args : undefined,
        cwd,
        env: env && Object.keys(env).length > 0 ? env : undefined,
      });
      
      if (!execId) {
        throw new Error('Failed to start SSH execution');
      }
      
      console.log(`[TaskManager] SSH execution started with id: ${execId}`);
      
      // Track this task as running
      runningTasks.value.set(task.id, execId);
      
      // Update task run statistics
      await updateTaskRunStats(task.id);
      
      // Update history with SSH execution ID
      const index = runConfigStore.history.findIndex(h => h.id === historyRecord.id);
      if (index !== -1) {
        runConfigStore.history[index] = {
          ...runConfigStore.history[index],
          ptyId: execId,
        };
        await runConfigStore.saveHistory();
      }
      
      console.log(`[TaskManager] SSH task started: ${task.name}, execId: ${execId}`);
    } catch (error) {
      // Update history to error status if execution failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      await runConfigStore.updateHistory(historyRecord.id, {
        status: 'error',
        output: `Failed to start SSH task: ${errorMessage}`,
      });
      
      // Add notification for task execution failure
      notificationStore.addError(
        'SSH Task execution failed',
        `Task: ${task.name}\n${errorMessage}`,
        'frontend'
      );
      
      throw error;
    }
  }

  /**
   * Stop a running task
   */
  async function stopTask(taskId: string): Promise<void> {
    const terminalStore = useTerminalStore();
    const tabId = runningTasks.value.get(taskId);
    
    if (tabId) {
      try {
        await terminalStore.stopTask(tabId);
      } catch (error) {
        console.error('[TaskManager] Failed to stop task:', error);
      }
      runningTasks.value.delete(taskId);
    }
  }
  
  /**
   * Update running tasks when a tab exits
   */
  function onTaskExit(tabId: string): void {
    // Find and remove the task from runningTasks
    for (const [taskId, tid] of runningTasks.value.entries()) {
      if (tid === tabId) {
        runningTasks.value.delete(taskId);
        break;
      }
    }
  }
  
  /**
   * Update running tasks when a task starts (used for restart scenario)
   */
  function onTaskStart(taskId: string, tabId: string): void {
    runningTasks.value.set(taskId, tabId);
    console.log('[TaskManager] Task started/restarted:', taskId, 'tabId:', tabId);
  }
  
  /**
   * Execute task in system terminal
   */
  async function executeInSystemTerminal(task: Task, cwd?: string): Promise<void> {
    // Guard: Can only execute tasks with commands in system terminal
    if (!task.command) {
      console.error('[TaskManager] Cannot execute macro task in system terminal:', task.name);
      return;
    }
    
    // Build the full command string
    const fullCommand = task.args && task.args.length > 0 
      ? `${task.command} ${task.args.join(' ')}` 
      : task.command;
    
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        // Check if task has a specific terminal set
        const taskTerminalId = (task as any).systemTerminalId;
        
        // Get the preferred terminal from settings as fallback
        const settingsStore = useSettingsStore();
        const preferredTerminal = taskTerminalId || settingsStore.settings.preferredTerminal;
        
        if (preferredTerminal) {
          // Verify the preferred terminal is still available
          try {
            const availableTerminals = await adapterInstance.system.getAvailableTerminals();
            const terminalExists = availableTerminals.some(t => t.id === preferredTerminal);
            
            if (terminalExists) {
              // Use the specific terminal
              await adapterInstance.system.openInSpecificTerminal(preferredTerminal, fullCommand, cwd || undefined);
            } else {
              // Preferred terminal no longer available, clear preference and use default
              console.warn(`[TaskManager] Preferred terminal '${preferredTerminal}' not found, using default`);
              settingsStore.settings.preferredTerminal = null;
              await settingsStore.saveSettings();
              await adapterInstance.system.openInSystemTerminal(fullCommand, cwd || undefined);
            }
          } catch (error) {
            // If we can't check availability, try the preferred terminal anyway as fallback
            console.warn('[TaskManager] Could not verify terminal availability, trying preferred terminal anyway:', error);
            await adapterInstance.system.openInSpecificTerminal(preferredTerminal, fullCommand, cwd || undefined);
          }
        } else {
          // Use the default system terminal
          await adapterInstance.system.openInSystemTerminal(fullCommand, cwd || undefined);
        }
      }
      console.log(`[TaskManager] Task opened in system terminal: ${task.name}`);
    } catch (error) {
      console.error('[TaskManager] Failed to open in system terminal:', error);
      throw error;
    }
  }
  
  /**
   * Run the default build task
   */
  async function runBuildTask(): Promise<void> {
    const defaultBuild = buildTasks.value.find(t => t.isDefault);
    const buildTask = defaultBuild || buildTasks.value[0];
    
    if (buildTask) {
      await executeTask(buildTask);
    } else {
      console.warn('[TaskManager] No build task found');
    }
  }
  
  /**
   * Run the default test task
   */
  async function runTestTask(): Promise<void> {
    const defaultTest = testTasks.value.find(t => t.isDefault);
    const testTask = defaultTest || testTasks.value[0];
    
    if (testTask) {
      await executeTask(testTask);
    } else {
      console.warn('[TaskManager] No test task found');
    }
  }
  
  /**
   * Check if a file change should trigger a rescan
   */
  function shouldRescan(filePath: string): boolean {
    return providers.value.some(p => p.shouldRescan?.(filePath));
  }
  
  /**
   * Add a user-defined task
   */
  async function addUserTask(
    folderPath: string, 
    taskData: Partial<Task>
  ): Promise<Task | null> {
    // Use VSCode tasks provider to create the task
    try {
      const task = await vscodeTasksProvider.createTask(folderPath, taskData);
      
      // Refresh to pick up the new task
      await refresh();
      
      return task;
    } catch (error) {
      console.error('[TaskManager] Failed to add user task:', error);
      errors.value.push(`Failed to add task: ${String(error)}`);
      return null;
    }
  }
  
  /**
   * Delete a task
   */
  async function deleteTask(task: Task): Promise<boolean> {
    const provider = providers.value.find(p => p.source === task.source);
    
    if (!provider?.deleteTask) {
      console.warn('[TaskManager] Provider does not support task deletion');
      return false;
    }
    
    try {
      await provider.deleteTask(task);
      await refresh();
      return true;
    } catch (error) {
      console.error('[TaskManager] Failed to delete task:', error);
      errors.value.push(`Failed to delete task: ${String(error)}`);
      return false;
    }
  }
  
  return {
    // State
    providers,
    folders,
    allTasks,
    userGroups,
    isScanning,
    lastScanTime,
    errors,
    scanRecursively,
    initialized,
    favoriteTaskIds,
    runningTasks,
    recentSortMode,
    
    // Computed
    tasksBySource,
    tasksByFolder,
    buildTasks,
    testTasks,
    treeItems,
    userGroupTreeItems,
    favoriteTasks,
    recentTasks,
    recentTasksWithTimestamp,
    regularTasks,
    allUserTasks,
    combinedTasks,
    
    // Methods
    initialize,
    registerProvider,
    unregisterProvider,
    scanFolder,
    scanFolders,
    addFolder,
    removeFolder,
    refresh,
    clear,
    findTask,
    executeTask,
    stopTask,
    isTaskRunning,
    getTaskTabId,
    onTaskExit,
    onTaskStart,
    runBuildTask,
    runTestTask,
    shouldRescan,
    addUserTask,
    deleteTask,
    toggleFavorite,
    isFavorite,
    reorderFavorites,
    toggleRecentSortMode,
    // User group methods
    createUserGroup,
    renameUserGroup,
    deleteUserGroup,
    addTaskToGroup,
    updateTaskInGroup,
    removeTaskFromGroup,
    moveTaskToGroup,
    importTasksToGroup,
    importTasksToGroupWithOverwrite,
    scanFolderForTasks,
    exportUserGroups,
    importUserGroups,
  };
});

// ============================================
// Helper functions
// ============================================

function getSourceLabel(source: TaskSource): string {
  switch (source) {
    case 'vscode':
      return 'VSCode Tasks';
    case 'npm':
      return 'npm Scripts';
    case 'user':
      return 'User Tasks';
    case 'workspace':
      return 'Workspace Tasks';
    case 'script':
      return 'Script Files';
    default:
      return source;
  }
}

function getSourceIcon(source: TaskSource): string {
  switch (source) {
    case 'vscode':
      return 'vscode';
    case 'npm':
      return 'npm';
    case 'user':
      return 'user';
    case 'workspace':
      return 'folder';
    case 'script':
      return 'script';
    default:
      return 'task';
  }
}

function getTaskIcon(task: Task): string {
  switch (task.group) {
    case 'build':
      return 'build';
    case 'test':
      return 'test';
    case 'clean':
      return 'clean';
    default:
      return 'task';
  }
}
