<template>
  <div class="error-log">
    <!-- 错误头部 -->
    <div class="error-header" v-if="hasError">
      <div class="error-icon">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"
            fill="#EF4444"
          />
          <path
            d="M10 7V11M10 14V14.01"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <div class="error-title">错误</div>
      <button class="expand-button" @click="toggleExpanded">
        {{ isExpanded ? '收起' : '展开' }}
      </button>
    </div>

    <!-- 错误详情 -->
    <div class="error-body" v-if="hasError && isExpanded">
      <div class="error-message">{{ errorMessage }}</div>
      <button class="copy-button" @click="copyError">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M9.5 2H4.5C4.22386 2 4 2.22386 4 2.5V9.5C4 9.77614 4.22386 10 4.5 10H9.5C9.77614 10 10 9.77614 10 9.5V2.5C10 2.22386 9.77614 2 9.5 2Z"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M6 6V4.5C6 4.22386 6.22386 4 6.5 4H10.5C10.7761 4 11 4.22386 11 4.5V11.5C11 11.7761 10.7761 12 10.5 12H6.5"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
        复制错误
      </button>
    </div>

    <!-- 无错误状态 -->
    <div class="no-error" v-else>
      <div class="success-icon">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"
            fill="#10B981"
          />
          <path
            d="M7 10L9 12L13 8"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <div class="success-text">运行正常</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { FFmpegProgress } from '../types/progress';

interface Props {
  progress: FFmpegProgress;
}

const props = withDefaults(defineProps<Props>(), {
  progress: () => ({}),
});

const isExpanded = ref(false);

/**
 * 是否有错误
 */
const hasError = computed(() => {
  return props.progress.status === 'error' && !!props.progress.error;
});

/**
 * 错误消息
 */
const errorMessage = computed(() => {
  return props.progress.error || '未知错误';
});

/**
 * 切换展开状态
 */
const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

/**
 * 复制错误信息
 */
const copyError = () => {
  if (props.progress.error) {
    navigator.clipboard.writeText(props.progress.error);
    // 可以添加 toast 提示
  }
};
</script>

<style scoped>
.error-log {
  width: 100%;
  padding: 12px 16px;
  background: var(--color-bg);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.error-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.error-icon {
  flex-shrink: 0;
}

.error-title {
  font-size: 14px;
  font-weight: 600;
  color: #EF4444;
  flex-grow: 1;
}

.expand-button {
  padding: 4px 12px;
  background: #FEE2E2;
  color: #DC2626;
  border: 1px solid #FECACA;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.expand-button:hover {
  background: #FECACA;
}

.error-body {
  margin-top: 12px;
  padding: 12px;
  background: #FEF2F2;
  border: 1px solid #FECACA;
  border-radius: 6px;
}

.error-message {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #DC2626;
  line-height: 1.5;
  margin-bottom: 8px;
  white-space: pre-wrap;
  word-break: break-all;
}

.copy-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--n-color-embedded);
  color: var(--n-text-color-2);
  border: 1px solid var(--n-border-color);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-button:hover {
  background: #F9FAFB;
  border-color: #9CA3AF;
}

.no-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
}

.success-icon {
  flex-shrink: 0;
}

.success-text {
  font-size: 13px;
  color: #10B981;
  font-weight: 500;
}
</style>
