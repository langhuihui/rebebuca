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
          @click="handleCloseWindow"
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
          @click="handleCloseWindow"
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
    preset="card"
    :title="t('task.settings')"
    style="width: 680px;"
    :segmented="{ content: true }"
    class="compact-modal"
  >
    <n-tabs v-model:value="activeSettingsTab" type="line" animated>
      <n-tab-pane name="general" :tab="t('settings.general')">
        <n-form label-placement="left" label-width="auto" class="compact-settings-form">
          <n-form-item :label="t('settings.language')">
            <n-select
              v-model:value="currentLanguage"
              :options="languageOptions"
              style="width: 180px;"
              @update:value="handleLanguageChange"
            />
          </n-form-item>
          <n-form-item :label="t('settings.saveLogs')">
            <n-switch v-model:value="settingsStore.settings.saveLogs" />
          </n-form-item>
          <n-form-item :label="t('settings.maxLogFiles')">
            <n-input-number v-model:value="settingsStore.settings.maxLogFiles" :min="10" :max="1000" style="width: 120px;" />
          </n-form-item>
          <n-form-item :label="t('settings.confirmBeforeClose')">
            <n-switch v-model:value="settingsStore.settings.confirmBeforeClose" />
          </n-form-item>
          <n-form-item :label="t('settings.closeButtonBehavior')">
            <n-radio-group v-model:value="settingsStore.settings.closeButtonBehavior">
              <n-radio value="exit">{{ t('settings.closeButtonExit') }}</n-radio>
              <n-radio value="hide">{{ t('settings.closeButtonHide') }}</n-radio>
            </n-radio-group>
          </n-form-item>
          <n-form-item :label="t('settings.autoExpandFolders')">
            <n-switch v-model:value="settingsStore.settings.autoExpandFolders" />
          </n-form-item>
          <n-form-item :label="t('settings.showTaskIcons')">
            <n-switch v-model:value="settingsStore.settings.showTaskIcons" />
          </n-form-item>
        </n-form>
      </n-tab-pane>
      <n-tab-pane name="icons" :tab="t('settings.commandIcons')">
        <CommandIconSettings v-model="settingsStore.settings.commandIcons" />
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
            
            <!-- Release Notes -->
            <n-divider title-placement="left">{{ t('settings.releaseNotes') }}</n-divider>
            <div class="release-notes-section">
              <n-spin :show="loadingReleaseNotes">
                <div v-if="releaseNotes" class="release-notes-content">
                  <div v-for="release in releaseNotes" :key="release.tag" class="release-item">
                    <div class="release-header">
                      <span class="release-tag">{{ release.tag }}</span>
                      <span class="release-date">{{ release.date }}</span>
                    </div>
                    <div class="release-body" v-html="release.body"></div>
                  </div>
                </div>
                <div v-else class="no-release-notes">
                  <n-button size="small" @click="fetchReleaseNotes">
                    {{ t('settings.loadReleaseNotes') }}
                  </n-button>
                </div>
              </n-spin>
            </div>
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
import { ref, watch, onMounted, computed, onUnmounted } from "vue";
import { NButton, NDropdown, NModal, NForm, NFormItem, NSwitch, NInputNumber, NTabs, NTabPane, NSpace, NAlert, NSpin, NSelect, NDivider, NRadio, NRadioGroup } from "naive-ui";
import CommandIconSettings from "./CommandIconSettings.vue";
import DevLogViewer from "./DevLogViewer.vue";
import { useI18n } from "vue-i18n";
import { useUIStore } from "../stores/ui";
import { useRunConfigStore } from "../stores/runConfig";
import { useUpdaterStore } from "../stores/updater";
import { useTheme } from "../composables/useTheme";
import { useLocale } from "../composables/useLocale";
import { useSettingsStore } from "../stores/settings";
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
const { localeMode, getLocalizedOptions, setLocale } = useLocale();

// Language state
const currentLanguage = ref(localeMode.value);
const languageOptions = computed(() => getLocalizedOptions());

// Handle language change
const handleLanguageChange = (value: string) => {
  setLocale(value);
  currentLanguage.value = value;
};

