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
  <div class="settings-panel">
    <n-tabs v-model:value="activeTab" type="line" animated>
      <n-tab-pane name="general" :tab="t('settings.general')">
        <n-form label-placement="left" label-width="auto" class="compact-settings-form">
          <n-form-item :label="t('settings.language')">
            <n-radio-group
              v-model:value="currentLanguage"
              @update:value="handleLanguageChange"
            >
              <n-radio
                v-for="option in languageOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </n-radio>
            </n-radio-group>
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
          <n-form-item :label="t('settings.showTaskIcons')">
            <n-switch v-model:value="settingsStore.settings.showTaskIcons" />
          </n-form-item>
          <n-form-item :label="t('settings.recentTasksCount')">
            <n-input-number 
              v-model:value="settingsStore.settings.recentTasksCount" 
              :min="0" 
              :max="20" 
              style="width: 120px;"
            />
            <span class="setting-hint">{{ t('settings.recentTasksCountHint') }}</span>
          </n-form-item>
          <n-form-item :label="t('settings.preferredTerminal')">
            <n-select
              v-model:value="settingsStore.settings.preferredTerminal"
              :options="terminalOptions"
              :loading="loadingTerminals"
              clearable
              style="width: 280px;"
              :placeholder="t('settings.preferredTerminalPlaceholder')"
            />
            <span class="setting-hint">{{ t('settings.preferredTerminalHint') }}</span>
          </n-form-item>
          <n-form-item :label="t('settings.preferredShell')">
            <n-select
              v-model:value="settingsStore.settings.preferredShell"
              :options="shellOptions"
              :loading="loadingShells"
              clearable
              style="width: 280px;"
              :placeholder="t('settings.preferredShellPlaceholder')"
            />
            <span class="setting-hint">{{ t('settings.preferredShellHint') }}</span>
          </n-form-item>
        </n-form>
      </n-tab-pane>
      
      <n-tab-pane name="security" :tab="t('settings.security')">
        <n-form label-placement="left" label-width="auto" class="compact-settings-form">
          <n-alert type="warning" :title="t('settings.sudoPasswordWarning')" style="margin-bottom: 16px;">
            {{ t('settings.sudoPasswordWarningContent') }}
          </n-alert>
          
          <n-form-item :label="t('settings.sudoPassword')">
            <n-input
              v-model:value="sudoPasswordInput"
              type="password"
              :placeholder="sudoPasswordPlaceholder"
              show-password-on="click"
              style="width: 280px;"
              @focus="handleSudoPasswordFocus"
              @update:value="handleSudoPasswordChange"
              @blur="handleSudoPasswordBlur"
            />
            <n-button
              v-if="settingsStore.settings.sudoPassword"
              size="small"
              style="margin-left: 8px;"
              @click="clearSudoPassword"
            >
              {{ t('settings.clearSudoPassword') }}
            </n-button>
            <span class="setting-hint" style="display: block; margin-top: 4px;">{{ t('settings.sudoPasswordHint') }}</span>
          </n-form-item>
        </n-form>
      </n-tab-pane>
      
      <n-tab-pane name="logs" :tab="t('settings.logs')">
        <n-form label-placement="left" label-width="auto" class="compact-settings-form">
          <n-form-item :label="t('settings.saveLogs')">
            <n-switch v-model:value="settingsStore.settings.saveLogs" />
          </n-form-item>
          <n-form-item :label="t('settings.maxLogFiles')">
            <n-input-number v-model:value="settingsStore.settings.maxLogFiles" :min="10" :max="1000" style="width: 120px;" />
          </n-form-item>
          <n-form-item :label="t('history.openLogsFolder')">
            <n-button size="small" @click="openLogsFolder">
              <template #icon>
                <n-icon>
                  <component :is="svgIcons.folderOpen" />
                </n-icon>
              </template>
              {{ t('history.openLogsFolder') }}
            </n-button>
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
      
      <n-tab-pane name="aitools" :tab="t('settings.aiTools')">
        <AIToolsPanel />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  NTabs,
  NTabPane,
  NForm,
  NFormItem,
  NSelect,
  NSwitch,
  NInputNumber,
  NRadio,
  NRadioGroup,
  NButton,
  NSpace,
  NAlert,
  NDivider,
  NSpin,
  NIcon,
  NInput,
  useMessage,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../stores/settings';
