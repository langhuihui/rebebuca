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

/**
 * Task Provider Types
 * 
 * These types define the structure for task providers that scan
 * workspaces for tasks from various sources (tasks.json, package.json, etc.)
 */

// Task source types
export type TaskSource =
  | 'vscode'      // .vscode/tasks.json
  | 'npm'         // package.json scripts
  | 'user'        // User-defined tasks (stored in app config)
  | 'workspace'   // Workspace-specific tasks
  | 'script';     // Executable script files (.sh, .bat, .ps1, .py, etc.)

// Task group types (similar to VSCode)
export type TaskGroup =
  | 'build'
  | 'test'
  | 'clean'
  | 'none';

// Task execution types
export enum TaskType {
  SHELL = 'shell',        // Shell command execution (default)
  PROCESS = 'process',    // Direct process execution
  NPM = 'npm',           // npm script execution
  MACRO = 'macro',       // Macro task (orchestrates other tasks)
  FFMPEG = 'ffmpeg',    // FFmpeg encoding task
}

/**
 * Represents a task that can be executed
 */
export interface Task {
  // Unique identifier for the task
  id: string;

  // Display name
  name: string;

  // Source of the task
  source: TaskSource;

  // Source file path (e.g., path to tasks.json or package.json)
  sourceFile?: string;

  // Task group
  group?: TaskGroup;

  // Command to execute (required for simple tasks, optional for macro tasks)
  command?: string;

  // Command arguments
  args?: string[];

  // Working directory (absolute path)
  cwd?: string;

  // Environment variables
  env?: Record<string, string>;

  // Task type
  type?: TaskType;

  // Whether to use system terminal to run the task
  useSystemTerminal?: boolean;

  // Specific system terminal ID to use (overrides global preference)
  systemTerminalId?: string | null;

  // Specific shell path to use for built-in terminal (overrides global preference)
  shellPath?: string | null;

  // Whether this task depends on other tasks (for serial execution)
  dependsOn?: string[];

  // Execution mode for macro tasks
  executionMode?: 'parallel' | 'serial';

  // Sub-task IDs for macro tasks running in parallel
  // When executionMode is 'parallel', these tasks run simultaneously
  // When executionMode is 'serial' or undefined, use dependsOn instead
  subTasks?: string[];

  // Problem matchers for parsing output
  problemMatcher?: string[];

  // Task presentation options
  presentation?: TaskPresentation;

  // Original task definition (from tasks.json or package.json)
  definition?: Record<string, any>;

  // Is this a default build/test task
  isDefault?: boolean;

  // Python environment (Conda/Anaconda environment name)
  pythonEnv?: string;

  // Run with administrator privileges (Windows)
  runAsAdmin?: boolean;

  // AI tool configuration
  aiTool?: string;  // AI tool type (e.g., 'claude-code', 'codex', etc.)

  // SSH remote execution
  sshConfigId?: string | null;  // ID of saved SSH configuration
}

/**
 * Task presentation options
 */
export interface TaskPresentation {
  reveal?: 'always' | 'silent' | 'never';
  echo?: boolean;
  focus?: boolean;
  panel?: 'shared' | 'dedicated' | 'new';
  showReuseMessage?: boolean;
  clear?: boolean;
}

/**
 * Represents a folder/workspace that contains tasks
 */
export interface TaskFolder {
  // Folder path
  path: string;

  // Display name
  name: string;

  // Tasks in this folder, grouped by source
  tasksBySource: Map<TaskSource, Task[]>;

  // Error state
  hasError?: boolean;
  errorMessage?: string;
}

/**
 * A tree item for displaying in the task explorer
 */
export interface TaskTreeItem {
  id: string;
  label: string;
  type: 'folder' | 'subfolder' | 'source' | 'task' | 'group';
  children?: TaskTreeItem[];
  task?: Task;
  icon?: string;
  expanded?: boolean;
  // Relative path from root folder (for subfolders)
  relativePath?: string;
  // Error state for folder items
  hasError?: boolean;
  errorMessage?: string;
}

/**
 * Provider scan result
 */
export interface ScanResult {
  // Path that was scanned
  path: string;

  // Tasks found
  tasks: Task[];

  // Source file (if applicable)
  sourceFile?: string;

  // Any errors that occurred during scanning
  errors?: string[];
}

/**
 * Task Provider interface
 * 
 * Implement this interface to create a new task provider
 */
export interface TaskProvider {
  // Unique identifier for this provider
  readonly id: string;

  // Display name
  readonly name: string;

  // Task source type
  readonly source: TaskSource;

  // Icon for this provider
  readonly icon?: string;

  /**
   * Scan a folder for tasks
   * @param folderPath - Absolute path to the folder to scan
   * @param recursive - Whether to scan subdirectories
   * @returns Promise resolving to scan results
   */
  scan(folderPath: string, recursive?: boolean): Promise<ScanResult[]>;

  /**
   * Check if a file change should trigger a rescan
   * @param filePath - Path to the changed file
   * @returns true if this provider should rescan
   */
  shouldRescan?(filePath: string): boolean;

  /**
   * Create a new task (for providers that support it)
   * @param folderPath - Folder where the task should be created
   * @param task - Task to create
   * @returns Promise resolving to the created task
   */
  createTask?(folderPath: string, task: Partial<Task>): Promise<Task>;

  /**
   * Update an existing task
   * @param task - Task to update
   * @returns Promise resolving to the updated task
   */
  updateTask?(task: Task): Promise<Task>;

  /**
   * Delete a task
   * @param task - Task to delete
   * @returns Promise resolving when deleted
   */
  deleteTask?(task: Task): Promise<void>;
}

/**
 * Event types for task provider changes
 */
export interface TaskProviderEvent {
  type: 'added' | 'updated' | 'removed' | 'refresh';
  provider?: string;
  tasks?: Task[];
  folderPath?: string;
}

/**
 * Task execution options
 */
export interface TaskExecutionOptions {
  // Override working directory
  cwd?: string;

  // Override/merge environment variables
  env?: Record<string, string>;

  // Terminal label override
  label?: string;

  // Don't show terminal
  silent?: boolean;
}

/**
 * VSCode tasks.json structure
 */
export interface VSCodeTasksJson {
  version: string;
  tasks: VSCodeTask[];
  inputs?: any[];
}

export interface VSCodeTask {
  label: string;
  type: string;
  command?: string;
  args?: string[];
  group?: string | { kind: string; isDefault?: boolean; };
  problemMatcher?: string | string[];
  options?: {
    cwd?: string;
    env?: Record<string, string>;
    shell?: {
      executable?: string;
      args?: string[];
    };
  };
  presentation?: TaskPresentation;
  dependsOn?: string | string[] | {
    // Task IDs to depend on
    tasks: string[];
    // Execution order: 'sequence' (serial) or 'parallel'
    order?: 'sequence' | 'parallel';
  };
  windows?: Partial<VSCodeTask>;
  linux?: Partial<VSCodeTask>;
  osx?: Partial<VSCodeTask>;
  // npm type specific
  script?: string;
  path?: string;
}

/**
 * package.json structure (relevant parts)
 */
export interface PackageJson {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
}
