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

import JSON5 from 'json5';
import { getAdapter, type FileSystemAdapter, type SystemAdapter } from '../adapters';
import { 
  TaskProvider, 
  Task, 
  ScanResult, 
  TaskGroup,
  TaskType,
  VSCodeTasksJson,
  VSCodeTask,
} from './types';

function pathJoin(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
}

function pathBasename(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || '';
}

/**
 * Provider for VSCode tasks.json files
 * 
 * Scans for .vscode/tasks.json files and parses them into tasks
 */
export class VSCodeTasksProvider implements TaskProvider {
  readonly id = 'vscode-tasks';
  readonly name = 'VSCode Tasks';
  readonly source = 'vscode' as const;
  readonly icon = 'vscode';
  
  private currentPlatform: string | null = null;
  private fsAdapter: FileSystemAdapter | null = null;
  private systemAdapter: SystemAdapter | null = null;
  
  /**
   * Get file system adapter
   */
  private async getFs(): Promise<FileSystemAdapter> {
    if (!this.fsAdapter) {
      const adapter = await getAdapter();
      this.fsAdapter = adapter.fs;
    }
    return this.fsAdapter;
  }
  
  /**
   * Get system adapter
   */
  private async getSystem(): Promise<SystemAdapter> {
    if (!this.systemAdapter) {
      const adapter = await getAdapter();
      this.systemAdapter = adapter.system;
    }
    return this.systemAdapter;
  }
  
  /**
   * Get current platform for platform-specific task properties
   */
  private async getPlatform(): Promise<string> {
    if (!this.currentPlatform) {
      const system = await this.getSystem();
      const os = await system.getPlatform();
      if (os === 'windows') {
        this.currentPlatform = 'windows';
      } else if (os === 'linux') {
        this.currentPlatform = 'linux';
      } else {
        this.currentPlatform = 'osx';
      }
    }
    return this.currentPlatform;
  }
  
  /**
   * Scan a folder for tasks.json files
   */
  async scan(folderPath: string, recursive = false): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    
    if (recursive) {
      // Recursively scan for .vscode/tasks.json files
      await this.scanRecursive(folderPath, results, 0, 5); // Max depth of 5
    } else {
      // Just check the immediate .vscode folder
      const result = await this.scanFolder(folderPath);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }
  
  /**
   * Scan a single folder for .vscode/tasks.json
   */
  private async scanFolder(folderPath: string): Promise<ScanResult | null> {
    try {
      const fs = await this.getFs();
      const tasksJsonPath = pathJoin(folderPath, '.vscode', 'tasks.json');
      console.log(`[VSCodeTasksProvider] Checking: ${tasksJsonPath}`);
      
      const exists = await fs.exists(tasksJsonPath);
      console.log(`[VSCodeTasksProvider] Exists: ${exists}`);
      
      if (exists) {
        const content = await fs.readTextFile(tasksJsonPath);
        console.log(`[VSCodeTasksProvider] Read content, length: ${content.length}`);
        const tasks = await this.parseTasksJson(content, folderPath, tasksJsonPath);
        console.log(`[VSCodeTasksProvider] Parsed ${tasks.length} tasks`);
        
        return {
          path: folderPath,
          tasks,
          sourceFile: tasksJsonPath,
        };
      }
    } catch (error) {
      console.warn(`[VSCodeTasksProvider] Error scanning ${folderPath}:`, error);
      return {
        path: folderPath,
        tasks: [],
        errors: [String(error)],
      };
    }
    
    return null;
  }
  
  /**
   * Recursively scan directories for tasks.json files
   */
  private async scanRecursive(
    folderPath: string, 
    results: ScanResult[], 
    depth: number,
    maxDepth: number
  ): Promise<void> {
    if (depth > maxDepth) return;
    
    // Check current folder
    const result = await this.scanFolder(folderPath);
    if (result && (result.tasks.length > 0 || (result.errors && result.errors.length > 0))) {
      results.push(result);
    }
    
    // Skip common non-project directories
    const skipDirs = new Set([
      'node_modules',
      '.git',
      '.svn',
      'dist',
      'build',
      'out',
      '.next',
      '.nuxt',
      'target',
      'vendor',
      '__pycache__',
      '.venv',
      'venv',
    ]);
    
    try {
      const fs = await this.getFs();
      const entries = await fs.readDir(folderPath);
      
      for (const entry of entries) {
        if (entry.isDirectory && entry.name && !skipDirs.has(entry.name) && !entry.name.startsWith('.')) {
          const subPath = pathJoin(folderPath, entry.name);
          await this.scanRecursive(subPath, results, depth + 1, maxDepth);
        }
      }
    } catch (error) {
      // Ignore errors reading directories (permission issues, etc.)
      console.debug(`[VSCodeTasksProvider] Could not read directory ${folderPath}:`, error);
    }
  }
  
