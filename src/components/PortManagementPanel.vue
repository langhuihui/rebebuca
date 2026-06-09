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
  <div class="port-management-panel">
    <div class="port-panel-content">
      <div class="port-toolbar">
        <n-input
          v-model:value="portFilter"
          :placeholder="t('task.portFilter')"
          clearable
          class="port-toolbar-filter"
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
        <div class="port-toolbar-switch">
          <span class="switch-label">{{ t('task.devListenersOnly') }}</span>
          <n-switch v-model:value="devListenersOnly" />
        </div>
        <n-button
          secondary
          :disabled="orphanedTargets.length === 0 || loading"
          @click="handleCleanOrphaned"
        >
          {{ t('task.cleanOrphanedListeners') }}
        </n-button>
        <n-button
          type="error"
          :disabled="loading"
          @click="handleCloseService"
        >
          {{ t('task.closeService') }}
        </n-button>
      </div>

      <n-scrollbar class="port-list-scrollbar">
        <div v-if="filteredGroupedProcesses.length > 0" class="port-table-wrap">
          <div class="port-list">
            <div class="port-header">
              <span class="col-process">{{ t('task.processName') }}</span>
              <span class="col-pid">{{ t('task.pid') }}</span>
              <span class="col-project">{{ t('task.portProject') }}</span>
              <span class="col-fw">{{ t('task.portFramework') }}</span>
              <span class="col-ports">{{ t('task.port') }}</span>
              <span class="col-up">{{ t('task.portUptime') }}</span>
              <span class="col-mem">{{ t('task.portMemory') }}</span>
              <span class="col-st">{{ t('task.portStatus') }}</span>
              <span class="col-actions"></span>
            </div>
            <div
              v-for="proc in filteredGroupedProcesses"
              :key="proc.pid"
              class="port-item"
            >
              <span class="col-process" :title="proc.command || proc.name">{{ proc.name }}</span>
              <span class="col-pid">{{ proc.pid }}</span>
              <span class="col-project" :title="proc.project">{{ proc.project || '—' }}</span>
              <span class="col-fw" :title="proc.framework ?? ''">{{ proc.framework || '—' }}</span>
              <span class="col-ports port-numbers">
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
              <span class="col-up">{{ proc.uptime || '—' }}</span>
              <span class="col-mem">{{ proc.memory || '—' }}</span>
              <span class="col-st">
                <n-tag
                  v-if="proc.status"
                  size="small"
                  :bordered="false"
                  :type="statusTagType(proc.status)"
                >
                  {{ statusLabel(proc.status) }}
                </n-tag>
                <span v-else>—</span>
              </span>
              <span class="col-actions">
                <n-space size="small" justify="end">
                  <n-button size="tiny" quaternary @click="openDetail(proc)">
                    {{ t('task.portDetails') }}
                  </n-button>
                  <n-button
                    size="tiny"
                    type="error"
                    quaternary
                    @click="handleKillProcess(proc.pid)"
                  >
                    {{ t('task.killProcess') }}
                  </n-button>
                  <n-button
                    size="tiny"
                    type="error"
                    quaternary
                    @click="handleForceKillProcess(proc.pid)"
                  >
                    {{ t('task.forceKillProcess') }}
                  </n-button>
                </n-space>
              </span>
            </div>
          </div>
        </div>
        <div v-else class="no-ports">
          <n-icon size="48" :depth="3">
            <component :is="svgIcons.network" />
          </n-icon>
          <p>{{ t('task.noPortsFound') }}</p>
        </div>
      </n-scrollbar>
    </div>

    <n-modal
      v-model:show="detailOpen"
      preset="card"
      :title="t('task.portDetails')"
      class="port-detail-modal"
      style="width: min(720px, calc(100vw - 32px))"
      :closable="true"
      to="body"
    >
      <n-scrollbar v-if="detailProc" class="port-detail-scroll">
        <n-descriptions
          :column="1"
          label-placement="left"
          size="small"
          bordered
          :label-style="portDetailLabelStyle"
        >
          <n-descriptions-item :label="t('task.processName')">
            {{ detailProc.name }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('task.pid')">
            {{ detailProc.pid }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('task.port')">
            {{ detailProc.ports.join(', ') }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('task.portProject')">
            {{ detailProc.project || '—' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('task.portFramework')">
            {{ detailProc.framework || '—' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('task.portStatus')">
            {{ detailProc.status ? statusLabel(detailProc.status) : '—' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('task.portUptime')">
            {{ detailProc.uptime || '—' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('task.portMemory')">
            {{ detailProc.memory || '—' }}
          </n-descriptions-item>
          <n-descriptions-item v-if="detailProc.dockerContainer" :label="t('task.dockerContainer')">
            {{ detailProc.dockerContainer }}
          </n-descriptions-item>
          <n-descriptions-item v-if="detailProc.dockerImage" :label="t('task.dockerImage')">
            {{ detailProc.dockerImage }}
          </n-descriptions-item>
          <n-descriptions-item v-if="detailProc.cwd" :label="t('dialog.workingDirectory')">
            <span class="detail-mono">{{ detailProc.cwd }}</span>
          </n-descriptions-item>
          <n-descriptions-item :label="t('task.commandLine')">
            <span class="detail-mono">{{ detailProc.command || '—' }}</span>
          </n-descriptions-item>
        </n-descriptions>
      </n-scrollbar>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type { CSSProperties } from 'vue';
import {
  NInput,
  NButton,
  NIcon,
  NTag,
  NScrollbar,
  NSwitch,
  NSpace,
  NModal,
  NDescriptions,
  NDescriptionsItem,
  useMessage,
  useDialog,
} from 'naive-ui';
import type { TagProps } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { svgIcons } from '../utils/icons';
import { getAdapter } from '../adapters';
import type { PortInfo, PortListenerStatus } from '../adapters/types';
import { useCloseService } from '../composables/useCloseService';

interface GroupedPortProcess {
  pid: number;
  name: string;
  command: string;
  ports: number[];
  project?: string;
  framework?: string | null;
  uptime?: string | null;
  status?: PortListenerStatus;
  memory?: string | null;
  cwd?: string;
  dockerContainer?: string;
  dockerImage?: string;
}

const { t } = useI18n();
const message = useMessage();
const dialog = useDialog();
const { closeService: handleCloseService } = useCloseService();

/** Wider label column in port detail modal (n-descriptions). */
const portDetailLabelStyle: CSSProperties = {
  width: '192px',
  minWidth: '192px',
};

const portFilter = ref('');
const devOnly = ref(false);
const loading = ref(false);
const portProcesses = ref<PortInfo[]>([]);
const detailOpen = ref(false);
const detailProc = ref<GroupedPortProcess | null>(null);

/** Naive UI switch: "on" means restrict to dev listeners (port-whisperer-style). */
const devListenersOnly = computed({
  get: () => devOnly.value,
  set: (v: boolean) => {
    devOnly.value = v;
  },
});

const groupedProcesses = computed(() => {
  const grouped = new Map<number, GroupedPortProcess>();

  for (const proc of portProcesses.value) {
    if (grouped.has(proc.pid)) {
      grouped.get(proc.pid)!.ports.push(proc.port);
    } else {
      grouped.set(proc.pid, {
        pid: proc.pid,
        name: proc.process,
        command: proc.command ?? proc.process,
        ports: [proc.port],
        project: proc.project,
        framework: proc.framework,
        uptime: proc.uptime,
        status: proc.status,
        memory: proc.memory,
        cwd: proc.cwd,
        dockerContainer: proc.dockerContainer,
        dockerImage: proc.dockerImage,
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
  return groupedProcesses.value.filter(
    (p) =>
      p.ports.some((port) => String(port).includes(filter)) ||
      p.name.toLowerCase().includes(filter) ||
      String(p.pid).includes(filter) ||
      (p.project && p.project.toLowerCase().includes(filter)) ||
      (p.framework && String(p.framework).toLowerCase().includes(filter)) ||
      (p.command && p.command.toLowerCase().includes(filter)),
  );
});

const orphanedTargets = computed(() =>
  groupedProcesses.value.filter((p) => p.status === 'orphaned' || p.status === 'zombie'),
);

function statusLabel(s: PortListenerStatus): string {
  if (s === 'healthy') return t('task.portStatusHealthy');
  if (s === 'orphaned') return t('task.portStatusOrphaned');
  return t('task.portStatusZombie');
}

function statusTagType(s: PortListenerStatus): TagProps['type'] {
  if (s === 'healthy') return 'success';
  if (s === 'orphaned') return 'warning';
  return 'error';
}

const loadPortProcesses = async () => {
  loading.value = true;
  try {
    const adapter = await getAdapter();
    const ports = await adapter.system.listPorts({ showAll: !devOnly.value });
    portProcesses.value = ports;
  } catch (error) {
    console.error('[PortManagementPanel] Failed to load port processes:', error);
  } finally {
    loading.value = false;
  }
};

function openDetail(proc: GroupedPortProcess) {
  detailProc.value = proc;
  detailOpen.value = true;
}

const handleKillProcess = async (pid: number) => {
  const proc = filteredGroupedProcesses.value.find((p) => p.pid === pid);
  const processName = proc?.name || `PID ${pid}`;

  dialog.warning({
    title: t('task.killProcess'),
    content: t('task.confirmKillProcess', { name: processName, pid }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        const adapter = await getAdapter();
        await adapter.system.killProcess(pid);
        message.success(t('task.processKilled', { name: processName }));
        await loadPortProcesses();
      } catch (error) {
        console.error('[PortManagementPanel] Failed to kill process:', pid, error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        message.error(t('task.failedToKillProcess', { name: processName, error: errorMsg }));
      }
    },
  });
};

const handleForceKillProcess = async (pid: number) => {
  const proc = filteredGroupedProcesses.value.find((p) => p.pid === pid);
  const processName = proc?.name || `PID ${pid}`;

  dialog.warning({
    title: t('task.forceKillProcess'),
    content: t('task.confirmForceKillProcess', { name: processName, pid }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        const adapter = await getAdapter();
        await adapter.system.killProcessForce(pid);
        message.success(t('task.processKilled', { name: processName }));
        await loadPortProcesses();
      } catch (error) {
        console.error('[PortManagementPanel] Failed to force-kill process:', pid, error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        message.error(t('task.failedToKillProcess', { name: processName, error: errorMsg }));
      }
    },
  });
};

const handleCleanOrphaned = () => {
  const targets = orphanedTargets.value;
  if (targets.length === 0) return;

  dialog.warning({
    title: t('task.cleanOrphanedListeners'),
    content: t('task.confirmCleanOrphaned', { count: targets.length }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const adapter = await getAdapter();
      let ok = 0;
      for (const p of targets) {
        try {
          await adapter.system.killProcess(p.pid);
          ok += 1;
        } catch (e) {
          console.warn('[PortManagementPanel] clean orphaned failed for pid', p.pid, e);
        }
      }
      message.success(t('task.cleanOrphanedDone', { ok, total: targets.length }));
      await loadPortProcesses();
    },
  });
};

watch(devListenersOnly, () => {
  void loadPortProcesses();
});

onMounted(async () => {
  await loadPortProcesses();
});
</script>

<style scoped>
.port-management-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.port-panel-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 16px;
}

.port-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.port-toolbar-filter {
  flex: 1;
  min-width: 160px;
}

.port-toolbar-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.switch-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
}

.port-list-scrollbar {
  flex: 1;
  height: 100%;
}

.port-table-wrap {
  overflow-x: auto;
  max-width: 100%;
}

.port-list {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  min-width: 920px;
}

.port-header,
.port-item {
  display: grid;
  grid-template-columns:
    minmax(72px, 1fr)
    56px
    minmax(72px, 1fr)
    minmax(72px, 1fr)
    120px
    72px
    64px
    88px
    minmax(200px, 1.2fr);
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  font-size: 12px;
}

.port-header {
  background: rgba(255, 255, 255, 0.05);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.port-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.port-item:last-child {
  border-bottom: none;
}

.port-item:hover {
  background: rgba(255, 255, 255, 0.03);
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

.col-process {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-project,
.col-fw {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-pid {
  font-family: 'Courier New', Courier, monospace;
  color: rgba(255, 255, 255, 0.6);
}

.col-actions {
  justify-self: end;
}

.detail-mono {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  word-break: break-all;
  white-space: pre-wrap;
}

.port-detail-scroll {
  max-height: min(70vh, 520px);
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

:global(.n-config-provider--light) .col-pid {
  color: rgba(0, 0, 0, 0.5);
}

:global(.n-config-provider--light) .no-ports {
  color: rgba(0, 0, 0, 0.3);
}

:global(.n-config-provider--light) .switch-label {
  color: rgba(0, 0, 0, 0.55);
}
</style>
