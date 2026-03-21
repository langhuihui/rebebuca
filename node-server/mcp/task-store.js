/**
 * In-memory task list synced from the Rebebuca UI (POST /api/mcp/sync-tasks).
 */

/** @type {Record<string, unknown>[]} */
let tasks = [];

export function setSyncedTasks(newTasks) {
  tasks = Array.isArray(newTasks) ? [...newTasks] : [];
}

export function getSyncedTasks() {
  return tasks;
}

export function getTaskById(taskId) {
  return tasks.find((t) => t && t.id === taskId) || null;
}