import { useUpdaterStore } from '../../stores/updater';
import { useRunConfigStore } from '../../stores/runConfig';
import { useLocale } from '../../composables/useLocale';
import { getAdapter } from '../../adapters';
import type { SystemTerminalInfo, ShellInfo } from '../../adapters/types';
import { svgIcons } from '../../utils/icons';
import CommandIconSettings from '../CommandIconSettings.vue';
import DevLogViewer from '../DevLogViewer.vue';
import AIToolsPanel from './AIToolsPanel.vue';

interface ReleaseNote {
  tag: string;
  date: string;
  body: string;
}

const props = defineProps<{
  initialTab?: string;
}>();

const { t } = useI18n();
const message = useMessage();
const settingsStore = useSettingsStore();
const updaterStore = useUpdaterStore();
const runConfigStore = useRunConfigStore();
const { localeMode, getLocalizedOptions, setLocale } = useLocale();

const activeTab = ref(props.initialTab || 'general');
const currentVersion = ref('');
const updateChecked = ref(false);
const releaseNotes = ref<ReleaseNote[] | null>(null);
const loadingReleaseNotes = ref(false);

const currentLanguage = ref(localeMode.value);
const languageOptions = computed(() => getLocalizedOptions());

// Sudo password input
const sudoPasswordInput = ref<string>('');
const sudoPasswordDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const sudoPasswordPlaceholder = computed(() => {
  if (settingsStore.settings.sudoPassword) {
    // Show "already set" indicator in the placeholder
    const basePlaceholder = t('settings.sudoPasswordPlaceholder');
    // Simple check: if the placeholder contains Chinese characters, we're in Chinese mode
    if (basePlaceholder.includes('输入')) {
      return basePlaceholder + ' (已设置)';
    } else {
      return basePlaceholder + ' (Set)';
    }
  }
  return t('settings.sudoPasswordPlaceholder');
});

const loadingTerminals = ref(false);
const availableTerminals = ref<SystemTerminalInfo[]>([]);

const terminalOptions = computed(() => {
  return availableTerminals.value.map(terminal => ({
    label: terminal.is_default ? `${terminal.name} (${t('settings.default')})` : terminal.name,
    value: terminal.id,
  }));
});

const loadingShells = ref(false);
const availableShells = ref<ShellInfo[]>([]);

const shellOptions = computed(() => {
  return availableShells.value.map(shell => ({
    label: shell.is_default ? `${shell.name} (${t('settings.default')})` : shell.name,
    value: shell.path,  // Use path as value for PTY creation
  }));
});

const loadAvailableTerminals = async () => {
  loadingTerminals.value = true;
  try {
    const adapter = await getAdapter();
    const terminals = await adapter.system.getAvailableTerminals();
    availableTerminals.value = terminals;
    
    if (terminals.length === 0) {
      message.warning(t('settings.noTerminalsFound'));
    }
  } catch (error) {
    console.error('Failed to load available terminals:', error);
    message.error(t('settings.failedToLoadTerminals'));
  } finally {
    loadingTerminals.value = false;
  }
};

const loadAvailableShells = async () => {
  loadingShells.value = true;
  try {
    const adapter = await getAdapter();
    const shells = await adapter.system.getAvailableShells();
    availableShells.value = shells;
    
    if (shells.length === 0) {
      message.warning(t('settings.noShellsFound'));
    }
  } catch (error) {
    console.error('Failed to load available shells:', error);
    message.error(t('settings.failedToLoadShells'));
  } finally {
    loadingShells.value = false;
  }
};

const handleLanguageChange = (value: string) => {
  setLocale(value);
  currentLanguage.value = value;
};

