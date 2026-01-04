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
  <n-modal 
    v-model:show="showDialog"
    preset="dialog"
    :title="t('task.portManagement')"
    style="width: 700px;"
    :show-icon="false"
    to="body"
  >
    <div class="port-dialog-content">
      <!-- Filter Input -->
      <div class="port-filter">
        <n-input
          v-model:value="portFilter"
          :placeholder="t('task.portFilter')"
          clearable
        >
          <template #prefix>
            <n-icon size="16">
              <component :is="svgIcons.search" />
            </n-icon>
          </template>
        </n-input>
        <n-button
          type="primary"
          :loading="loading"
          @click="loadPortProcesses"
        >
          <template #icon>
            <n-icon size="16">
              <component :is="svgIcons.refresh" />
            </n-icon>
          </template>
          {{ t('task.refreshPorts') }}
        </n-button>
      </div>
      
      <!-- Port List -->
      <div v-if="filteredGroupedProcesses.length > 0" class="port-list">
        <div class="port-header">
          <span class="name-col">{{ t('task.processName') }}</span>
          <span class="pid-col">{{ t('task.pid') }}</span>
          <span class="port-col">{{ t('task.port') }}</span>
          <span class="action-col"></span>
        </div>
        <div 
          v-for="proc in filteredGroupedProcesses" 
          :key="proc.pid"
          class="port-item"
        >
          <span class="name-col" :title="proc.command || proc.name">{{ proc.name }}</span>
          <span class="pid-col">{{ proc.pid }}</span>
          <span class="port-col port-numbers">
            <n-tag 
              v-for="port in proc.ports" 
              :key="port" 
              size="small" 
              type="info"
              class="port-tag"
            >
              {{ port }}
            </n-tag>
          </span>
          <span class="action-col">
            <n-button
              size="small"
              type="error"
              quaternary
              @click="handleKillProcess(proc.pid)"
            >
              {{ t('task.killProcess') }}
            </n-button>
          </span>
        </div>
      </div>
      <div v-else class="no-ports">
        <n-icon size="48" :depth="3">
          <component :is="svgIcons.network" />
        </n-icon>
        <p>{{ t('task.noPortsFound') }}</p>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { NModal, NInput, NButton, NIcon, NTag } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { svgIcons } from '../../../utils/icons';
import { getAdapter } from '../../../adapters';

interface PortProcess {
  port: number;
  pid: number;
  name: string;
  command: string;
}

interface GroupedProcess {
  pid: number;
  name: string;
  command: string;
  ports: number[];
}

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

const { t } = useI18n();

const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

const portFilter = ref('');
const loading = ref(false);
const portProcesses = ref<PortProcess[]>([]);

const groupedProcesses = computed(() => {
  const grouped = new Map<number, GroupedProcess>();
  
  for (const proc of portProcesses.value) {
    if (grouped.has(proc.pid)) {
      grouped.get(proc.pid)!.ports.push(proc.port);
    } else {
      grouped.set(proc.pid, {
        pid: proc.pid,
        name: proc.name,
        command: proc.command,
        ports: [proc.port],
      });
    }
  }
  
  for (const proc of grouped.values()) {
    proc.ports.sort((a, b) => a - b);
  }
  
  return Array.from(grouped.values()).sort((a, b) => a.ports[0] - b.ports[0]);
});

const filteredGroupedProcesses = computed(() => {
  if (!portFilter.value) return groupedProcesses.value;
  const filter = portFilter.value.trim().toLowerCase();
  return groupedProcesses.value.filter(p => 
    p.ports.some(port => String(port).includes(filter)) ||
    p.name.toLowerCase().includes(filter) ||
    String(p.pid).includes(filter)
  );
});

const loadPortProcesses = async () => {
  loading.value = true;
  try {
    const adapter = await getAdapter();
    const ports = await adapter.system.listPorts();
    // Convert PortInfo to PortProcess format
    portProcesses.value = ports.map(p => ({
      port: p.port,
      pid: p.pid,
      name: p.process,
      command: p.process,
    }));
  } catch (error) {
    console.error('[PortManagementDialog] Failed to load port processes:', error);
  } finally {
    loading.value = false;
  }
};

const handleKillProcess = async (pid: number) => {
  try {
    const adapter = await getAdapter();
    await adapter.system.killProcess(pid);
    await loadPortProcesses();
  } catch (error) {
    console.error('[PortManagementDialog] Failed to kill process:', pid, error);
  }
};

// Load ports when dialog opens
watch(() => props.show, async (show) => {
  if (show) {
    await loadPortProcesses();
  }
}, { immediate: true });
</script>

<style scoped>
.port-dialog-content {
  min-height: 300px;
}

.port-filter {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.port-filter .n-input {
  flex: 1;
}

.port-list {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  max-height: 400px;
  overflow-y: auto;
}

.port-header {
  display: flex;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  font-weight: 600;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.port-item {
  display: flex;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  align-items: center;
}

.port-item:last-child {
  border-bottom: none;
}

.port-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.port-col {
  width: 150px;
  flex-shrink: 0;
}

.port-numbers {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.port-tag {
  font-family: 'Courier New', Courier, monospace;
  font-weight: 600;
}

.pid-col {
  width: 80px;
  flex-shrink: 0;
  font-family: 'Courier New', Courier, monospace;
  color: rgba(255, 255, 255, 0.6);
}

.name-col {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-col {
  width: 100px;
  flex-shrink: 0;
  text-align: right;
}

.no-ports {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: rgba(255, 255, 255, 0.4);
}

.no-ports p {
  margin-top: 16px;
}

/* Light theme */
:global(.n-config-provider--light) .port-list {
  border-color: rgba(0, 0, 0, 0.1);
}

:global(.n-config-provider--light) .port-header {
  background: rgba(0, 0, 0, 0.03);
  color: rgba(0, 0, 0, 0.5);
  border-bottom-color: rgba(0, 0, 0, 0.1);
}

:global(.n-config-provider--light) .port-item {
  border-bottom-color: rgba(0, 0, 0, 0.05);
}

:global(.n-config-provider--light) .port-item:hover {
  background: rgba(0, 0, 0, 0.02);
}

:global(.n-config-provider--light) .pid-col {
  color: rgba(0, 0, 0, 0.5);
}

:global(.n-config-provider--light) .no-ports {
  color: rgba(0, 0, 0, 0.3);
}
</style>
