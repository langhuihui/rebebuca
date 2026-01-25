<template>
  <div class="batch-task-queue">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <n-space :size="12">
        <n-button
          type="primary"
          @click="startBatchTasks"
          :disabled="!canStartBatch"
          :loading="isProcessing"
        >
          <template #icon>
            <n-icon><PlayIcon /></n-icon>
          </template>
          开始批量处理
        </n-button>

        <n-button @click="pauseAllTasks" :disabled="!isProcessing">
          <template #icon>
            <n-icon><PauseIcon /></n-icon>
          </template>
          暂停全部
        </n-button>

        <n-button @click="stopAllTasks" :disabled="!hasActiveTasks">
          <template #icon>
            <n-icon><StopIcon /></n-icon>
          </template>
          停止全部
        </n-button>

        <n-button @click="clearCompletedTasks" :disabled="!hasCompletedTasks">
          <template #icon>
            <n-icon><TrashIcon /></n-icon>
          </template>
          清空已完成
        </n-button>
      </n-space>

      <n-space :size="12" align="center">
        <span class="label">并发数:</span>
        <n-input-number
          v-model:value="concurrency"
          :min="1"
          :max="5"
          :step="1"
          style="width: 80px;"
        />

        <n-tag type="info">待处理: {{ pendingTasksCount }}</n-tag>
        <n-tag type="primary">处理中: {{ runningTasksCount }}</n-tag>
        <n-tag type="success">已完成: {{ completedTasksCount }}</n-tag>
        <n-tag type="error">失败: {{ failedTasksCount }}</n-tag>
      </n-space>
    </div>

    <n-divider />

    <!-- 任务列表 -->
    <div class="task-list">
      <n-list bordered hoverable clickable>
        <n-list-item v-for="task in sortedTasks" :key="task.id">
          <div class="task-item">
            <!-- 任务信息 -->
            <div class="task-info">
              <div class="task-header">
                <span class="task-name">{{ task.name }}</span>
                <n-tag :type="getTaskStatusType(task.status)" size="small">
                  {{ getTaskStatusText(task.status) }}
                </n-tag>
              </div>

              <div class="task-details">
                <span class="detail-item">
                  <n-icon size="14"><FileIcon /></n-icon>
                  {{ formatFileSize(task.fileSize) }}
                </span>
                <span class="detail-item">
                  <n-icon size="14"><TimeIcon /></n-icon>
                  {{ formatDuration(task.duration) }}
                </span>
                <span class="detail-item" v-if="task.startedAt">
                  <n-icon size="14"><TimerIcon /></n-icon>
                  运行中: {{ formatElapsedTime(task.startedAt) }}
                </span>
              </div>
            </div>

            <!-- 任务进度 -->
            <div class="task-progress" v-if="task.status !== 'pending' && task.status !== 'cancelled'">
              <n-progress
                type="line"
                :percentage="task.progress"
                :status="getProgressStatus(task.status)"
                :show-indicator="false"
              />
              <span class="progress-text">{{ task.progress }}%</span>
            </div>

            <!-- 操作按钮 -->
            <div class="task-actions">
              <n-button
                text
                size="small"
                @click="handleTaskAction(task)"
                :disabled="task.status === 'completed' || task.status === 'failed'"
              >
                <template #icon>
                  <n-icon>
                    <component :is="getTaskActionIcon(task.status)" />
                  </n-icon>
                </template>
                {{ getTaskActionText(task.status) }}
              </n-button>

              <n-button
                text
                size="small"
                type="error"
                @click="removeTask(task.id)"
                :disabled="task.status === 'running'"
              >
                <template #icon>
                  <n-icon><CloseIcon /></n-icon>
                </template>
              </n-button>
            </div>
          </div>

          <!-- 错误信息 -->
          <n-alert
            v-if="task.status === 'failed' && task.error"
            type="error"
            :bordered="false"
            style="margin-top: 8px; padding: 8px;"
          >
            {{ task.error }}
          </n-alert>
        </n-list-item>

        <n-empty v-if="tasks.length === 0" description="暂无任务" />
      </n-list>
    </div>

    <!-- 底部统计 -->
    <div class="footer-stats">
      <n-space :size="24">
        <div class="stat-item">
          <span class="stat-label">总任务:</span>
          <span class="stat-value">{{ tasks.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">平均进度:</span>
          <span class="stat-value">{{ averageProgress }}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">预计剩余:</span>
          <span class="stat-value">{{ estimatedTime }}</span>
        </div>
      </n-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  NSpace,
  NButton,
  NIcon,
  NDivider,
  NTag,
  NInputNumber,
  NList,
  NListItem,
  NProgress,
  NAlert,
  NEmpty,
  useMessage
} from 'naive-ui';
import {
  Play as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Trash as TrashIcon,
  Document as FileIcon,
  Time as TimeIcon,
  TimerOutline as TimerIcon,
  Close as CloseIcon,
  RemoveCircleOutline as RemoveIcon
} from '@vicons/ionicons5';
import { useFFmpegParamsStore } from '../stores/ffmpegParams';

const message = useMessage();
const store = useFFmpegParamsStore();

// 并发数
const concurrency = ref(2);

// 处理状态
const isProcessing = ref(false);

// 任务列表
type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

interface BatchTask {
  id: string;
  name: string;
  filePath: string;
  fileSize: number;
  duration: number;
  status: TaskStatus;
  progress: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

const tasks = ref<BatchTask[]>([]);

// 计算属性
const sortedTasks = computed(() => {
  return [...tasks.value].sort((a, b) => {
    // 运行中的任务排在前面
    if (a.status === 'running' && b.status !== 'running') return -1;
    if (b.status === 'running' && a.status !== 'running') return 1;
    // 等待中的任务排在前面
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (b.status === 'pending' && a.status !== 'pending') return 1;
    // 按创建时间排序
    return 0;
  });
});

const pendingTasksCount = computed(() => tasks.value.filter(t => t.status === 'pending').length);
const runningTasksCount = computed(() => tasks.value.filter(t => t.status === 'running').length);
const completedTasksCount = computed(() => tasks.value.filter(t => t.status === 'completed').length);
const failedTasksCount = computed(() => tasks.value.filter(t => t.status === 'failed').length);

const canStartBatch = computed(() => pendingTasksCount.value > 0);
const hasActiveTasks = computed(() => runningTasksCount.value > 0 || pendingTasksCount.value > 0);
const hasCompletedTasks = computed(() => completedTasksCount.value > 0 || failedTasksCount.value > 0);

const averageProgress = computed(() => {
  if (tasks.value.length === 0) return 0;
  const total = tasks.value.reduce((sum, task) => sum + task.progress, 0);
  return Math.round(total / tasks.value.length);
});

const estimatedTime = computed(() => {
  if (runningTasksCount.value === 0 && pendingTasksCount.value === 0) return '--';
  // 简单估算,实际应该基于历史数据
  return '计算中...';
});

// 从输入文件创建任务
const createTasksFromInputFiles = () => {
  tasks.value = store.inputFiles.map((file, index) => ({
    id: `task-${Date.now()}-${index}`,
    name: file.name,
    filePath: file.path,
    fileSize: file.size,
    duration: 0, // 需要从 FFmpeg 获取
    status: 'pending' as TaskStatus,
    progress: 0
  }));

  message.success(`已创建 ${tasks.value.length} 个任务`);
};

// 开始批量处理
const startBatchTasks = async () => {
  if (tasks.value.length === 0) {
    createTasksFromInputFiles();
  }

  isProcessing.value = true;

  // 启动指定数量的任务
  const tasksToStart = Math.min(
    concurrency.value,
    pendingTasksCount.value
  );

  for (let i = 0; i < tasksToStart; i++) {
    const task = tasks.value.find(t => t.status === 'pending');
    if (task) {
      await startTask(task);
    }
  }
};

// 开始单个任务
const startTask = async (task: BatchTask) => {
  task.status = 'running';
  task.startedAt = Date.now();

  // 模拟任务执行
  // 实际应该调用 FFmpeg 执行命令
  simulateTaskProgress(task);
};

// 模拟任务进度
const simulateTaskProgress = (task: BatchTask) => {
  const interval = setInterval(() => {
    if (task.status !== 'running') {
      clearInterval(interval);
      return;
    }

    task.progress += Math.random() * 5;

    if (task.progress >= 100) {
      task.progress = 100;
      task.status = 'completed';
      task.completedAt = Date.now();
      clearInterval(interval);

      // 启动下一个任务
      const nextTask = tasks.value.find(t => t.status === 'pending');
      if (nextTask && runningTasksCount.value < concurrency.value) {
        startTask(nextTask);
      }
    }
  }, 500);
};

// 暂停所有任务
const pauseAllTasks = () => {
  tasks.value.forEach(task => {
    if (task.status === 'running') {
      task.status = 'paused';
    }
  });

  isProcessing.value = false;
  message.info('已暂停所有任务');
};

// 停止所有任务
const stopAllTasks = () => {
  tasks.value.forEach(task => {
    if (task.status === 'running' || task.status === 'paused') {
      task.status = 'cancelled';
      task.progress = 0;
    }
  });

  isProcessing.value = false;
  message.warning('已停止所有任务');
};

// 清空已完成任务
const clearCompletedTasks = () => {
  tasks.value = tasks.value.filter(
    task => task.status !== 'completed' && task.status !== 'failed'
  );
  message.success('已清空已完成任务');
};

// 处理任务操作
const handleTaskAction = (task: BatchTask) => {
  switch (task.status) {
    case 'pending':
    case 'paused':
      startTask(task);
      break;
    case 'running':
      task.status = 'paused';
      message.info('已暂停任务');
      break;
    case 'failed':
      task.status = 'pending';
      task.progress = 0;
      task.error = undefined;
      startTask(task);
      break;
    default:
      break;
  }
};

// 移除任务
const removeTask = (taskId: string) => {
  const index = tasks.value.findIndex(t => t.id === taskId);
  if (index !== -1) {
    tasks.value.splice(index, 1);
    message.info('已移除任务');
  }
};

// 获取任务状态类型
const getTaskStatusType = (status: TaskStatus) => {
  const types: Record<TaskStatus, any> = {
    pending: 'default',
    running: 'info',
    paused: 'warning',
    completed: 'success',
    failed: 'error',
    cancelled: 'default'
  };
  return types[status];
};

// 获取任务状态文本
const getTaskStatusText = (status: TaskStatus) => {
  const texts: Record<TaskStatus, string> = {
    pending: '等待中',
    running: '处理中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  };
  return texts[status];
};

// 获取进度状态
const getProgressStatus = (status: TaskStatus) => {
  const statuses: Record<TaskStatus, any> = {
    pending: undefined,
    running: 'info',
    paused: 'warning',
    completed: 'success',
    failed: 'error',
    cancelled: undefined
  };
  return statuses[status];
};

// 获取任务操作图标
const getTaskActionIcon = (status: TaskStatus) => {
  const icons: Record<TaskStatus, any> = {
    pending: PlayIcon,
    running: PauseIcon,
    paused: PlayIcon,
    completed: undefined,
    failed: PlayIcon,
    cancelled: undefined
  };
  return icons[status];
};

// 获取任务操作文本
const getTaskActionText = (status: TaskStatus) => {
  const texts: Record<TaskStatus, string> = {
    pending: '开始',
    running: '暂停',
    paused: '继续',
    completed: '',
    failed: '重试',
    cancelled: ''
  };
  return texts[status];
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

// 格式化时长
const formatDuration = (seconds: number): string => {
  if (seconds === 0) return '--:--';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// 格式化运行时间
const formatElapsedTime = (startedAt: number): string => {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  return formatDuration(elapsed);
};

// 初始化:如果已经有输入文件,自动创建任务
if (store.isBatchMode && tasks.value.length === 0) {
  createTasksFromInputFiles();
}
</script>

<style scoped>
.batch-task-queue {
  padding: 16px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.task-list {
  max-height: 500px;
  overflow-y: auto;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.task-name {
  font-weight: 500;
  font-size: 14px;
}

.task-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}

.progress-text {
  font-size: 12px;
  font-weight: 500;
  color: #666;
  min-width: 35px;
  text-align: right;
}

.task-actions {
  display: flex;
  gap: 4px;
}

.footer-stats {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.stat-label {
  color: #666;
}

.stat-value {
  font-weight: 600;
  color: #3b82f6;
}
</style>
