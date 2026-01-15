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
 * MCP Task Sync Service
 * 
 * Synchronizes task list to MCP server and handles task execution events from MCP.
 */

import { isTauri } from '../../adapters';
import type { Task } from '../../providers/types';

let initialized = false;
let unlisten: (() => void) | null = null;

/**
 * Convert Task to a serializable format for MCP
 */
function serializeTask(task: Task): Record<string, unknown> {
  return {
    id: task.id,
    name: task.name,
    source: task.source,
    command: task.command,
    args: task.args,
    cwd: task.cwd,
    group: task.group,
    type: task.type,
    env: task.env,
    dependsOn: task.dependsOn,
    subTasks: task.subTasks,
    executionMode: task.executionMode,
    isDefault: task.isDefault,
    aiTool: task.aiTool,
    sshConfigId: task.sshConfigId,
  };
}

/**
 * Sync task list to MCP server
 */
export async function syncTasksToMCP(tasks: Task[]): Promise<void> {
  if (!isTauri()) {
    return;
  }
  
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const serializedTasks = tasks.map(serializeTask);
    await invoke('mcp_update_task_list', { tasks: serializedTasks });
    console.log('[MCP TaskSync] Synced', tasks.length, 'tasks to MCP server');
  } catch (error) {
    // MCP server might not be running, which is fine
    console.log('[MCP TaskSync] Could not sync tasks:', error);
  }
}

/**
 * Initialize MCP task execution event listener
 */
export async function initMCPTaskListener(
  executeTaskCallback: (taskId: string, cwd?: string) => Promise<void>
): Promise<void> {
  if (!isTauri() || initialized) {
    return;
  }
  
  try {
    const { listen } = await import('@tauri-apps/api/event');
    
    unlisten = await listen<{ taskId: string; cwd?: string }>('mcp-execute-task', async (event) => {
      const { taskId, cwd } = event.payload;
      console.log('[MCP TaskSync] Received execute-task event:', taskId, cwd);
      
      try {
        await executeTaskCallback(taskId, cwd ?? undefined);
        console.log('[MCP TaskSync] Task execution triggered successfully:', taskId);
      } catch (error) {
        console.error('[MCP TaskSync] Failed to execute task:', taskId, error);
      }
    });
    
    initialized = true;
    console.log('[MCP TaskSync] Task execution listener initialized');
  } catch (error) {
    console.error('[MCP TaskSync] Failed to initialize task listener:', error);
  }
}

/**
 * Cleanup MCP task listener
 */
export function cleanupMCPTaskListener(): void {
  if (unlisten) {
    unlisten();
    unlisten = null;
    initialized = false;
    console.log('[MCP TaskSync] Task execution listener cleaned up');
  }
}
