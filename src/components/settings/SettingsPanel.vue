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
              style="width: 250px;"
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
              style="width: 250px;"
              :placeholder="t('settings.preferredShellPlaceholder')"
            />
            <span class="setting-hint">{{ t('settings.preferredShellHint') }}</span>
          </n-form-item>
          <n-form-item :label="t('settings.terminalRenderer')">
            <n-radio-group v-model:value="settingsStore.settings.terminalRenderer">
              <n-radio value="webgl">{{ t('settings.rendererWebgl') }}</n-radio>
              <n-radio value="canvas">{{ t('settings.rendererCanvas') }}</n-radio>
              <n-radio value="dom">{{ t('settings.rendererDom') }}</n-radio>
            </n-radio-group>
            <span class="setting-hint">{{ t('settings.terminalRendererHint') }}</span>
          </n-form-item>

          <n-divider />

          <n-form-item :label="t('task.title')">
            <n-space>
               <n-button @click="handleImportTasks" size="small">
                 <template #icon>
                   <n-icon>
                     <component :is="svgIcons.import" />
                   </n-icon>
                 </template>
                 {{ t('import.importButton') }}
               </n-button>
               <n-button @click="handleExportTasks" size="small">
                 <template #icon>
                   <n-icon>
                     <component :is="svgIcons.export" />
                   </n-icon>
                 </template>
                 {{ t('export.menu') }}
               </n-button>
            </n-space>
          </n-form-item>
        </n-form>
      </n-tab-pane>

      <n-tab-pane name="security" :tab="t('settings.security')">
        <n-form label-placement="left" label-width="auto" class="compact-settings-form">
          <template v-if="currentPlatform !== 'windows'">
            <n-alert type="warning" :title="t('settings.sudoPasswordWarning')" style="margin-bottom: 16px;">
              {{ t('settings.sudoPasswordWarningContent') }}
            </n-alert>

            <n-form-item :label="t('settings.sudoPassword')">
              <n-input
                v-model:value="sudoPasswordInput"
                type="password"
                :placeholder="sudoPasswordPlaceholder"
                show-password-on="click"
                style="width: 250px;"
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
          </template>

          <!-- macOS Full Disk Access -->
          <template v-if="currentPlatform === 'macos'">
            <n-divider />
            <n-form-item :label="t('settings.fullDiskAccess')">
              <n-space align="center">
                <n-tag :type="hasFullDiskAccess ? 'success' : 'warning'" size="small">
                  {{ hasFullDiskAccess ? t('settings.granted') : t('settings.notGranted') }}
                </n-tag>
                <n-button 
                  size="small" 
                  @click="openFullDiskAccessSettings"
                  :type="hasFullDiskAccess ? 'default' : 'primary'"
                >
                  {{ t('settings.openSystemSettings') }}
                </n-button>
                <n-button 
                  size="small" 
                  quaternary
                  @click="checkFullDiskAccess"
                  :loading="checkingFullDiskAccess"
                >
                  {{ t('settings.refresh') }}
                </n-button>
              </n-space>
            </n-form-item>
            <n-alert 
              v-if="!hasFullDiskAccess" 
              type="info" 
              :title="t('settings.fullDiskAccessTip')" 
              style="margin-top: 8px;"
              closable
            >
              {{ t('settings.fullDiskAccessTipContent') }}
            </n-alert>
          </template>
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
              <div class="manual-download-section">
                <span class="manual-download-hint">{{ t('settings.manualDownloadHint') }}</span>
                <a v-if="manualDownloadUrl" :href="manualDownloadUrl" target="_blank" class="manual-download-link">
                  {{ t('settings.manualDownload') }}
                </a>
              </div>
            </n-alert>
            
            <!-- Manual Download Section -->
            <n-divider title-placement="left">{{ t('settings.manualDownload') }}</n-divider>
            <div class="manual-download-info">
              <span class="manual-download-hint">{{ t('settings.manualDownloadHint') }}</span>
              <a v-if="manualDownloadUrl" :href="manualDownloadUrl" target="_blank" class="manual-download-link">
                {{ manualDownloadUrl }}
              </a>
              <span v-else class="manual-download-hint">{{ downloadPlatform === 'linux' ? 'Linux desktop not supported' : 'Loading...' }}</span>
            </div>
            
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
      
      <n-tab-pane v-if="featureFlagsStore.flags.ssh" name="ssh" :tab="t('settings.ssh')">
        <SshPanel />
      </n-tab-pane>
      
      <n-tab-pane name="mcp" tab="MCP">
        <MCPPanel />
      </n-tab-pane>
      
      <!-- Developer options (only visible in development mode) -->
      <n-tab-pane v-if="isDevelopmentMode()" name="developer" :tab="t('settings.developer')">
        <n-form label-placement="left" label-width="auto" class="compact-settings-form">
          <n-alert type="info" style="margin-bottom: 16px;">
            {{ t('settings.developerModeHint') }}
          </n-alert>
          
          <n-form-item :label="t('settings.devOverrideEnabled')">
            <n-switch 
              :value="featureFlagsStore.devOverrideEnabled" 
              @update:value="handleDevOverrideChange"
            />
            <span class="setting-hint">{{ t('settings.devOverrideEnabledHint') }}</span>
          </n-form-item>
          
          <n-divider title-placement="left">{{ t('settings.featureFlags') }}</n-divider>
          
          <n-form-item :label="t('settings.featureAICollab')">
            <n-switch 
              :value="featureFlagsStore.flags.aiCollab"
              :disabled="!featureFlagsStore.devOverrideEnabled"
              @update:value="(val: boolean) => handleFeatureFlagChange('aiCollab', val)"
            />
            <span class="setting-hint">{{ t('settings.featureAICollabHint') }}</span>
          </n-form-item>
          
          <n-form-item :label="t('settings.featureSSH')">
            <n-switch 
              :value="featureFlagsStore.flags.ssh"
              :disabled="!featureFlagsStore.devOverrideEnabled"
              @update:value="(val: boolean) => handleFeatureFlagChange('ssh', val)"
            />
            <span class="setting-hint">{{ t('settings.featureSSHHint') }}</span>
          </n-form-item>
          
          <n-form-item>
            <n-button size="small" @click="resetFeatureFlags">
              {{ t('settings.resetFeatureFlags') }}
            </n-button>
          </n-form-item>
        </n-form>
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
import { saveAs } from 'file-saver';
import { useSettingsStore } from '../../stores/settings';
import { useUpdaterStore, getDownloadUrl, getCurrentPlatform, getCurrentPlatformAsync } from '../../stores/updater';
import { useRunConfigStore } from '../../stores/runConfig';
import { useTaskManagerStore } from '../../stores/taskManager';
import { useLocale } from '../../composables/useLocale';
import { getAdapter, isTauri } from '../../adapters';
import { useFeatureFlagsStore, isDevelopmentMode } from '../../stores/featureFlags';
import type { SystemTerminalInfo, ShellInfo } from '../../adapters/types';
import { svgIcons } from '../../utils/icons';
import CommandIconSettings from '../CommandIconSettings.vue';
import DevLogViewer from '../DevLogViewer.vue';
import AIToolsPanel from './AIToolsPanel.vue';
import SshPanel from './SshPanel.vue';
import MCPPanel from './MCPPanel.vue';

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
const taskManager = useTaskManagerStore();
const featureFlagsStore = useFeatureFlagsStore();
const { localeMode, getLocalizedOptions, setLocale } = useLocale();

