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
import { invoke } from '@tauri-apps/api/core';
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
import { useTerminalStore } from './terminal';
import { useRunConfigStore } from './runConfig';
import { useSettingsStore } from './settings';

// Store instance for persistence
let store: any = null;

// Initialize Tauri store
const initStore = async () => {
  if (!store) {
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      store = await Store.load('rebebuca-config.json');
    } catch (error) {
      console.warn('[TaskManager] Failed to initialize Tauri store:', error);
      return null;
    }
  }
  return store;
};

// User task group interface
export interface UserTaskGroup {
  id: string;
  name: string;
  tasks: Task[];
}

// Default group ID
const DEFAULT_GROUP_ID = 'default';
const DEFAULT_GROUP_NAME = 'Default';

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
  ]);
  
  // Currently scanned folders
  const folders = ref<TaskFolder[]>([]);
  
  // User-defined task groups (stored in app config)
  const userGroups = ref<UserTaskGroup[]>([
    { id: DEFAULT_GROUP_ID, name: DEFAULT_GROUP_NAME, tasks: [] }
  ]);
  
  // All tasks (flat list) - from folders only
  const allTasks = ref<Task[]>([]);
  
  // Favorite task IDs
  const favoriteTaskIds = ref<Set<string>>(new Set());
  
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
  
  // Favorite tasks
  const favoriteTasks = computed(() => 
    combinedTasks.value.filter(t => favoriteTaskIds.value.has(t.id))
  );
  
  // Non-favorite tasks
  const regularTasks = computed(() => 
    combinedTasks.value.filter(t => !favoriteTaskIds.value.has(t.id))
  );
  
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
      };
      
      // Group tasks by source
      for (const [source, tasks] of folder.tasksBySource) {
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
      
      if (folderItem.children && folderItem.children.length > 0) {
        items.push(folderItem);
      }
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
        folderErrors.push(`${provider.name}: ${String(error)}`);
      }
    }
    
    if (folderErrors.length > 0) {
      errors.value.push(...folderErrors);
    }
    
    // Extract folder name
    const parts = folderPath.split(/[/\\]/);
    const name = parts[parts.length - 1] || folderPath;
    
    return {
      path: folderPath,
      name,
      tasksBySource,
    };
  }
  
  /**
   * Save folder paths to persistent storage
   */
  async function saveFolderPaths(): Promise<void> {
    try {
      const storeInstance = await initStore();
      if (storeInstance) {
        const paths = folders.value.map(f => f.path);
        await storeInstance.set('taskFolders', paths);
        await storeInstance.save();
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
      const storeInstance = await initStore();
      if (storeInstance) {
        const paths = await storeInstance.get('taskFolders');
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
      const storeInstance = await initStore();
      if (storeInstance) {
        const ids = Array.from(favoriteTaskIds.value);
        await storeInstance.set('favoriteTasks', ids);
        await storeInstance.save();
        console.log('[TaskManager] Saved favorites:', ids);
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
      const storeInstance = await initStore();
      if (storeInstance) {
        const ids = await storeInstance.get('favoriteTasks');
        if (ids && Array.isArray(ids)) {
          favoriteTaskIds.value = new Set(ids);
          console.log('[TaskManager] Loaded favorites:', ids);
        }
      }
    } catch (error) {
      console.error('[TaskManager] Failed to load favorites:', error);
    }
  }
  
  /**
   * Toggle task favorite status
   */
  async function toggleFavorite(taskId: string): Promise<void> {
    if (favoriteTaskIds.value.has(taskId)) {
      favoriteTaskIds.value.delete(taskId);
    } else {
      favoriteTaskIds.value.add(taskId);
    }
    // Trigger reactivity
    favoriteTaskIds.value = new Set(favoriteTaskIds.value);
    await saveFavorites();
  }
  
  /**
   * Check if a task is favorite
   */
  function isFavorite(taskId: string): boolean {
    return favoriteTaskIds.value.has(taskId);
  }
  
  /**
   * Save user groups to persistent storage
   */
  async function saveUserGroups(): Promise<void> {
    try {
      const storeInstance = await initStore();
      if (storeInstance) {
        await storeInstance.set('userGroups', userGroups.value);
        await storeInstance.save();
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
      const storeInstance = await initStore();
      if (storeInstance) {
        const groups = await storeInstance.get('userGroups');
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
   * Initialize - load saved folders and scan them
   */
  async function initialize(): Promise<void> {
    if (initialized.value) return;
    
    initialized.value = true;
    
    // Load favorites first
    await loadFavorites();
    
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
   * Execute a task
   * If the task is currently running, it will be restarted (stop + start in same context)
   * If the task is not running, a new terminal tab will be created
   */
  async function executeTask(task: Task, options?: TaskExecutionOptions): Promise<void> {
    const terminalStore = useTerminalStore();
    const runConfigStore = useRunConfigStore();
    await terminalStore.initListeners();
    
    const cwd = options?.cwd || task.cwd;
    const env = options?.env ? { ...task.env, ...options.env } : task.env;
    const label = options?.label || task.name;
    
    // Check if task should be executed in system terminal
    if (task.useSystemTerminal) {
      await executeInSystemTerminal(task, cwd);
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
    const commandHasSpaces = task.command.includes(' ');
    
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
    
    if (task.type === 'shell' && commandHasSpaces && !hasArgs && needsShellExecution(task.command)) {
      // Execute via shell for commands with shell operators or sudo
      // On macOS/Linux use sh -c, on Windows use cmd /c
      const isWindows = navigator.platform.toLowerCase().includes('win');
      if (isWindows) {
        command = 'cmd';
        args = ['/c', task.command];
      } else {
        command = 'sh';
        args = ['-c', task.command];
      }
    } else {
      command = task.command;
      args = task.args || [];
    }
    
    // Build the full command string for display
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
    
    // Create history record first
    const historyRecord = await runConfigStore.addHistory({
      configId: task.id,
      name: task.name,
      command: fullCommand,
      status: 'running',
      timestamp: new Date(),
      startTime: Date.now(),
    });
    
    try {
      // Generate log path if saveLogs is enabled
      let logPath: string | undefined;
      let logFilename: string | undefined;
      const settingsStore = useSettingsStore();
      
      if (settingsStore.settings.saveLogs) {
        try {
          const logInfo = await invoke<{ log_filename: string; log_path: string }>('generate_log_path');
          logPath = logInfo.log_path;
          logFilename = logInfo.log_filename;
          console.log('[TaskManager] Generated log path:', logPath);
        } catch (error) {
          console.error('[TaskManager] Failed to generate log path:', error);
        }
      }
      
      const tab = await terminalStore.executeTask({
        command,
        args,
        cwd,
        env,
        taskId: task.id,
        historyId: historyRecord.id,
        label,
        logPath,
      });
      
      // Track this task as running
      runningTasks.value.set(task.id, tab.id);
      
      // Update history with PTY ID, terminal tab ID, and log filename
      await runConfigStore.updateHistory(historyRecord.id, {
        ptyId: tab.ptyId,
        terminalTabId: tab.id,
        logFilename,
      });
      
      console.log(`[TaskManager] Task started: ${task.name}, historyId: ${historyRecord.id}`);
    } catch (error) {
      // Update history to error status if execution failed
      await runConfigStore.updateHistory(historyRecord.id, {
        status: 'error',
        output: `Failed to start task: ${error}`,
      });
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
   * Execute task in system terminal
   */
  async function executeInSystemTerminal(task: Task, cwd?: string): Promise<void> {
    // Build the full command string
    const fullCommand = task.args && task.args.length > 0 
      ? `${task.command} ${task.args.join(' ')}` 
      : task.command;
    
    try {
      await invoke('open_in_system_terminal', {
        command: fullCommand,
        cwd: cwd || null,
      });
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
    
    // Computed
    tasksBySource,
    tasksByFolder,
    buildTasks,
    testTasks,
    treeItems,
    userGroupTreeItems,
    favoriteTasks,
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
    runBuildTask,
    runTestTask,
    shouldRescan,
    addUserTask,
    deleteTask,
    toggleFavorite,
    isFavorite,
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
