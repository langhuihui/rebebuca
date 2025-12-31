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
  <div class="custom-titlebar" @mousedown="startDrag">
    <div class="titlebar-content" :class="{ 'windows-layout': uiStore.isWindowsPlatform }">
      <!-- Left side for Windows title logo -->
      <div class="titlebar-left" v-if="uiStore.isWindowsPlatform">
        <img
          :src="effectiveTheme === 'light' ? '/text.svg' : '/text.svg'"
          alt="Rebebuca"
          :class="
            effectiveTheme === 'light' ? 'text-logo-light' : 'text-logo-dark'
          "
          class="title-logo"
        />
      </div>

      <!-- Title center for Windows platform -->
      <div class="titlebar-center" v-if="uiStore.isWindowsPlatform">
        <span v-if="uiStore.selectedHistoryItem" class="history-title-display">
          {{ uiStore.selectedHistoryItem.name }}
        </span>
      </div>

      <!-- Window controls - macOS style on the left -->
      <div
        v-if="!uiStore.isWindowsPlatform"
        class="window-controls"
      >
        <button
          class="window-control-button close-btn"
          @click="closeWindow"
          @mousedown.stop
          title="关闭"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M1 1l8 8M9 1l-8 8"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <button
          class="window-control-button minimize-btn"
          @click="minimizeWindow"
          @mousedown.stop
          title="最小化"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="1" y="4.5" width="8" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          class="window-control-button maximize-btn"
          @click="toggleMaximize"
          @mousedown.stop
          title="最大化"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect
              x="1"
              y="1"
              width="8"
              height="8"
              stroke="currentColor"
              stroke-width="1"
              fill="none"
            />
          </svg>
        </button>
      </div>

      <!-- Title only for non-Windows -->
      <div class="titlebar-center" v-if="!uiStore.isWindowsPlatform">
        <img
          v-if="!uiStore.selectedHistoryItem"
          :src="effectiveTheme === 'light' ? '/text.svg' : '/text.svg'"
          alt="Rebebuca"
          :class="
            effectiveTheme === 'light' ? 'text-logo-light' : 'text-logo-dark'
          "
          class="title-logo"
        />
        <span v-else class="history-title-display">
          {{ uiStore.selectedHistoryItem.name }}
        </span>
      </div>

      <!-- Right buttons -->
      <div class="titlebar-right">
        <n-dropdown
          :options="uiStore.themeOptions"
          @select="handleThemeSelect"
          trigger="click"
        >
          <n-button
            text
            size="small"
            class="titlebar-button"
            :title="t('titlebar.toggleTheme')"
            @mousedown.stop
          >
            <template #icon>
              <component
                :is="
                  effectiveTheme === 'light'
                    ? iconComponents.sun
                    : iconComponents.moon
                "
              />
            </template>
          </n-button>
        </n-dropdown>
        <n-button
          text
          size="small"
          @click="toggleSidebar"
          class="titlebar-button"
          :title="t('titlebar.toggleSidebar')"
          @mousedown.stop
        >
          <template #icon>
            <component :is="iconComponents.sidebar" />
          </template>
        </n-button>
        <n-button
          text
          size="small"
          @click="openLogsFolder"
          class="titlebar-button"
          :title="t('history.openLogsFolder')"
          @mousedown.stop
        >
          <template #icon>
            <component :is="svgIcons.folderOpen" />
          </template>
        </n-button>
        <n-button
          text
          size="small"
          @click="showSettingsDialog = true"
          class="titlebar-button"
          :title="t('task.settings')"
          @mousedown.stop
        >
          <template #icon>
            <component :is="svgIcons.settings" />
          </template>
        </n-button>
      </div>

      <!-- Window controls - Windows style on the right -->
      <div
        v-if="uiStore.isWindowsPlatform"
        class="window-controls windows-style"
      >
        <button
          class="window-control-button minimize-btn"
          @click="minimizeWindow"
          @mousedown.stop
          title="最小化"
        >
          <span>−</span>
        </button>
        <button
          class="window-control-button maximize-btn"
          @click="toggleMaximize"
          @mousedown.stop
          title="最大化"
        >
          <span>□</span>
        </button>
        <button
          class="window-control-button close-btn"
          @click="closeWindow"
          @mousedown.stop
          title="关闭"
        >
          <span>×</span>
        </button>
      </div>
    </div>
  </div>
  
  <!-- Settings Dialog -->
  <n-modal 
    v-model:show="showSettingsDialog"
    preset="dialog"
    :title="t('task.settings')"
    :positive-text="t('common.save')"
    :negative-text="t('common.cancel')"
    style="width: 680px;"
    @positive-click="handleSaveSettings"
  >
    <n-tabs type="line" animated>
      <n-tab-pane name="general" :tab="t('settings.general')">
        <n-form label-placement="left" label-width="140px" style="padding-top: 12px;">
          <n-divider title-placement="left">{{ t('settings.logs') }}</n-divider>
          <n-form-item :label="t('settings.saveLogs')">
            <n-switch v-model:value="tempSettings.saveLogs" />
          </n-form-item>
          <n-form-item :label="t('settings.maxLogFiles')">
            <n-input-number v-model:value="tempSettings.maxLogFiles" :min="10" :max="1000" />
          </n-form-item>
          
          <n-divider title-placement="left">{{ t('settings.behavior') }}</n-divider>
          <n-form-item :label="t('settings.confirmBeforeClose')">
            <n-switch v-model:value="tempSettings.confirmBeforeClose" />
          </n-form-item>
          <n-form-item :label="t('settings.autoExpandFolders')">
            <n-switch v-model:value="tempSettings.autoExpandFolders" />
          </n-form-item>
          
          <n-divider title-placement="left">{{ t('settings.ui') }}</n-divider>
          <n-form-item :label="t('settings.showTaskIcons')">
            <n-switch v-model:value="tempSettings.showTaskIcons" />
          </n-form-item>
          <n-form-item :label="t('settings.compactMode')">
            <n-switch v-model:value="tempSettings.compactMode" />
          </n-form-item>
        </n-form>
      </n-tab-pane>
      <n-tab-pane name="icons" :tab="t('settings.commandIcons')">
        <CommandIconSettings v-model="tempSettings.commandIcons" />
      </n-tab-pane>
      <n-tab-pane name="update" :tab="t('settings.update')">
        <div class="update-section">
          <n-space vertical>
            <n-space align="center">
              <span>{{ t('settings.currentVersion') }}: {{ currentVersion || '...' }}</span>
              <n-button 
                size="small" 
                :loading="updaterStore.checking"
                @click="checkForUpdates"
              >
                {{ t('settings.checkUpdate') }}
              </n-button>
            </n-space>
            
            <n-alert v-if="updaterStore.updateAvailable && updaterStore.updateInfo" type="success">
              <template #header>
                {{ t('settings.updateAvailable') }}: v{{ updaterStore.updateInfo.version }}
              </template>
              <div v-if="updaterStore.updateInfo.body" class="update-notes">
                {{ updaterStore.updateInfo.body }}
              </div>
              <n-space style="margin-top: 12px;">
                <n-button 
                  type="primary" 
                  size="small"
                  :loading="updaterStore.downloading"
                  @click="downloadUpdate"
                >
                  {{ updaterStore.downloading ? `${t('settings.downloading')} ${updaterStore.downloadProgress}%` : t('settings.downloadAndInstall') }}
                </n-button>
              </n-space>
            </n-alert>
            
            <n-alert v-else-if="updateChecked && !updaterStore.updateAvailable" type="info">
              {{ t('settings.noUpdate') }}
            </n-alert>
            
            <n-alert v-if="updaterStore.error" type="error">
              {{ updaterStore.error }}
            </n-alert>
          </n-space>
        </div>
      </n-tab-pane>
      <n-tab-pane name="devlog" :tab="t('settings.devLog')">
        <DevLogViewer />
      </n-tab-pane>
    </n-tabs>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted } from "vue";
