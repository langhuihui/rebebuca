/**
 * Rebebuca AI MCP: task list + run via node-pty (server mode).
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createTerminal } from '../handlers/terminal.js';
import * as taskStore from './task-store.js';

function taskSummary(t) {
  return {
    id: t.id,
    name: t.name,
    source: t.source,
    type: t.type,
    command: t.command,
    args: t.args,
    cwd: t.cwd,
    group: t.group,
    dependsOn: t.dependsOn,
    subTasks: t.subTasks,
    executionMode: t.executionMode,
    sshConfigId: t.sshConfigId,
    useSystemTerminal: t.useSystemTerminal,
  };
}

function isMacroTask(task) {
  return (
    task.type === 'macro' ||
    (!task.command && (task.dependsOn?.length || task.subTasks?.length))
  );
}

/**
 * Same ordering as taskManager.resolveTaskDependencies (deps first, task last).
 * @param {string} taskId
 * @param {Set<string>} [visited]
 * @returns {string[]}
 */
function resolveTaskDepsOrder(taskId, visited = new Set()) {
  if (visited.has(taskId)) {
    throw new Error(`Circular task dependency involving ${taskId}`);
  }
  visited.add(taskId);
  const task = taskStore.getTaskById(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  if (!task.dependsOn?.length) {
    return [taskId];
  }
  /** @type {string[]} */
  const resolved = [];
  for (const depId of task.dependsOn) {
    const sub = resolveTaskDepsOrder(depId, new Set(visited));
    for (const id of sub) {
      if (!resolved.includes(id)) resolved.push(id);
    }
  }
  resolved.push(taskId);
  return resolved;
}

/**
 * @param {Record<string, unknown>} task
 * @param {string} [cwdOverride]
 * @returns {Promise<Record<string, unknown>>}
 */
async function runLeafTask(task, cwdOverride) {
  if (task.sshConfigId) {
    throw new Error('SSH tasks cannot be executed via MCP in server mode');
  }
  if (task.useSystemTerminal) {
    throw new Error(
      'Tasks configured for system terminal cannot run via MCP; use the built-in PTY in the UI or change the task',
    );
  }
  if (!task.command) {
    throw new Error(`Task ${task.id} has no command (macro or invalid)`);
  }

  const cwd = cwdOverride || task.cwd;
  const info = await createTerminal({
    command: task.command,
    args: Array.isArray(task.args) ? task.args : [],
    cwd,
    env: task.env && typeof task.env === 'object' ? task.env : {},
    meta: { mcp: true, taskId: task.id, name: task.name },
  });

  return {
    ok: true,
    taskId: task.id,
    ptyId: info.ptyId,
    pid: info.pid,
    cwd: cwd || null,
  };
}

/**
 * @param {string} taskId
 * @param {string} [cwdOverride]
 */
export async function runTaskForMcp(taskId, cwdOverride) {
  const task = taskStore.getTaskById(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  if (isMacroTask(task)) {
    if (task.executionMode === 'parallel' && task.subTasks?.length) {
      const results = await Promise.all(
        task.subTasks.map((id) => runTaskForMcp(String(id), cwdOverride)),
      );
      return { ok: true, macro: true, parallel: true, results };
    }
    if (task.subTasks?.length) {
      /** @type {unknown[]} */
      const results = [];
      for (const id of task.subTasks) {
        results.push(await runTaskForMcp(String(id), cwdOverride));
      }
      return { ok: true, macro: true, serial: 'subTasks', results };
    }
    if (task.dependsOn?.length) {
      const order = resolveTaskDepsOrder(taskId);
      /** @type {unknown[]} */
      const results = [];
      for (const id of order) {
        const t = taskStore.getTaskById(id);
        if (!t) throw new Error(`Task not found: ${id}`);
        if (isMacroTask(t) && !t.command) continue;
        if (!t.command) continue;
        results.push(await runLeafTask(t, cwdOverride));
      }
      return { ok: true, macro: true, serial: 'dependsOn', results };
    }
    throw new Error(`Macro task ${taskId} has no subTasks or dependsOn`);
  }

  return runLeafTask(task, cwdOverride);
}

export function getAiToolDefinitionsForList() {
  return [
    {
      name: 'list_tasks',
      description:
        'List tasks last synced from the Rebebuca web UI (Settings opens the app and loads folders).',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_task',
      description: 'Get one task by id from the synced task list.',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task id' },
        },
        required: ['taskId'],
      },
    },
    {
      name: 'run_task',
      description:
        'Start a task in a PTY on the machine running Rebebuca (same as in-app terminal). Macro tasks run subtasks or dependency chains when possible.',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task id' },
          cwd: {
            type: 'string',
            description: 'Optional working directory override',
          },
        },
        required: ['taskId'],
      },
    },
  ];
}

