<!--
 * Rebebuca Website Demo - Ports Panel
 * Copyright (C) 2025 rebebuca contributors
 -->

<template>
  <div class="ports-panel">
    <!-- Filter and Refresh -->
    <div class="port-filter">
      <n-input
        v-model:value="portFilter"
        :placeholder="t('task.portFilter')"
        clearable
      />
      <n-button type="primary" @click="handleRefresh">
        {{ t("task.refreshPorts") }}
      </n-button>
    </div>

    <!-- Port List -->
    <div v-if="filteredProcesses.length > 0" class="port-list">
      <div class="port-header">
        <span class="name-col">{{ t("task.processName") }}</span>
        <span class="pid-col">{{ t("task.pid") }}</span>
        <span class="port-col">{{ t("task.port") }}</span>
        <span class="action-col"></span>
      </div>
      <div
        v-for="proc in filteredProcesses"
        :key="proc.pid"
        class="port-item"
      >
        <span class="name-col" :title="proc.command">{{ proc.name }}</span>
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
            {{ t("task.killProcess") }}
          </n-button>
        </span>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="no-ports">
      <p>{{ t("task.noPortsFound") }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { NInput, NButton, NTag, useMessage } from "naive-ui";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const message = useMessage();

const portFilter = ref("");

const demoProcesses = ref([
  { pid: 12345, name: "node", command: "node server.js", ports: [5173, 5174] },
  { pid: 12346, name: "vite", command: "vite --port 6173", ports: [6173] },
  { pid: 12347, name: "nginx", command: "nginx -g daemon off", ports: [80, 443] },
  { pid: 12348, name: "python", command: "python -m http.server", ports: [8000] },
  { pid: 12349, name: "go", command: "go run main.go", ports: [8080, 8081] },
  { pid: 12350, name: "rust", command: "cargo run", ports: [3000] },
  { pid: 12351, name: "postgres", command: "postgres -D /var/lib/postgresql/data", ports: [5432] },
  { pid: 12352, name: "redis", command: "redis-server", ports: [6379] },
  { pid: 12353, name: "mongodb", command: "mongod --dbpath /data/db", ports: [27017] },
  { pid: 12354, name: "mysql", command: "mysqld", ports: [3306] },
  { pid: 12355, name: "docker", command: "dockerd", ports: [2375, 2376] },
  { pid: 12356, name: "vite", command: "vite", ports: [5173] },
]);

const filteredProcesses = computed(() => {
  if (!portFilter.value) return demoProcesses.value;
  const filter = portFilter.value.trim().toLowerCase();
  return demoProcesses.value.filter(
    (p) =>
      p.ports.some((port) => String(port).includes(filter)) ||
      p.name.toLowerCase().includes(filter) ||
      String(p.pid).includes(filter)
  );
});

const handleKillProcess = (pid: number) => {
  message.success(t("website.demo.processKilled"));
  demoProcesses.value = demoProcesses.value.filter((p) => p.pid !== pid);
};

const handleRefresh = () => {
  message.info(t("website.demo.portsRefreshed"));
};
</script>
