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

import type { Task } from '../../providers/types';
import { detectBackendType } from '../../adapters';
import { getMcpHttpBase } from '../../utils/mcpHttpBase';

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
  if (detectBackendType() !== 'server') return;
  try {
    const res = await fetch(`${getMcpHttpBase()}/api/mcp/sync-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: tasks.map(serializeTask) }),
    });
    if (!res.ok) {
      console.warn('[MCP TaskSync] sync-tasks failed:', res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.warn('[MCP TaskSync] sync-tasks error:', e);
  }
}

/**
 * Initialize MCP task execution event listener
 */
export async function initMCPTaskListener(
  _executeTaskCallback: (taskId: string, cwd?: string) => Promise<void>
): Promise<void> {
  if (initialized) return;
  initialized = true;
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
