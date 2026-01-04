<!--
 * Rebebuca - Shared Port List Component
 * Used by StatusBar (port dialog) and DemoApp
 -->

<template>
  <div class="port-list">
    <!-- Header -->
    <div class="port-header">
      <span class="port-col-name">{{ labels.process }}</span>
      <span class="port-col-pid">PID</span>
      <span class="port-col-port">{{ labels.port }}</span>
      <span class="port-col-action"></span>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="port-loading">
      <slot name="loading">
        {{ labels.loading || 'Loading...' }}
      </slot>
    </div>

    <!-- Empty state -->
    <div v-else-if="processes.length === 0" class="port-empty">
      <slot name="empty">
        {{ labels.empty || 'No processes found' }}
      </slot>
    </div>

    <!-- Process list -->
    <template v-else>
      <div
        v-for="proc in processes"
        :key="proc.pid"
        class="port-item"
      >
        <span class="port-col-name">{{ proc.name }}</span>
        <span class="port-col-pid">{{ proc.pid }}</span>
        <span class="port-col-port">
          <slot name="port-tag" :port="proc.port">
            <span class="port-tag">{{ proc.port }}</span>
          </slot>
        </span>
        <span class="port-col-action">
          <slot name="action" :process="proc">
            <button class="port-kill-btn" @click="$emit('kill', proc)">
              {{ labels.kill || 'Kill' }}
            </button>
          </slot>
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
export interface PortProcess {
  pid: number;
  name: string;
  port: number;
  command?: string;
}

export interface PortListLabels {
  process?: string;
  port?: string;
  kill?: string;
  loading?: string;
  empty?: string;
}

defineProps<{
  processes: PortProcess[];
  loading?: boolean;
  labels?: PortListLabels;
}>();

defineEmits<{
  kill: [process: PortProcess];
}>();

// Provide default labels
const defaultLabels: PortListLabels = {
  process: 'Process',
  port: 'Port',
  kill: 'Kill',
  loading: 'Loading...',
  empty: 'No processes found'
};
</script>

<style scoped>
.port-list {
  font-size: 13px;
}

.port-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-weight: 500;
  border-bottom: 1px solid var(--n-border-color, rgba(255, 255, 255, 0.1));
  opacity: 0.7;
}

.port-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--n-border-color, rgba(255, 255, 255, 0.1));
  transition: background 0.15s;
}

.port-item:last-child {
  border-bottom: none;
}

.port-item:hover {
  background: var(--n-color-hover, rgba(255, 255, 255, 0.05));
}

.port-col-name {
  flex: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.port-col-pid {
  flex: 1;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.5));
}

.port-col-port {
  flex: 1;
}

.port-col-action {
  width: 60px;
  text-align: right;
  flex-shrink: 0;
}

.port-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  background: rgba(24, 144, 255, 0.1);
  color: #1890ff;
}

.port-empty,
.port-loading {
  padding: 32px;
  text-align: center;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.5));
}

.port-kill-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #ff4d4f;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.port-kill-btn:hover {
  background: rgba(255, 77, 79, 0.1);
}
</style>
