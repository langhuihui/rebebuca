<!--
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
 -->

<template>
  <div class="worker-output-container">
    <div class="worker-output-scroll" ref="scrollRef" v-memo="[contentHash]">
      <slot>
        <!-- 默认使用 pre 标签显示纯文本 -->
        <pre v-if="!useMarkdown" class="worker-output-text">{{ truncatedContent }}</pre>
        <!-- 使用 markdown 渲染 -->
        <div v-else class="message-text" v-html="renderedContent"></div>
      </slot>
    </div>

    <!-- 大内容提示 -->
    <div v-if="isLargeContent" class="content-warning" @click="toggleFullContent">
      <n-icon size="12"><component :is="svgIcons.alertCircle" /></n-icon>
      <span>{{ showFullContent ? t('aiCollab.showLess') : t('aiCollab.showFullContent', { count: contentLength }) }}</span>
    </div>

    <!-- Metadata 显示（可选） -->
    <div v-if="metadata" class="message-metadata">
      <n-tag
        v-if="metadata.filesChanged?.length"
        size="tiny"
        type="info"
      >
        {{ metadata.filesChanged.length }} files changed
      </n-tag>
      <n-tag
        v-if="metadata.commandsRun?.length"
        size="tiny"
        type="warning"
      >
        {{ metadata.commandsRun.length }} commands run
      </n-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { NTag } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { renderMarkdown } from '../../utils/markdown';
import { svgIcons } from '../../utils/icons';

const MAX_DISPLAY_LENGTH = 10000; // 最大显示长度
const CONTENT_HASH_SAMPLE = 500; // 用于 hash 的字符数

interface Props {
  // 内容（纯文本或 markdown）
  content?: string;
  // 是否使用 markdown 渲染
  useMarkdown?: boolean;
  // 格式化函数（用于处理内容，如 formatWorkerContent）
  formatContent?: (content: string) => string;
  // Metadata（可选）
  metadata?: {
    filesChanged?: string[];
    commandsRun?: string[];
    [key: string]: any;
  };
  // 自动滚动到底部
  autoScroll?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  content: '',
  useMarkdown: false,
  autoScroll: true,
});

const scrollRef = ref<HTMLElement | null>(null);
const showFullContent = ref(false);

const { t } = useI18n();

// 内容长度
const contentLength = computed(() => props.content?.length || 0);

// 是否是大内容
const isLargeContent = computed(() => contentLength.value > MAX_DISPLAY_LENGTH);

// 内容哈希（用于 v-memo 优化）
const contentHash = computed(() => {
  const sample = (props.content || '').slice(0, CONTENT_HASH_SAMPLE);
  return `${sample.length}-${sample.charCodeAt(0)}`;
});

// 截断的内容
const truncatedContent = computed(() => {
  if (!showFullContent.value && contentLength.value > MAX_DISPLAY_LENGTH) {
    return (props.content || '').slice(0, MAX_DISPLAY_LENGTH) + '\n\n...';
  }
  return props.content || '';
});

// 切换完整内容显示
const toggleFullContent = () => {
  showFullContent.value = !showFullContent.value;
  nextTick(() => {
    scrollToBottom();
  });
};

// 渲染后的内容
const renderedContent = computed(() => {
  if (!props.content) return '';

  let processedContent = showFullContent.value || !isLargeContent.value
    ? props.content
    : props.content.slice(0, MAX_DISPLAY_LENGTH) + '\n\n...';

  // 如果有格式化函数，先应用格式化
  if (props.formatContent) {
    processedContent = props.formatContent(processedContent);
  }

  // 如果使用 markdown，渲染 markdown
  if (props.useMarkdown) {
    return renderMarkdown(processedContent);
  }

  return processedContent;
});

// 滚动到底部
const scrollToBottom = () => {
  if (scrollRef.value && props.autoScroll) {
    requestAnimationFrame(() => {
      if (scrollRef.value) {
        scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
      }
    });
  }
};

// 监听内容变化，自动滚动
watch(() => props.content, () => {
  if (props.autoScroll) {
    nextTick(() => {
      scrollToBottom();
    });
  }
}, { immediate: true });

// 暴露方法供父组件调用
defineExpose({
  scrollToBottom,
  scrollRef,
});
</script>

<style scoped>
/* Worker 输出小窗口样式 */
.worker-output-container {
  background: #1a1a2e;
  border-radius: 8px;
  border: 1px solid #2d2d44;
  height: 150px;
  display: flex;
  flex-direction: column;
}

.worker-output-scroll {
  flex: 1;
  overflow-y: scroll;
  overflow-x: auto;
  scroll-behavior: smooth;
  position: relative;
  padding: 12px;
  /* 确保内容可以完整显示 */
  min-height: 0;
}

.worker-output-scroll::-webkit-scrollbar {
  width: 6px;
}

.worker-output-scroll::-webkit-scrollbar-track {
  background: #1a1a2e;
}

.worker-output-scroll::-webkit-scrollbar-thumb {
  background: #4a4a6a;
  border-radius: 3px;
}

.worker-output-scroll::-webkit-scrollbar-thumb:hover {
  background: #5a5a7a;
}

/* 内容容器已移除，直接在 scroll 容器中显示内容 */

/* 纯文本样式 - 确保文本完整显示 */
.worker-output-text {
  margin: 0;
  padding: 0;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #e0e0e0;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  display: block;
  /* 移除所有可能截断文本的属性 */
  text-overflow: unset;
  overflow: visible;
  max-height: none;
  height: auto;
  user-select: text;
  -webkit-user-select: text;
}

/* Markdown 样式 - 确保文本完整显示 */
.message-text {
  margin: 0;
  padding: 0;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #e0e0e0;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  display: block;
  /* 移除所有可能截断文本的属性 */
  text-overflow: unset;
  overflow: visible;
  max-height: none;
  height: auto;
}

.message-text :deep(p) {
  margin: 0 0 8px 0;
  color: #e0e0e0;
  text-overflow: unset;
  overflow: visible;
  max-height: none;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-text :deep(code) {
  background: rgba(255, 255, 255, 0.1);
  color: #ff79c6;
  text-overflow: unset;
  overflow: visible;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-text :deep(pre) {
  background: rgba(0, 0, 0, 0.3);
  color: #e0e0e0;
  text-overflow: unset;
  overflow: visible;
  max-height: none;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-text :deep(*) {
  text-overflow: unset !important;
  overflow: visible !important;
  max-height: none !important;
}

/* Metadata 样式 */
.message-metadata {
  background: rgba(0, 0, 0, 0.2);
  border-color: #2d2d44;
  padding: 8px 12px;
  margin: 0;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* 大内容警告提示 */
.content-warning {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(250, 173, 20, 0.1);
  border-top: 1px solid rgba(250, 173, 20, 0.3);
  color: #faad14;
  font-size: 11px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.content-warning:hover {
  background: rgba(250, 173, 20, 0.2);
}

/* 工具执行在小窗口内的样式 */
.tool-inside-output {
  margin: 8px 0;
}

.tool-inside-output:first-child {
  margin-top: 0;
}

.tool-inside-output:last-child {
  margin-bottom: 0;
}
</style>