// Settings dialog state
const showSettingsDialog = ref(false);
const activeSettingsTab = ref('general');

// Update state
const currentVersion = ref('');
const updateChecked = ref(false);

// Release notes state
interface ReleaseNote {
  tag: string;
  date: string;
  body: string;
}
const releaseNotes = ref<ReleaseNote[] | null>(null);
const loadingReleaseNotes = ref(false);

// Open settings to update tab
const openSettingsUpdate = () => {
  activeSettingsTab.value = 'update';
  showSettingsDialog.value = true;
};

// Initialize settings
onMounted(async () => {
  await settingsStore.initialize();
  currentVersion.value = await updaterStore.getCurrentVersion();
  
  // Listen for open-settings-update event
  window.addEventListener('open-settings-update', openSettingsUpdate);
});

// Cleanup
onUnmounted(() => {
  window.removeEventListener('open-settings-update', openSettingsUpdate);
});

// Auto-save settings when they change
watch(
  () => settingsStore.settings,
  async () => {
    await settingsStore.saveSettings();
  },
  { deep: true }
);

const handleThemeSelect = (key: string) => {
  setThemeMode(key as "light" | "dark" | "system");
};

const toggleSidebar = () => {
  uiStore.toggleSidebar();
};

// Handle close window with setting check
const handleCloseWindow = async () => {
  const behavior = settingsStore.settings.closeButtonBehavior || 'exit';
  
  if (behavior === 'hide') {
    // Hide window (minimize to tray)
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      await appWindow.hide();
    } catch (error) {
      console.error('Failed to hide window:', error);
      // Fallback to close
      await closeWindow();
    }
  } else {
    // Default: exit (close window)
    await closeWindow();
  }
};

// Open logs folder
const openLogsFolder = async () => {
  try {
    await runConfigStore.openLogsFolder();
  } catch (error) {
    console.error('Failed to open logs folder:', error);
  }
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

// Fetch release notes from GitHub
const fetchReleaseNotes = async () => {
  loadingReleaseNotes.value = true;
  try {
    const response = await fetch('https://api.github.com/repos/langhuihui/rebebuca/releases?per_page=10');
    if (!response.ok) throw new Error('Failed to fetch releases');
    const releases = await response.json();
    releaseNotes.value = releases.map((release: { tag_name: string; published_at: string; body: string }) => ({
      tag: release.tag_name,
      date: new Date(release.published_at).toLocaleDateString(),
      body: release.body || t('settings.noReleaseNotes')
    }));
  } catch (error) {
    console.error('Failed to fetch release notes:', error);
    releaseNotes.value = [];
  } finally {
    loadingReleaseNotes.value = false;
  }
};
</script>

<style scoped lang="scss">
.compact-settings-form {
  padding: 8px 0;
  
  :deep(.n-form-item) {
    margin-bottom: 8px;
    
    .n-form-item-label {
      padding-right: 12px;
    }
  }
  
  :deep(.n-form-item:last-child) {
    margin-bottom: 0;
  }
}

.compact-modal {
  :deep(.n-card-header) {
    padding: 12px 20px;
  }
  
  :deep(.n-card__content) {
    padding: 12px 20px 20px;
  }
}

.update-section {
  padding: 12px 0;
  
  .update-notes {
    margin-top: 8px;
    white-space: pre-wrap;
    font-size: 13px;
    color: var(--n-text-color-2);
  }
}

.release-notes-section {
  min-height: 100px;
  max-height: 300px;
  overflow-y: auto;
  
  .release-notes-content {
    padding: 4px 0;
  }
  
  .release-item {
    padding: 12px;
    margin-bottom: 12px;
    background: var(--n-color-embedded);
    border-radius: 6px;
    border: 1px solid var(--n-border-color);
    
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  .release-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    
    .release-tag {
      font-weight: 600;
      font-size: 14px;
      color: var(--n-text-color-1);
    }
    
    .release-date {
      font-size: 12px;
      color: var(--n-text-color-3);
    }
  }
  
  .release-body {
    font-size: 13px;
    line-height: 1.6;
    color: var(--n-text-color-2);
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  .no-release-notes {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80px;
  }
}
</style>
