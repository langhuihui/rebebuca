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

import type { RunConfig } from '../stores/runConfig';

/**
 * VSCode Task definition interface
 * Based on https://code.visualstudio.com/docs/editor/tasks
 */
export interface VSCodeTask {
  label: string;
  type: 'shell' | 'process' | string;
  command?: string;
  args?: (string | { value: string; quoting?: string })[];
  options?: {
    cwd?: string;
    env?: Record<string, string>;
    shell?: {
      executable?: string;
      args?: string[];
    };
  };
  windows?: {
    command?: string;
    args?: string[];
    options?: VSCodeTask['options'];
  };
  linux?: {
    command?: string;
    args?: string[];
    options?: VSCodeTask['options'];
  };
  osx?: {
    command?: string;
    args?: string[];
    options?: VSCodeTask['options'];
  };
  // Task grouping
  group?: string | { kind: string; isDefault?: boolean };
  // Presentation options (ignored for our purposes)
  presentation?: any;
  // Problem matcher (ignored for our purposes)
  problemMatcher?: any;
  // Dependencies (ignored for our purposes)
  dependsOn?: string | string[];
  // Run options
  runOptions?: any;
}

export interface VSCodeTasksJson {
  version: string;
  tasks: VSCodeTask[];
  // Global options that apply to all tasks
  options?: {
    cwd?: string;
    env?: Record<string, string>;
  };
  // Input variables (not fully supported, but we can try to handle them)
  inputs?: any[];
}

export interface ParsedTask {
  name: string;
  command: string;
  arguments: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;
}

export interface ParseResult {
  success: boolean;
  tasks: ParsedTask[];
  errors: string[];
  warnings: string[];
}

/**
 * Detect the current platform
 */
const getCurrentPlatform = (): 'windows' | 'linux' | 'osx' => {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac') || platform.includes('darwin')) return 'osx';
  return 'linux';
};

/**
 * Normalize argument to string
 */
const normalizeArg = (arg: string | { value: string; quoting?: string }): string => {
  if (typeof arg === 'string') return arg;
  return arg.value;
};

/**
 * Remove JSON comments (// and /* *\/) and trailing commas for parsing
 * VSCode's jsonc format supports these but standard JSON doesn't
 */
const removeJsonComments = (jsonString: string): string => {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  
  while (i < jsonString.length) {
    const char = jsonString[i];
    const nextChar = jsonString[i + 1];
    
    // Handle string boundaries
    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      result += char;
      i++;
      continue;
    }
    
    if (inString) {
      result += char;
      // Check for escaped characters
      if (char === '\\' && i + 1 < jsonString.length) {
        result += jsonString[i + 1];
        i += 2;
        continue;
      }
      // Check for end of string
      if (char === stringChar) {
        inString = false;
      }
      i++;
      continue;
    }
    
    // Handle single-line comments
    if (char === '/' && nextChar === '/') {
      // Skip until end of line
      while (i < jsonString.length && jsonString[i] !== '\n') {
        i++;
      }
      continue;
    }
    
    // Handle multi-line comments
    if (char === '/' && nextChar === '*') {
      i += 2;
      while (i < jsonString.length - 1) {
        if (jsonString[i] === '*' && jsonString[i + 1] === '/') {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }
    
    result += char;
    i++;
  }
  
  // Remove trailing commas before } or ]
  result = result.replace(/,(\s*[}\]])/g, '$1');
  
  return result;
};

/**
 * Expand simple VSCode variables
 * Note: Not all variables can be expanded (e.g., ${workspaceFolder} requires context)
 */
const expandVariables = (
  value: string | undefined,
  workspaceFolder?: string
): string | undefined => {
  if (!value) return value;
  
  let result = value;
  
  // Replace ${workspaceFolder} if provided
  if (workspaceFolder) {
    result = result.replace(/\$\{workspaceFolder\}/g, workspaceFolder);
  }
  
  // Replace environment variables like ${env:VAR_NAME}
  result = result.replace(/\$\{env:([^}]+)\}/g, (_, varName) => {
    // We can't actually access env vars in browser, so keep it as placeholder
    return `\${${varName}}`;
  });
  
  // Keep other variables as-is (they will show as placeholders)
  return result;
};

