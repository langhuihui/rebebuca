/**
 * FFmpeg 进度 Store
 * 管理转码进度状态，实时更新进度数据
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FFmpegProgress } from '../types/progress';
import { progressParser } from '../services/progressParser';

/**
 * 任务进度信息
 */
export interface TaskProgress {
  taskId: string;
  tabId: string;
  fileName: string;
  progress: FFmpegProgress;
  startTime: number;
  lastUpdateTime: number;
  isFinished: boolean;
  errorCount: number;
}

export const useFFmpegProgressStore = defineStore('ffmpegProgress', () => {
  // 所有任务的进度
  const tasks = ref<Map<string, TaskProgress>>(new Map());

  // 当前活动的任务 ID
  const activeTaskId = ref<string | null>(null);

  /**
   * 获取所有任务列表
   */
  const taskList = computed(() => Array.from(tasks.value.values()));

  /**
   * 获取当前活动的任务
   */
  const activeTask = computed(() => {
    if (!activeTaskId.value) return null;
    return tasks.value.get(activeTaskId.value) || null;
  });

  /**
   * 获取运行中的任务数量
   */
  const runningTasksCount = computed(() => {
    return Array.from(tasks.value.values()).filter(
      task => !task.isFinished && 
              task.progress.status !== 'error'
    ).length;
  });

  /**
   * 创建新任务进度
   */
  const createTask = (taskId: string, tabId: string, fileName: string) => {
    const task: TaskProgress = {
      taskId,
      tabId,
      fileName,
      progress: {
        status: 'analyzing',
      },
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      isFinished: false,
      errorCount: 0,
    };

    tasks.value.set(taskId, task);
    activeTaskId.value = taskId;

    console.log('[FFmpeg Progress] Task created:', taskId, fileName);
  };

  /**
   * 更新任务进度
   */
  const updateTask = (taskId: string, line: string) => {
    const task = tasks.value.get(taskId);
    if (!task) {
      console.warn('[FFmpeg Progress] Task not found:', taskId);
      return;
    }

    // 解析进度行
    const progress = progressParser.parseLine(line);
    if (!progress) {
      return;
    }

    // 更新进度数据
    task.progress = { ...task.progress, ...progress };
    task.lastUpdateTime = Date.now();

    // 处理错误
    if (progress.status === 'error' && progress.error) {
      task.errorCount++;
      console.error('[FFmpeg Progress] Task error:', taskId, progress.error);
    }

    // 如果进度为 100%，标记为完成
    if (progress.progress !== undefined && progress.progress >= 100) {
      task.isFinished = true;
      task.progress.status = 'finished';
      console.log('[FFmpeg Progress] Task finished:', taskId);
    }
  };

  /**
   * 完成任务
   */
  const finishTask = (taskId: string, exitCode?: number) => {
    const task = tasks.value.get(taskId);
    if (!task) {
      return;
    }

    task.isFinished = true;
    task.progress.status = exitCode === 0 ? 'finished' : 'error';
    task.lastUpdateTime = Date.now();

    console.log('[FFmpeg Progress] Task finished:', taskId, 'exitCode:', exitCode);

    // 如果是当前活动任务，清空活动 ID
    if (activeTaskId.value === taskId) {
      activeTaskId.value = null;
    }
  };

  /**
   * 标记任务为 muxing 状态
   */
  const setMuxing = (taskId: string) => {
    const task = tasks.value.get(taskId);
    if (!task) {
      return;
    }

    task.progress.status = 'muxing';
    task.lastUpdateTime = Date.now();

    console.log('[FFmpeg Progress] Task muxing:', taskId);
  };

  /**
   * 移除任务
   */
  const removeTask = (taskId: string) => {
    const deleted = tasks.value.delete(taskId);
    if (deleted) {
      console.log('[FFmpeg Progress] Task removed:', taskId);
    }

    // 如果是当前活动任务，清空活动 ID
    if (activeTaskId.value === taskId) {
      activeTaskId.value = null;
    }
  };

  /**
   * 获取任务进度
   */
  const getTask = (taskId: string): TaskProgress | undefined => {
    return tasks.value.get(taskId);
  };

  /**
   * 通过 tabId 获取任务
   */
  const getTaskByTabId = (tabId: string): TaskProgress | undefined => {
    return Array.from(tasks.value.values()).find(task => task.tabId === tabId);
  };

  /**
   * 设置活动任务
   */
  const setActiveTask = (taskId: string | null) => {
    activeTaskId.value = taskId;
  };

  /**
   * 计算预估剩余时间（格式化）
   */
  const formatRemainingTime = (task: TaskProgress): string => {
    const { remainingTime, progress } = task.progress;
    
    if (remainingTime === undefined || remainingTime < 0) {
      return '计算中...';
    }

    if (progress !== undefined && progress >= 99) {
      return '即将完成';
    }

    const hours = Math.floor(remainingTime / 3600);
    const minutes = Math.floor((remainingTime % 3600) / 60);
    const seconds = Math.floor(remainingTime % 60);

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds}秒`;
    } else {
      return `${seconds}秒`;
    }
  };

  /**
   * 格式化进度百分比
   */
  const formatProgress = (task: TaskProgress): string => {
    const { progress } = task.progress;
    
    if (progress === undefined) {
      return '分析中...';
    }

    return `${progress.toFixed(1)}%`;
  };

  /**
   * 格式化文件大小
   */
  const formatFileSize = (sizeBytes?: number): string => {
    if (sizeBytes === undefined) {
      return '-';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = sizeBytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  /**
   * 格式化时间
   */
  const formatTime = (time?: string): string => {
    if (!time) {
      return '--:--:--';
    }
    return time;
  };

  /**
   * 清空所有任务
   */
  const clearAllTasks = () => {
    tasks.value.clear();
    activeTaskId.value = null;
    console.log('[FFmpeg Progress] All tasks cleared');
  };

  /**
   * 清除已完成的任务
   */
  const clearFinishedTasks = () => {
    const iterator = tasks.value[Symbol.iterator]();
    let result = iterator.next();

    while (!result.done) {
      const [taskId, task] = result.value;
      if (task.isFinished) {
        tasks.value.delete(taskId);
      }
      result = iterator.next();
    }

    console.log('[FFmpeg Progress] Finished tasks cleared');
  };

  return {
    // State
    taskList,
    activeTask,
    activeTaskId,
    runningTasksCount,

    // Actions
    createTask,
    updateTask,
    finishTask,
    setMuxing,
    removeTask,
    getTask,
    getTaskByTabId,
    setActiveTask,
    clearAllTasks,
    clearFinishedTasks,

    // Helpers
    formatRemainingTime,
    formatProgress,
    formatFileSize,
    formatTime,
  };
});