const activeTab = ref(props.initialTab || 'general');
const currentVersion = ref('');
const updateChecked = ref(false);
const releaseNotes = ref<ReleaseNote[] | null>(null);
const loadingReleaseNotes = ref(false);

// Current platform for download URL (async loaded, sync fallback)
const downloadPlatform = ref<'mac' | 'windows' | 'linux'>(getCurrentPlatform());

// Initialize platform asynchronously
const initPlatform = async () => {
  downloadPlatform.value = await getCurrentPlatformAsync();
};

// Manual download URL based on current version and platform
const manualDownloadUrl = computed(() => {
  const version = currentVersion.value || updaterStore.currentVersion;
  if (!version) return '';
  return getDownloadUrl(version, downloadPlatform.value);
});

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

// Current platform detection
const currentPlatform = ref<"macos" | "linux" | "windows">("macos");

// Full Disk Access (macOS only)
const hasFullDiskAccess = ref(true);
const checkingFullDiskAccess = ref(false);

const checkFullDiskAccess = async () => {
  if (currentPlatform.value !== 'macos') {
    hasFullDiskAccess.value = true;
    return;
  }
  
  checkingFullDiskAccess.value = true;
  try {
    const adapter = await getAdapter();
    hasFullDiskAccess.value = await adapter.system.checkFullDiskAccess();
  } catch (error) {
    console.error('Failed to check Full Disk Access:', error);
    // Assume granted if check fails
    hasFullDiskAccess.value = true;
  } finally {
    checkingFullDiskAccess.value = false;
  }
};

const openFullDiskAccessSettings = async () => {
  try {
    const adapter = await getAdapter();
    await adapter.system.openFullDiskAccessSettings();
  } catch (error) {
    console.error('Failed to open Full Disk Access settings:', error);
    message.error(t('settings.failedToOpenSettings'));
  }
};

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