  /**
   * Parse tasks.json content into Task objects
   */
  private async parseTasksJson(
    content: string, 
    folderPath: string, 
    sourceFile: string
  ): Promise<Task[]> {
    try {
      // Parse JSON5 (supports comments and trailing commas like VSCode JSONC)
      const tasksJson = JSON5.parse(content) as VSCodeTasksJson;
      
      if (!tasksJson.tasks || !Array.isArray(tasksJson.tasks)) {
        return [];
      }
      
      const currentPlatform = await this.getPlatform();
      const tasks: Task[] = [];
      
      for (const vscodeTask of tasksJson.tasks) {
        const task = await this.convertTask(vscodeTask, folderPath, sourceFile, currentPlatform);
        if (task) {
          tasks.push(task);
        }
      }
      
      return tasks;
    } catch (error) {
      console.error(`[VSCodeTasksProvider] Error parsing tasks.json:`, error);
      return [];
    }
  }
  
  /**
   * Convert a VSCode task to our Task format
   */
  private async convertTask(
    vscodeTask: VSCodeTask,
    folderPath: string,
    sourceFile: string,
    currentPlatform: string
  ): Promise<Task | null> {
    // Apply platform-specific overrides
    let task = { ...vscodeTask };
    const platformOverride = task[currentPlatform as keyof VSCodeTask] as Partial<VSCodeTask> | undefined;
    if (platformOverride) {
      task = { ...task, ...platformOverride };
    }
    
    // Get command and args based on task type
    let command: string = '';
    let args: string[] = [];
    let isMacroTask = false;
    
    // Check if this is a compound/macro task (has dependsOn but no command)
    if (task.dependsOn && !task.command && task.type !== TaskType.NPM) {
      // This is a macro task that orchestrates other tasks
      isMacroTask = true;
      command = ''; // Macro tasks don't have a command
    } else if (task.type === TaskType.NPM && task.script) {
      // npm type task
      command = 'npm';
      args = ['run', task.script];
    } else if (task.type === TaskType.SHELL || task.type === TaskType.PROCESS || task.command) {
      const rawCommand = task.command || '';
      const rawArgs = task.args || [];
      
      // If args are provided, use them directly
      if (rawArgs.length > 0) {
        command = rawCommand;
        args = rawArgs;
      } else if (rawCommand.includes(' ')) {
        // Check if command needs shell execution (has shell operators like &&, ||, |, sudo, etc.)
        if (this.needsShellExecution(rawCommand)) {
          // Keep command as-is, it will be executed via shell (sh -c) in taskManager
          command = rawCommand;
          args = [];
        } else {
          // Parse command string that contains spaces
          // Handle quoted arguments properly
          const parsed = this.parseCommandLine(rawCommand);
          command = parsed.command;
          args = parsed.args;
        }
      } else {
        command = rawCommand;
        args = [];
      }
    } else {
      // No command and not a macro task, skip this task
      return null;
    }
    
    if (!command && !isMacroTask) {
      return null;
    }
    
    // Parse group
    let group: TaskGroup = 'none';
    let isDefault = false;
    if (task.group) {
      if (typeof task.group === 'string') {
        group = this.parseGroup(task.group);
      } else if (typeof task.group === 'object') {
        group = this.parseGroup(task.group.kind);
        isDefault = task.group.isDefault === true;
      }
    }
    
    // Parse depends on and execution mode
    let dependsOn: string[] | undefined;
    let executionMode: 'parallel' | 'serial' | undefined;
    let subTasks: string[] | undefined;
    
    if (task.dependsOn) {
      if (typeof task.dependsOn === 'object' && !Array.isArray(task.dependsOn)) {
        // New format with order specification - validate structure
        const depObj = task.dependsOn as any;
        if (depObj && typeof depObj === 'object' && Array.isArray(depObj.tasks)) {
          if (depObj.order === 'parallel') {
            executionMode = 'parallel';
            subTasks = depObj.tasks;
          } else {
            // Default to serial execution
            executionMode = 'serial';
            dependsOn = depObj.tasks;
          }
        } else {
          console.warn(`[VSCodeTasksProvider] Invalid dependsOn object format for task: ${task.label}`);
        }
      } else {
        // Legacy format: array or string (always serial)
        dependsOn = Array.isArray(task.dependsOn) ? task.dependsOn : [task.dependsOn];
        executionMode = 'serial';
      }
    }
    
    // Build working directory
    let cwd = folderPath;
    if (task.options?.cwd) {
      if (task.options.cwd.startsWith('/') || task.options.cwd.match(/^[A-Za-z]:/)) {
        cwd = task.options.cwd;
      } else {
        cwd = pathJoin(folderPath, task.options.cwd);
      }
    }
    
    return {
      id: `vscode:${pathBasename(folderPath)}:${task.label}`,
      name: task.label,
      source: 'vscode',
      sourceFile,
      group,
      command,
      args,
      cwd,
      env: task.options?.env,
      type: isMacroTask ? TaskType.MACRO : (task.type ? (task.type as TaskType) : TaskType.SHELL),
      dependsOn,
      executionMode,
      subTasks,
      problemMatcher: task.problemMatcher 
        ? (Array.isArray(task.problemMatcher) ? task.problemMatcher : [task.problemMatcher])
        : undefined,
      presentation: task.presentation,
      definition: vscodeTask,
      isDefault,
    };
  }
  