const openLogsFolder = async () => {
  try {
    await runConfigStore.openLogsFolder();
  } catch (error) {
    console.error('Failed to open logs folder:', error);
    message.error(t('history.openLogsFolder') + ': ' + (error instanceof Error ? error.message : String(error)));
  }
};

const checkForUpdates = async () => {
  updateChecked.value = true;
  await updaterStore.checkForUpdates();
};

const downloadUpdate = async () => {
  try {
    await updaterStore.downloadAndInstall();
  } catch (error) {
    console.error('Update failed:', error);
  }
};

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

// Handle sudo password focus (clear placeholder if it's the placeholder dots)
const handleSudoPasswordFocus = () => {
  // If the input contains only placeholder dots, clear it
  if (sudoPasswordInput.value === '••••••••' || sudoPasswordInput.value.match(/^•+$/)) {
    sudoPasswordInput.value = '';
  }
};

// Handle sudo password change with debounce
const handleSudoPasswordChange = (value: string) => {
  // Don't save if it's the placeholder dots
  if (value === '••••••••' || value.match(/^•+$/)) {
    return;
  }
  
  // Clear existing timer
  if (sudoPasswordDebounceTimer.value) {
    clearTimeout(sudoPasswordDebounceTimer.value);
  }
  
  // Set new timer to save after user stops typing (500ms delay)
  sudoPasswordDebounceTimer.value = setTimeout(async () => {
    await settingsStore.setSudoPassword(value || null);
  }, 500);
};

// Handle sudo password blur (save immediately on blur)
const handleSudoPasswordBlur = async () => {
  // Clear debounce timer
  if (sudoPasswordDebounceTimer.value) {
    clearTimeout(sudoPasswordDebounceTimer.value);
    sudoPasswordDebounceTimer.value = null;
  }
  
  // Don't save if it's the placeholder dots
  if (sudoPasswordInput.value === '••••••••' || sudoPasswordInput.value.match(/^•+$/)) {
    // Restore placeholder if user didn't change it
    if (settingsStore.settings.sudoPassword) {
      sudoPasswordInput.value = '••••••••';
    }
    return;
  }
  
  // Save immediately
  await settingsStore.setSudoPassword(sudoPasswordInput.value || null);
};

// Clear sudo password
const clearSudoPassword = async () => {
  sudoPasswordInput.value = '';
  await settingsStore.setSudoPassword(null);
  message.success(t('settings.clearSudoPassword') + ' ' + t('common.save'));
};

// Auto-save settings when they change
watch(
  () => settingsStore.settings,
  async () => {
    await settingsStore.saveSettings();
  },
  { deep: true }
);

// Watch for initialTab changes
watch(() => props.initialTab, (newTab) => {
  if (newTab) {
    activeTab.value = newTab;
  }
}, { immediate: true });

onMounted(async () => {
  currentVersion.value = await updaterStore.getCurrentVersion();
  await Promise.all([
    loadAvailableTerminals(),
    loadAvailableShells(),
  ]);
  
  // Load sudo password if exists (but don't display the actual password)
  if (settingsStore.settings.sudoPassword) {
    sudoPasswordInput.value = '••••••••'; // Show placeholder dots if password exists
  }
});

// Cleanup timer on unmount
onUnmounted(() => {
  if (sudoPasswordDebounceTimer.value) {
    clearTimeout(sudoPasswordDebounceTimer.value);
  }
});
</script>

<style scoped lang="scss">
.settings-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  :deep(.n-tabs) {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    
    .n-tabs-nav {
      flex-shrink: 0;
      padding: 0 16px;
    }
    
    .n-tabs-nav-wrapper {
      flex-shrink: 0;
    }
    
    .n-tabs-pane-wrapper {
      flex: 1;
      overflow: hidden;
    }
    
    .n-tab-pane {
      flex: 1;
      overflow: hidden;
      padding: 16px;
      display: flex;
      flex-direction: column;
      min-height: 0;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: auto;
      height: 100%;
    }
  }
}

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

.setting-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-left: 8px;
}

:global(.n-config-provider--light) .setting-hint {
  color: rgba(0, 0, 0, 0.45);
}
</style>