import { NButton, NDropdown, NModal, NForm, NFormItem, NSwitch, NInputNumber, NDivider, NTabs, NTabPane, NSpace, NAlert } from "naive-ui";
import CommandIconSettings from "./CommandIconSettings.vue";
import DevLogViewer from "./DevLogViewer.vue";
import { useI18n } from "vue-i18n";
import { useUIStore } from "../stores/ui";
import { useRunConfigStore } from "../stores/runConfig";
import { useUpdaterStore } from "../stores/updater";
import { useTheme } from "../composables/useTheme";
import { useSettingsStore, type AppSettings } from "../stores/settings";
import { iconComponents, svgIcons } from "../utils/icons";
import {
  minimizeWindow,
  toggleMaximize,
  closeWindow,
  startDrag,
} from "../utils/windowControls";

interface Props {
  effectiveTheme: string;
}

defineProps<Props>();

const { t } = useI18n();
const uiStore = useUIStore();
const runConfigStore = useRunConfigStore();
const settingsStore = useSettingsStore();
const updaterStore = useUpdaterStore();
const { setThemeMode } = useTheme();

// Settings dialog state
const showSettingsDialog = ref(false);
const tempSettings = reactive<AppSettings>({
  saveLogs: true,
  maxLogFiles: 100,
  confirmBeforeClose: true,
  autoExpandFolders: true,
  showTaskIcons: true,
  compactMode: false,
  commandIcons: {},
});

// Update state
const currentVersion = ref('');
const updateChecked = ref(false);

// Initialize settings
onMounted(async () => {
  await settingsStore.initialize();
  Object.assign(tempSettings, settingsStore.settings);
  currentVersion.value = await updaterStore.getCurrentVersion();
});

// Watch settings dialog open
watch(showSettingsDialog, (newVal) => {
  if (newVal) {
    Object.assign(tempSettings, settingsStore.settings);
  }
});

const handleThemeSelect = (key: string) => {
  setThemeMode(key as "light" | "dark" | "system");
};

const toggleSidebar = () => {
  uiStore.toggleSidebar();
};

// Open logs folder
const openLogsFolder = async () => {
  try {
    await runConfigStore.openLogsFolder();
  } catch (error) {
    console.error('Failed to open logs folder:', error);
  }
};

// Handle save settings
const handleSaveSettings = async () => {
  Object.assign(settingsStore.settings, tempSettings);
  await settingsStore.saveSettings();
  return true;
};

// Check for updates
const checkForUpdates = async () => {
  updateChecked.value = true;
  await updaterStore.checkForUpdates();
};

// Download and install update
const downloadUpdate = async () => {
  try {
    await updaterStore.downloadAndInstall();
  } catch (error) {
    console.error('Update failed:', error);
  }
};
</script>

<style scoped lang="scss">
.update-section {
  padding: 12px 0;
  
  .update-notes {
    margin-top: 8px;
    white-space: pre-wrap;
    font-size: 13px;
    color: var(--n-text-color-2);
  }
}
</style>