  /**
   * Parse group string to TaskGroup
   */
  private parseGroup(group: string): TaskGroup {
    switch (group) {
      case 'build':
        return 'build';
      case 'test':
        return 'test';
      case 'clean':
        return 'clean';
      default:
        return 'none';
    }
  }
  
  /**
   * Check if a command requires shell execution
   * Commands with shell operators (&&, ||, |, ;, >, <) or sudo need shell
   */
  private needsShellExecution(cmdLine: string): boolean {
    // Shell operators that require shell execution
    const shellOperators = ['&&', '||', '|', ';', '>', '<', '>>', '<<', '2>', '2>>', '&>', '`', '$(' ];
    
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
  }
  
  /**
   * Parse a command line string into command and arguments
   * Handles quoted arguments properly
   */
  private parseCommandLine(cmdLine: string): { command: string; args: string[] } {
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
  
  /**
   * Check if a file change should trigger a rescan
   */
  shouldRescan(filePath: string): boolean {
    return filePath.endsWith('tasks.json') && filePath.includes('.vscode');
  }
  
  /**
   * Create a new task in tasks.json
   */
  async createTask(folderPath: string, taskData: Partial<Task>): Promise<Task> {
    const fs = await this.getFs();
    const tasksJsonPath = pathJoin(folderPath, '.vscode', 'tasks.json');
    let tasksJson: VSCodeTasksJson;
    
    // Read existing or create new
    if (await fs.exists(tasksJsonPath)) {
      const content = await fs.readTextFile(tasksJsonPath);
      tasksJson = JSON5.parse(content);
    } else {
      tasksJson = {
        version: '2.0.0',
        tasks: [],
      };
    }
    
    // Create VSCode task
    const vscodeTask: VSCodeTask = {
      label: taskData.name || 'New Task',
      type: taskData.type || 'shell',
      command: taskData.command,
      args: taskData.args,
      group: taskData.group,
      options: {
        cwd: taskData.cwd,
        env: taskData.env,
      },
    };
    
    // Add to tasks array
    tasksJson.tasks.push(vscodeTask);
    
    // Write back
    const vscodeDir = pathJoin(folderPath, '.vscode');
    if (!(await fs.exists(vscodeDir))) {
      await fs.mkdir(vscodeDir);
    }
    await fs.writeTextFile(tasksJsonPath, JSON.stringify(tasksJson, null, 2));
    
    // Return the created task
    const platform = await this.getPlatform();
    const task = await this.convertTask(vscodeTask, folderPath, tasksJsonPath, platform);
    if (!task) {
      throw new Error('Failed to create task');
    }
    
    return task;
  }
  
  /**
   * Update an existing task in tasks.json
   */
  async updateTask(task: Task): Promise<Task> {
    if (!task.sourceFile) {
      throw new Error('Cannot update task without source file');
    }
    
    const fs = await this.getFs();
    const content = await fs.readTextFile(task.sourceFile);
    const tasksJson = JSON5.parse(content) as VSCodeTasksJson;
    
    // Find the task by label
    const index = tasksJson.tasks.findIndex(t => t.label === task.definition?.label);
    if (index === -1) {
      throw new Error('Task not found in tasks.json');
    }
    
    // Update the task
    tasksJson.tasks[index] = {
      ...tasksJson.tasks[index],
      label: task.name,
      command: task.command,
      args: task.args,
      group: task.group,
      options: {
        cwd: task.cwd,
        env: task.env,
      },
    };
    
    // Write back
    await fs.writeTextFile(task.sourceFile, JSON.stringify(tasksJson, null, 2));
    
    return task;
  }
  
  /**
   * Delete a task from tasks.json
   */
  async deleteTask(task: Task): Promise<void> {
    if (!task.sourceFile) {
      throw new Error('Cannot delete task without source file');
    }
    
    const fs = await this.getFs();
    const content = await fs.readTextFile(task.sourceFile);
    const tasksJson = JSON5.parse(content) as VSCodeTasksJson;
    
    // Find and remove the task
    const index = tasksJson.tasks.findIndex(t => t.label === task.definition?.label);
    if (index !== -1) {
      tasksJson.tasks.splice(index, 1);
      
      // Write back
      await fs.writeTextFile(task.sourceFile, JSON.stringify(tasksJson, null, 2));
    }
  }
}

// Export singleton instance
export const vscodeTasksProvider = new VSCodeTasksProvider();
