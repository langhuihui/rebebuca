<template>
  <div
    :class="['filter-node', { disabled: !data.enabled, selected: selected }]"
    @click="onClick"
  >
    <!-- 输入端口 -->
    <Handle
      v-for="(port, index) in inputPorts"
      :key="`in-${index}`"
      type="target"
      :position="Position.Left"
      :id="`in-${port}-${index}`"
      :class="['handle', `handle-${port}`]"
    />

    <!-- 节点内容 -->
    <div class="node-content">
      <div class="node-header">
        <span class="node-icon">{{ data.icon }}</span>
        <span class="node-title">{{ data.name }}</span>
        <n-checkbox
          :checked="data.enabled"
          size="small"
          @click.stop
          @update:checked="onToggleEnabled"
        />
      </div>

      <div v-if="data.description" class="node-description">
        {{ data.description }}
      </div>

      <!-- 参数预览 -->
      <div v-if="hasParams" class="node-params">
        <n-text depth="3" style="font-size: 11px">
          {{ paramsPreview }}
        </n-text>
      </div>
    </div>

    <!-- 输出端口 -->
    <Handle
      v-for="(port, index) in outputPorts"
      :key="`out-${index}`"
      type="source"
      :position="Position.Right"
      :id="`out-${port}-${index}`"
      :class="['handle', `handle-${port}`]"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { NCheckbox, NText } from 'naive-ui';
import type { FilterNode as FilterNodeType } from '@/ffmpeg/types/preset';

interface Props {
  id: string;
  data: FilterNodeType['data'];
  selected: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:enabled', nodeId: string, enabled: boolean): void;
}>();

// 根据 filterType 确定端口类型
const inputPorts = computed(() => {
  if (props.data.filterType === 'video') return ['v'];
  if (props.data.filterType === 'audio') return ['a'];
  if (props.data.filterType === 'merger') return ['v', 'a'];
  if (props.data.filterType === 'complex') return ['v', 'a'];
  return ['v']; // 默认视频端口
});

const outputPorts = computed(() => {
  if (props.data.filterType === 'video') return ['v'];
  if (props.data.filterType === 'audio') return ['a'];
  if (props.data.filterType === 'merger') return ['v', 'a'];
  if (props.data.filterType === 'splitter') return ['v', 'v'];
  return ['v']; // 默认视频端口
});

const hasParams = computed(() => {
  const params = props.data.params || {};
  return Object.keys(params).length > 0;
});

const paramsPreview = computed(() => {
  const params = props.data.params || {};
  return Object.entries(params)
    .slice(0, 3)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
});

const onClick = () => {
  // 触发选中事件 (由父组件处理)
};

const onToggleEnabled = (enabled: boolean) => {
  emit('update:enabled', props.id, enabled);
};
</script>

<style scoped>
.filter-node {
  background: var(--n-color);
  border: 2px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  cursor: pointer;
  transition: all 0.2s;
  pointer-events: auto;
  box-shadow: none;
}

/* 移除 vue-flow 默认的白色背景 */
:deep(.vue-flow__node) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
}

:deep(.vue-flow__node.selected) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.filter-node:hover {
  border-color: var(--n-primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.filter-node.selected {
  border-color: var(--n-primary-color);
  box-shadow: 0 0 0 2px var(--n-primary-color-suppl);
}

.filter-node.disabled {
  opacity: 0.5;
}

.node-content {
  pointer-events: none;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.node-icon {
  font-size: 16px;
}

.node-title {
  flex: 1;
  font-weight: 500;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-description {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-params {
  background: var(--n-color-embedded);
  border-radius: 4px;
  padding: 4px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
