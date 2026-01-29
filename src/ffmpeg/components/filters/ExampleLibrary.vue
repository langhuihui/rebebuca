<template>
  <div class="example-library">
    <div class="library-header">
      <span class="title-text">
        <n-icon size="18" style="margin-right: 6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </n-icon>
        示例库
      </span>
    </div>

    <div class="category-tabs">
      <n-button text type="primary" size="small">全部</n-button>
    </div>

    <n-scrollbar class="example-list">
      <div class="example-items">
        <div
          v-for="example in props.examples"
          :key="example.id"
          class="example-item"
          @click="onSelect(example)"
        >
          <div class="example-header">
            <span class="example-icon">{{ example.icon }}</span>
            <span class="example-name">{{ example.name }}</span>
          </div>
          <div class="example-desc">{{ example.description }}</div>
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { NButton, NScrollbar, NIcon } from 'naive-ui';

interface ExampleData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  filterComplex: string;
  nodes: any[];
  edges: any[];
}

interface Props {
  examples: ExampleData[];
}

const props = defineProps<Props>();
const emit = defineEmits(['select']);

function onSelect(example: ExampleData) {
  emit('select', example);
}
</script>

<style scoped>
.example-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--n-color);
}

.library-header {
  display: flex;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.title-text {
  font-size: 16px;
  font-weight: 600;
}

.category-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.example-list {
  flex: 1;
  padding: 8px;
}

.example-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.example-item {
  background: var(--n-color-embedded);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.example-item:hover {
  border-color: var(--n-primary-color);
  background: var(--n-primary-color-hover);
  transform: translateX(4px);
}

.example-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.example-icon {
  font-size: 24px;
}

.example-name {
  font-weight: 500;
  font-size: 14px;
}

.example-desc {
  font-size: 12px;
  color: var(--n-text-color-2);
  line-height: 1.5;
}
</style>
