<template>
  <div class="progress-monitor">
    <!-- 进度条 -->
    <FFmpegProgress :progress="currentProgress" />

    <!-- 性能信息 -->
    <div class="performance-section">
      <PerformanceInfo :progress="currentProgress" />
    </div>

    <!-- 剩余时间和预估大小 -->
    <div class="estimation-section" v-if="showEstimation">
      <div class="estimation-item">
        <div class="estimation-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M8 5V8L10 10"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <div class="estimation-label">剩余时间</div>
        <div class="estimation-value">{{ remainingTime }}</div>
      </div>

      <div class="estimation-item">
        <div class="estimation-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15C11.866 15 15 11.866 15 8C15 7.17157 14.8399 6.46904 14.535 5.82222"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
            <path
              d="M8 4V8L11 10"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div class="estimation-label">预计完成</div>
        <div class="estimation-value">{{ estimatedFinishTime }}</div>
      </div>
    </div>

    <!-- 错误日志 -->
    <div class="error-section">
      <ErrorLog :progress="currentProgress" />
    </div>

    <!-- 批量任务列表 -->
    <div class="batch-tasks" v-if="taskList.length > 1">
      <div class="batch-header">
        <div class="batch-title">批量任务 ({{ taskList.length }})</div>
      </div>
      <div class="task-list">
        <div
          v-for="task in taskList"
          :key="task.taskId"
          class="task-item"
          :class="{
            'task-active': task.taskId === activeTaskId,
            'task-finished': task.isFinished,
          }"
          @click="selectTask(task.taskId)"
        >
          <div class="task-name">{{ task.fileName }}</div>
          <div class="task-progress">{{ formatTaskProgress(task) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useFFmpegProgressStore } from '../stores/progressStore';
import FFmpegProgress from './FFmpegProgress.vue';
import PerformanceInfo from './PerformanceInfo.vue';
import ErrorLog from './ErrorLog.vue';

interface Props {
  taskId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  taskId: undefined,
});

const progressStore = useFFmpegProgressStore();

/**
 * 当前任务
 */
const currentTask = computed(() => {
  if (props.taskId) {
    return progressStore.getTask(props.taskId);
  }
  return progressStore.activeTask;
});

/**
 * 当前进度
 */
const currentProgress = computed(() => {
  return currentTask.value?.progress || {};
});

/**
 * 任务列表
 */
const taskList = computed(() => progressStore.taskList);

/**
 * 当前活动任务 ID
 */
const activeTaskId = computed(() => progressStore.activeTaskId);

/**
 * 是否显示估算信息
 */
const showEstimation = computed(() => {
  const { progress, status } = currentProgress.value;
  return status === 'encoding' && progress !== undefined && progress > 0;
});

/**
 * 剩余时间
 */
const remainingTime = computed(() => {
  if (!currentTask.value) {
    return '-';
  }
  return progressStore.formatRemainingTime(currentTask.value);
});

/**
 * 预计完成时间
 */
const estimatedFinishTime = computed(() => {
  const { remainingTime } = currentProgress.value;
  if (remainingTime === undefined || remainingTime < 0) {
    return '-';
  }

  const finishTime = Date.now() + remainingTime * 1000;
  const date = new Date(finishTime);
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${hours}:${minutes}`;
});

/**
 * 选择任务
 */
const selectTask = (taskId: string) => {
  progressStore.setActiveTask(taskId);
};

/**
 * 格式化任务进度
 */
const formatTaskProgress = (task: any) => {
  if (task.isFinished) {
    return '✓ 已完成';
  }
  if (task.progress.status === 'error') {
    return '✗ 失败';
  }
  return progressStore.formatProgress(task);
};
</script>

<style scoped>
.progress-monitor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg);
  border-radius: 8px;
}

.performance-section {
  width: 100%;
}

.estimation-section {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  background: #F9FAFB;
  border-radius: 8px;
  border: 1px solid #E5E7EB;
}

.estimation-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.estimation-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--n-color-embedded);
  border-radius: 6px;
  color: var(--n-primary-color);
  flex-shrink: 0;
}

.estimation-label {
  font-size: 11px;
  color: #6B7280;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.estimation-value {
  font-size: 14px;
  font-weight: 600;
  color: #1F2937;
}

.error-section {
  width: 100%;
}

.batch-tasks {
  margin-top: 16px;
  border-top: 1px solid #E5E7EB;
  padding-top: 16px;
}

.batch-header {
  margin-bottom: 12px;
}

.batch-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--n-color-embedded);
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.task-item:hover {
  background: #F9FAFB;
  border-color: #D1D5DB;
}

.task-active {
  background: #EFF6FF;
  border-color: #3B82F6;
}

.task-finished {
  opacity: 0.7;
}

.task-name {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-progress {
  font-size: 11px;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  color: #6B7280;
}

/* 滚动条样式 */
.task-list::-webkit-scrollbar {
  width: 6px;
}

.task-list::-webkit-scrollbar-track {
  background: #F3F4F6;
  border-radius: 3px;
}

.task-list::-webkit-scrollbar-thumb {
  background: #D1D5DB;
  border-radius: 3px;
}

.task-list::-webkit-scrollbar-thumb:hover {
  background: #9CA3AF;
}
</style>
