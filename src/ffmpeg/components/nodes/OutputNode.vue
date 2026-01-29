<template>
  <div class="output-node">
    <!-- 输入端口 (只输入,无输出) -->
    <Handle
      type="target"
      :position="Position.Left"
      :id="`in-${streamType}-0`"
      :class="['handle', `handle-${streamType}`]"
    />

    <!-- 节点内容 -->
    <div class="node-content">
      <div class="node-header">
        <span class="node-icon">📤</span>
        <span class="node-title">输出</span>
      </div>

      <div class="node-info">
        <div class="info-item">
          <n-text depth="3" style="font-size: 11px">类型: </n-text>
          <n-tag :type="streamType === 'v' ? 'info' : 'success'" size="small" :bordered="false">
            {{ streamTypeLabel }}
          </n-tag>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { NText, NTag } from 'naive-ui';
import type { FilterNode as FilterNodeType } from '@/ffmpeg/types/preset';

interface Props {
  id: string;
  data: FilterNodeType['data'];
  selected: boolean;
}

const props = defineProps<Props>();

// 流类型: 默认为视频
const streamType = computed(() => props.data.streamType || 'v');

const streamTypeLabel = computed(() => {
  return streamType.value === 'v' ? '视频' : '音频';
});
</script>

<style scoped>
.output-node {
  background: var(--n-color);
  border: 2px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px;
  min-width: 160px;
  cursor: default;
  pointer-events: auto;
}

.node-content {
  pointer-events: none;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.node-icon {
  font-size: 16px;
}

.node-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--n-success-color);
}

.node-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.handle {
  width: 12px;
  height: 12px;
  border: 2px solid var(--n-border-color);
  background: var(--n-color);
  border-radius: 50%;
  transition: all 0.2s;
}

.handle-v {
  border-color: #3b82f6;
}

.handle-v:hover {
  background: #3b82f6;
  transform: scale(1.2);
}

.handle-a {
  border-color: #10b981;
}

.handle-a:hover {
  background: #10b981;
  transform: scale(1.2);
}
</style>