async function callAiTool(name, args) {
  if (name === 'list_tasks') {
    return taskStore.getSyncedTasks().map(taskSummary);
  }
  if (name === 'get_task') {
    const taskId = args?.taskId;
    if (!taskId) throw new Error('taskId is required');
    const t = taskStore.getTaskById(String(taskId));
    if (!t) throw new Error(`Task not found: ${taskId}`);
    return taskSummary(t);
  }
  if (name === 'run_task') {
    const taskId = args?.taskId;
    if (!taskId) throw new Error('taskId is required');
    const cwd = args?.cwd != null ? String(args.cwd) : undefined;
    return runTaskForMcp(String(taskId), cwd);
  }
  throw new Error(`Unknown tool: ${name}`);
}

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} mcp
 */
export function registerAiToolsOnMcpServer(mcp) {
  mcp.registerTool(
    'list_tasks',
    {
      description: getAiToolDefinitionsForList()[0].description,
      inputSchema: z.object({}),
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            await callAiTool('list_tasks', {}),
            null,
            2,
          ),
        },
      ],
    }),
  );

  mcp.registerTool(
    'get_task',
    {
      description: getAiToolDefinitionsForList()[1].description,
      inputSchema: z.object({ taskId: z.string() }),
    },
    async ({ taskId }) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(await callAiTool('get_task', { taskId }), null, 2),
        },
      ],
    }),
  );

  mcp.registerTool(
    'run_task',
    {
      description: getAiToolDefinitionsForList()[2].description,
      inputSchema: z.object({
        taskId: z.string(),
        cwd: z.string().optional(),
      }),
    },
    async ({ taskId, cwd }) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(await callAiTool('run_task', { taskId, cwd }), null, 2),
        },
      ],
    }),
  );
}

/**
 * @param {string} version
 */
export function createAiMcpServer(version) {
  const mcp = new McpServer(
    { name: 'rebebuca-ai', version },
    { capabilities: { tools: { listChanged: true } } },
  );
  registerAiToolsOnMcpServer(mcp);
  return mcp;
}

/**
 * Minimal JSON-RPC (initialize / tools.list / tools.call) for health checks & simple clients.
 * Does not require Streamable HTTP Accept headers.
 * @param {unknown} body
 * @param {string} appVersion
 */
export async function handleAiMcpJsonRpc(body, appVersion = '0.0.0') {
  const msg = body;
  if (msg == null || msg.jsonrpc !== '2.0') {
    return { err: { code: -32600, message: 'Invalid Request' }, httpStatus: 400 };
  }

  const method = msg.method;
  const id = msg.id;

  if (method === 'initialize') {
    return {
      ok: {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'rebebuca-ai', version: appVersion },
        },
      },
      httpStatus: 200,
    };
  }

  if (method === 'notifications/initialized' || (method && method.startsWith('notifications/'))) {
    return { ok: null, httpStatus: 204 };
  }

  if (method === 'tools/list') {
    return {
      ok: {
        jsonrpc: '2.0',
        id,
        result: { tools: getAiToolDefinitionsForList() },
      },
      httpStatus: 200,
    };
  }

  if (method === 'tools/call') {
    const name = msg.params?.name;
    const args = msg.params?.arguments ?? {};
    try {
      const data = await callAiTool(name, args);
      return {
        ok: {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
          },
        },
        httpStatus: 200,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: message }],
            isError: true,
          },
        },
        httpStatus: 200,
      };
    }
  }

  return {
    err: { code: -32601, message: `Method not found: ${method}`, id },
    httpStatus: 400,
  };
}
