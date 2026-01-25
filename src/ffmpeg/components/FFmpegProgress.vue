<template>
  <div class="ffmpeg-progress">
    <!-- 进度条 -->
    <div class="progress-bar-container">
      <div class="progress-bar" :style="{ width: progressPercentage }">
        <span class="progress-text">{{ progressText }}</span>
      </div>
    </div>

    <!-- 时间信息 -->
    <div class="time-info">
      <span class="time-label">当前:</span>
      <span class="time-value">{{ currentTime }}</span>
      <span class="time-separator">/</span>
      <span class="time-label">总时长:</span>
      <span class="time-value">{{ totalTime }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FFmpegProgress } from '../types/progress';

interface Props {
  progress: FFmpegProgress;
}

const props = withDefaults(defineProps<Props>(), {
  progress: () => ({}),
});

/**
 * 进度百分比
 */
const progressPercentage = computed(() => {
  const { progress } = props.progress;
  if (progress === undefined || progress === 0) {
    return '0%';
  }
  return `${Math.min(100, progress)}%`;
});

/**
 * 进度文本
 */
const progressText = computed(() => {
  const { progress } = props.progress;
  if (progress === undefined) {
    return '分析中...';
  }
  return `${progress.toFixed(1)}%`;
});

/**
 * 当前时间
 */
const currentTime = computed(() => {
  return props.progress.time || '--:--:--';
});

/**
 * 总时长
 */
const totalTime = computed(() => {
  return props.progress.duration || '--:--:--';
});
</script>

<style scoped>
.ffmpeg-progress {
  width: 100%;
  padding: 12px 16px;
  background: var(--color-bg);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.progress-bar-container {
  position: relative;
  width: 100%;
  height: 24px;
  background: #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: width 0.3s ease;
  min-width: 60px;
}

.progress-text {
  color: white;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.time-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #6b7280;
}

.time-label {
  font-weight: 500;
}

.time-value {
  font-family: 'JetBrains Mono', monospace;
  color: #1f2937;
  font-weight: 600;
}

.time-separator {
  margin: 0 4px;
  color: #9ca3af;
}
</style>
