<template>
  <div class="ffmpeg-progress-example">
    <h2>FFmpeg 进度监控示例</h2>

    <!-- 进度监控面板 -->
    <ProgressMonitor :taskId="taskId" />

    <!-- 控制按钮 -->
    <div class="controls">
      <button @click="startFFmpeg" :disabled="isRunning">
        开始转码
      </button>
      <button @click="stopFFmpeg" :disabled="!isRunning">
        停止
      </button>
      <button @click="clearProgress" :disabled="isRunning">
        清除进度
      </button>
    </div>

    <!-- 使用说明 -->
    <div class="instructions">
      <h3>使用说明</h3>
      <ol>
        <li>点击"开始转码"按钮启动 FFmpeg 任务</li>
        <li>观察实时进度、帧率、码率等信息</li>
        <li>查看剩余时间估算</li>
        <li>如果出现错误，会在错误日志中显示</li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useTerminalStore } from '../../stores/terminal';
import { useFFmpegProgressStore } from '../stores/progressStore';
import ProgressMonitor from '../components/ProgressMonitor.vue';

const terminalStore = useTerminalStore();
const progressStore = useFFmpegProgressStore();

const taskId = ref<string>('');
const isRunning = ref(false);

/**
 * 开始 FFmpeg 转码
 */
const startFFmpeg = async () => {
  try {
    isRunning.value = true;

    // 创建 FFmpeg 任务终端
    const tab = await terminalStore.executeTask({
      command: 'ffmpeg',
      args: [
        '-i',
        'input.mp4',
        '-c:v',
        'libx264',
        '-crf',
        '23',
        '-preset',
        'medium',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        'output.mp4',
      ],
      cwd: '/path/to/working/directory',
      label: 'FFmpeg 转码任务',
      // 标记为 FFmpeg 任务
      isFFmpegTask: true,
      ffmpegFileName: 'input.mp4',
    });

    // 等待终端准备就绪
    await new Promise(resolve => setTimeout(resolve, 500));

    // 启动任务
    await terminalStore.startTask(tab.id);

    // 保存任务 ID
    taskId.value = tab.id;

    console.log('[FFmpeg Progress Example] Task started:', tab.id);
  } catch (error) {
    console.error('[FFmpeg Progress Example] Failed to start task:', error);
    isRunning.value = false;
  }
};

/**
 * 停止 FFmpeg 任务
 */
const stopFFmpeg = async () => {
  if (!taskId.value) {
    return;
  }

  try {
    await terminalStore.stopTask(taskId.value);
    isRunning.value = false;
    console.log('[FFmpeg Progress Example] Task stopped:', taskId.value);
  } catch (error) {
    console.error('[FFmpeg Progress Example] Failed to stop task:', error);
  }
};

/**
 * 清除进度
 */
const clearProgress = () => {
  progressStore.clearAllTasks();
  taskId.value = '';
  console.log('[FFmpeg Progress Example] Progress cleared');
};
</script>

<style scoped>
.ffmpeg-progress-example {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

h2 {
  margin-bottom: 16px;
  color: #1f2937;
}

.controls {
  display: flex;
  gap: 12px;
  margin: 24px 0;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

button {
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

button:hover:not(:disabled) {
  background: #2563eb;
}

button:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.instructions {
  margin-top: 24px;
  padding: 16px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
}

h3 {
  margin: 0 0 12px 0;
  color: #92400e;
  font-size: 14px;
}

ol {
  margin: 0;
  padding-left: 20px;
  color: #78350f;
  font-size: 13px;
  line-height: 1.6;
}

li {
  margin-bottom: 6px;
}
</style>
