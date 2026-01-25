<template>
  <div class="performance-info">
    <div class="info-grid">
      <!-- 帧数 -->
      <div class="info-item">
        <div class="info-label">帧</div>
        <div class="info-value">{{ frameValue }}</div>
      </div>

      <!-- FPS -->
      <div class="info-item">
        <div class="info-label">FPS</div>
        <div class="info-value">{{ fpsValue }}</div>
      </div>

      <!-- Q -->
      <div class="info-item">
        <div class="info-label">Q</div>
        <div class="info-value">{{ qValue }}</div>
      </div>

      <!-- 大小 -->
      <div class="info-item">
        <div class="info-label">大小</div>
        <div class="info-value">{{ sizeValue }}</div>
      </div>

      <!-- 码率 -->
      <div class="info-item">
        <div class="info-label">码率</div>
        <div class="info-value">{{ bitrateValue }}</div>
      </div>

      <!-- 速度 -->
      <div class="info-item">
        <div class="info-label">速度</div>
        <div class="info-value">{{ speedValue }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FFmpegProgress } from '../types/progress';
import { useFFmpegProgressStore } from '../stores/progressStore';

interface Props {
  progress: FFmpegProgress;
}

const props = withDefaults(defineProps<Props>(), {
  progress: () => ({}),
});

const progressStore = useFFmpegProgressStore();

/**
 * 帧数值
 */
const frameValue = computed(() => {
  return props.progress.frame !== undefined
    ? props.progress.frame.toLocaleString()
    : '-';
});

/**
 * FPS 值
 */
const fpsValue = computed(() => {
  return props.progress.fps !== undefined
    ? props.progress.fps.toFixed(1)
    : '-';
});

/**
 * Q 值
 */
const qValue = computed(() => {
  return props.progress.q !== undefined
    ? props.progress.q.toFixed(1)
    : '-';
});

/**
 * 大小值
 */
const sizeValue = computed(() => {
  return progressStore.formatFileSize(props.progress.sizeBytes);
});

/**
 * 码率值
 */
const bitrateValue = computed(() => {
  return props.progress.bitrate !== undefined
    ? `${props.progress.bitrate.toFixed(0)} kbits/s`
    : '-';
});

/**
 * 速度值
 */
const speedValue = computed(() => {
  return props.progress.speed !== undefined
    ? `${props.progress.speed.toFixed(1)}x`
    : '-';
});
</script>

<style scoped>
.performance-info {
  width: 100%;
  padding: 12px 16px;
  background: var(--color-bg);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.info-label {
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  font-family: 'JetBrains Mono', monospace;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .info-label {
    font-size: 10px;
  }

  .info-value {
    font-size: 12px;
  }
}
</style>
