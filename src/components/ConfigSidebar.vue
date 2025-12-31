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
  <n-layout-sider
    v-show="uiStore.sidebarVisible"
    bordered
    :width="280"
    class="sidebar-layout"
  >
    <div class="sidebar-container">
      <!-- Logo and New Config Button -->
      <div class="config-header-container">
        <div class="config-header-content">
          <!-- Logo and New Config Button in one row -->
          <div class="header-row">
            <!-- Logo -->
            <img
              :src="effectiveTheme === 'light' ? '/logo.svg' : '/logo-dark.svg'"
              alt="Logo"
              class="logo-image"
            />
            <!-- New Config Button -->
            <n-space :size="8">
              <n-button
                type="default"
                @click="handleNewConfigClick"
                @mousedown.stop
                id="new-config-button"
              >
                {{ t("sidebar.newConfig") }}
              </n-button>
              <!-- Import Button -->
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button
                    type="default"
                    @click="showImportDialog = true"
                    @mousedown.stop
                  >
                    <template #icon>
                      <n-icon size="16">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                      </n-icon>
                    </template>
                  </n-button>
                </template>
                {{ t('import.importButton') }}
              </n-tooltip>
            </n-space>
          </div>
        </div>
      </div>
      <!-- Run configuration list -->
      <div class="config-list-container">
        <n-scrollbar>
          <n-list class="config-list">
          <n-tooltip
            v-for="config in runConfigs"
            :key="config.id"
            placement="right"
            trigger="hover"
          >
            <template #trigger>
              <n-list-item
                class="config-list-item"
              >
                <div class="config-item-content">
                  <!-- Icon and main content -->
                  <div class="config-main-row">
                    <!-- Program icon -->
                    <div class="config-icon">
                      <div class="program-icon">
                        {{ getProgramIcon(config.command) }}
                      </div>
                    </div>

                    <!-- Config info -->
                    <div class="config-info">
                      <div class="config-header">
                        <span class="config-name">{{ config.name }}</span>
                        <div class="config-actions">
                          <n-button
                            size="small"
                            text
                            @click.stop="() => handleRunConfigClick(config)"
                            @mousedown.stop
                            class="action-button run-button"
                            title="启动"
                          >
                            <template #icon>
                              <component :is="iconComponents.play" />
                            </template>
                          </n-button>
                          <n-button
                            size="small"
                            text
                            @click.stop="() => handleEditConfigClick(config)"
                            @mousedown.stop
                            class="action-button edit-button"
                            title="修改"
                          >
                            <template #icon>
                              <component :is="iconComponents.edit" />
                            </template>
                          </n-button>
                        </div>
                      </div>
                      <n-text depth="3" class="config-command">{{
                        config.command
                      }}</n-text>
                    </div>
                  </div>
                </div>
              </n-list-item>
            </template>
            <div class="config-tooltip">
              <div class="tooltip-title">{{ config.name }}</div>
              <div class="tooltip-command">{{ config.command }}</div>
            </div>
          </n-tooltip>
        </n-list>
        </n-scrollbar>
      </div>
    </div>
  </n-layout-sider>

  <!-- Import Tasks Dialog -->
  <ImportTasksDialog
    v-model:show="showImportDialog"
    @import="handleImportTasks"
  />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import {
  NLayoutSider,
  NSpace,
  NButton,
  NScrollbar,
  NList,
  NListItem,
  NText,
  NTooltip,
  NIcon,
} from "naive-ui";
import ImportTasksDialog from "./ImportTasksDialog.vue";
import { useI18n } from "vue-i18n";
import { useUIStore } from "../stores/ui";
import { useRunConfigStore } from "../stores/runConfig";
import { useTheme } from "../composables/useTheme";
import { iconComponents } from "../utils/icons";
import { getProgramIcon } from "../utils/programUtils";
import {
  handleNewConfig,
  handleRunConfig,
  handleEditConfig,
} from "../utils/configUtils";
import type { RunConfig } from "../stores/runConfig";

const { t } = useI18n();
const uiStore = useUIStore();
const runConfigStore = useRunConfigStore();
const { effectiveTheme } = useTheme();
const { editingConfig, configDialogVisible } = storeToRefs(uiStore);

const runConfigs = computed(() => runConfigStore.configs);

// Import dialog state
const showImportDialog = ref(false);

const handleNewConfigClick = () => {
  handleNewConfig(editingConfig, configDialogVisible);
};

const handleRunConfigClick = (config: RunConfig) => {
  handleRunConfig(
    config,
    runConfigStore,
    () => {
      // This will be handled by the parent component
    }
  );
};

const handleEditConfigClick = (config: RunConfig) => {
  handleEditConfig(config, editingConfig, configDialogVisible);
};

const handleImportTasks = async (configs: any[]) => {
  try {
    await runConfigStore.importConfigs(configs);
  } catch (error) {
    console.error('Failed to import configs:', error);
  }
};
</script>