// Detect current platform
const detectPlatform = async () => {
  if (isTauri()) {
    try {
      const os = await import("@tauri-apps/plugin-os");
      const platform = os.platform();
      if (platform === "macos") {
        currentPlatform.value = "macos";
      } else if (platform === "windows") {
        currentPlatform.value = "windows";
      } else {
        currentPlatform.value = "linux";
      }
    } catch {
      currentPlatform.value = "macos";
    }
  } else {
    // Web mode - detect from user agent
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) {
      currentPlatform.value = "windows";
    } else if (ua.includes("mac")) {
      currentPlatform.value = "macos";
    } else {
      currentPlatform.value = "linux";
    }
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

// Handle export tasks
const handleExportTasks = async () => {
  try {
    const json = await taskManager.exportUserGroups();
    const adapter = await getAdapter();
    
    // Check if in Tauri environment
    if (adapter.dialog.saveFile) {
        // Use native save dialog
        const filePath = await adapter.dialog.saveFile({
             title: t('export.title'),
             defaultPath: t('export.filename'),
             filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        
        if (filePath) {
            await adapter.fs.writeTextFile(filePath, json);
            message.success(t('export.success'));
        }
    } else {
        // Fallback to web download
        const blob = new Blob([json], { type: "application/json;charset=utf-8" });
        saveAs(blob, t('export.filename'));
        message.success(t('export.success'));
    }
  } catch (error) {
    console.error('Export failed:', error);
    message.error(t('export.failed'));
  }
};

// Handle import tasks
const handleImportTasks = async () => {
  try {
    const adapter = await getAdapter();
    // Try to use native file dialog if available
    try {
      const selected = await adapter.dialog.selectFile({
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      
      if (selected) {
        const content = await adapter.fs.readTextFile(selected);
        await taskManager.importUserGroups(content, 'merge');
        message.success(t('import.success'));
      }
    } catch {
      // Fallback for web or if dialog fails
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
          const content = e.target?.result as string;
          try {
            await taskManager.importUserGroups(content, 'merge');
            message.success(t('import.success'));
          } catch (err) {
            console.error('Import failed:', err);
            message.error(t('import.failed'));
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }
  } catch (error) {
    console.error('Import failed:', error);
    message.error(t('import.failed'));
  }
};

const fetchReleaseNotes = async () => {
  loadingReleaseNotes.value = true;
  try {
    const response = await fetch('https://download.m7s.live/rb/latest.json');
    if (!response.ok) throw new Error('Failed to fetch release info');
    const release = await response.json();
    releaseNotes.value = [{
      tag: `v${release.version}`,
      date: new Date().toLocaleDateString(),
      body: t('settings.noReleaseNotes')
    }];
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

// Handle dev override toggle
const handleDevOverrideChange = async (enabled: boolean) => {
  await featureFlagsStore.setDevOverrideEnabled(enabled);
};

// Handle feature flag change
const handleFeatureFlagChange = async (feature: 'aiCollab' | 'ssh', enabled: boolean) => {
  await featureFlagsStore.setFeatureFlag(feature, enabled);
};

// Reset feature flags to defaults
const resetFeatureFlags = async () => {
  await featureFlagsStore.resetToDefaults();
  message.success(t('settings.resetFeatureFlagsSuccess'));
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
  await detectPlatform();
  await initPlatform(); // Initialize download platform for manual download URL
  currentVersion.value = await updaterStore.getCurrentVersion();
  await Promise.all([
    loadAvailableTerminals(),
    loadAvailableShells(),
    checkFullDiskAccess(),
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
  
  .manual-download-section {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--n-border-color);
  }
  
  .manual-download-hint {
    font-size: 13px;
    color: var(--n-text-color-2);
    display: block;
    margin-bottom: 4px;
  }
  
  .manual-download-link {
    font-size: 13px;
    color: var(--n-color-primary);
    text-decoration: none;
    word-break: break-all;
    
    &:hover {
      text-decoration: underline;
    }
  }
}

.manual-download-info {
  padding: 12px;
  background: var(--n-color-embedded);
  border-radius: 6px;
  border: 1px solid var(--n-border-color);
  
  .manual-download-hint {
    font-size: 13px;
    color: var(--n-text-color-2);
    display: block;
    margin-bottom: 8px;
  }
  
  .manual-download-link {
    font-size: 13px;
    color: var(--n-color-primary);
    text-decoration: none;
    word-break: break-all;
    
    &:hover {
      text-decoration: underline;
    }
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

