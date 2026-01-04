<!--
 * Rebebuca - Shared Terminal Tab Bar Component
 * Used by ConsoleArea and DemoApp
 -->

<template>
  <div class="terminal-tabs" :class="{ 'light-theme': lightTheme }">
    <div class="tabs-container">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="terminal-tab"
        :class="{
          active: activeTabId === tab.id,
          running: tab.status === 'running',
          success: tab.status === 'success',
          error: tab.status === 'error'
        }"
        @click="$emit('select', tab.id)"
      >
        <span class="tab-status"></span>
        <span class="tab-label">{{ tab.name }}</span>
        <span class="tab-close" @click.stop="$emit('close', tab.id)">×</span>
      </div>
      <div v-if="showAddButton" class="add-tab-btn" @click="$emit('add')">+</div>
    </div>
    <slot name="actions"></slot>
  </div>
</template>

<script setup lang="ts">
export interface Tab {
  id: string;
  name: string;
  status?: 'running' | 'success' | 'error' | 'idle';
}

defineProps<{
  tabs: Tab[];
  activeTabId: string;
  showAddButton?: boolean;
  lightTheme?: boolean;
}>();

defineEmits<{
  select: [id: string];
  close: [id: string];
  add: [];
}>();
</script>

<style scoped>
.terminal-tabs {
  display: flex;
  background: rgba(0, 0, 0, 0.15);
  border-bottom: 1px solid var(--n-border-color, rgba(255, 255, 255, 0.1));
  height: 36px;
  padding: 0 8px;
  align-items: center;
}

.terminal-tabs.light-theme {
  background: rgba(0, 0, 0, 0.05);
}

.tabs-container {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  overflow-x: auto;
}

/* Hide scrollbar but allow scrolling */
.tabs-container::-webkit-scrollbar {
  display: none;
}

.terminal-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.5));
  background: transparent;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.terminal-tab:hover {
  background: var(--n-color-hover, rgba(255, 255, 255, 0.08));
}

.terminal-tab.active {
  background: var(--n-color, rgba(255, 255, 255, 0.12));
  color: var(--n-text-color, #fff);
}

/* Tab status indicator */
.tab-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--n-text-color-3, rgba(255, 255, 255, 0.3));
  flex-shrink: 0;
}

.terminal-tab.running .tab-status {
  background: #00d084;
  animation: tab-pulse 2s infinite;
}

.terminal-tab.success .tab-status {
  background: #52c41a;
}

.terminal-tab.error .tab-status {
  background: #ff4d4f;
}

@keyframes tab-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Tab label */
.tab-label {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Tab close button */
.tab-close {
  font-size: 14px;
  opacity: 0;
  padding: 0 2px;
  border-radius: 2px;
  transition: opacity 0.15s;
  line-height: 1;
}

.terminal-tab:hover .tab-close {
  opacity: 0.6;
}

.tab-close:hover {
  opacity: 1;
  background: var(--n-color-hover, rgba(255, 255, 255, 0.1));
}

/* Add tab button */
.add-tab-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.5));
  transition: all 0.15s;
  flex-shrink: 0;
}

.add-tab-btn:hover {
  background: var(--n-color-hover, rgba(255, 255, 255, 0.08));
  color: var(--n-text-color, #fff);
}
</style>