/**
 * Parse a single VSCode task to our format
 */
const parseTask = (
  task: VSCodeTask,
  globalOptions?: VSCodeTasksJson['options'],
  workspaceFolder?: string
): ParsedTask | null => {
  const platform = getCurrentPlatform();
  
  // Get platform-specific overrides
  const platformOverride = task[platform];
  
  // Determine command (platform-specific takes precedence)
  let command = platformOverride?.command || task.command;
  
  // If no command, skip this task
  if (!command) {
    return null;
  }
  
  // Get arguments (platform-specific takes precedence)
  const rawArgs = platformOverride?.args || task.args || [];
  const args = rawArgs.map(normalizeArg);
  
  // Get options (merge global -> task -> platform-specific)
  const taskOptions = platformOverride?.options || task.options || {};
  
  // Determine working directory
  let workingDirectory = taskOptions.cwd || globalOptions?.cwd;
  
  // Merge environment variables
  const environment: Record<string, string> = {
    ...globalOptions?.env,
    ...taskOptions.env,
  };
  
  // Expand variables
  command = expandVariables(command, workspaceFolder) || command;
  workingDirectory = expandVariables(workingDirectory, workspaceFolder);
  
  // Expand variables in arguments
  const expandedArgs = args.map(arg => expandVariables(arg, workspaceFolder) || arg);
  
  // Expand variables in environment
  const expandedEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(environment)) {
    expandedEnv[key] = expandVariables(value, workspaceFolder) || value;
  }
  
  return {
    name: task.label,
    command,
    arguments: expandedArgs,
    workingDirectory,
    environment: Object.keys(expandedEnv).length > 0 ? expandedEnv : undefined,
  };
};

/**
 * Parse VSCode tasks.json content
 */
export const parseVSCodeTasks = (
  jsonContent: string,
  workspaceFolder?: string
): ParseResult => {
  const result: ParseResult = {
    success: false,
    tasks: [],
    errors: [],
    warnings: [],
  };
  
  try {
    // Remove comments before parsing
    const cleanedJson = removeJsonComments(jsonContent);
    
    // Parse JSON
    let tasksJson: VSCodeTasksJson;
    try {
      tasksJson = JSON.parse(cleanedJson);
    } catch (parseError) {
      result.errors.push(`JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      return result;
    }
    
    // Validate structure
    if (!tasksJson.tasks || !Array.isArray(tasksJson.tasks)) {
      result.errors.push('Invalid tasks.json: missing or invalid "tasks" array');
      return result;
    }
    
    // Check version
    if (tasksJson.version !== '2.0.0') {
      result.warnings.push(`tasks.json version is "${tasksJson.version}", expected "2.0.0". Some features may not work correctly.`);
    }
    
    // Parse each task
    for (const task of tasksJson.tasks) {
      // Skip tasks without labels
      if (!task.label) {
        result.warnings.push('Skipping task without label');
        continue;
      }
      
      // For this parser (used by ImportTasksDialog), we still skip compound tasks
      // The main vscodeTasksProvider handles macro tasks differently
      if (task.dependsOn && !task.command) {
        result.warnings.push(`Skipping compound task "${task.label}" (dependsOn without command)`);
        continue;
      }
      
      const parsed = parseTask(task, tasksJson.options, workspaceFolder);
      
      if (parsed) {
        result.tasks.push(parsed);
      } else {
        result.warnings.push(`Skipping task "${task.label}" (no command found)`);
      }
    }
    
    if (result.tasks.length > 0) {
      result.success = true;
    } else {
      result.errors.push('No valid tasks found in tasks.json');
    }
    
  } catch (error) {
    result.errors.push(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return result;
};

/**
 * Convert parsed tasks to RunConfig format
 */
export const convertToRunConfigs = (
  parsedTasks: ParsedTask[]
): Omit<RunConfig, 'id' | 'createdAt' | 'updatedAt'>[] => {
  return parsedTasks.map(task => ({
    name: task.name,
    command: task.command,
    arguments: task.arguments,
    workingDirectory: task.workingDirectory,
    environment: task.environment,
  }));
};
