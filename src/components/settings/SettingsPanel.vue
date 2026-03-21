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
    <div v-if="showTabBar" class="settings-inline-tab-bar">
      <n-space :size="4" class="settings-inline-tabs">
        <n-button
          v-for="tab in settingsHeaderTabs"
          :key="tab.name"
          size="small"
          quaternary
          :type="activeTab === tab.name ? 'primary' : 'default'"
          @click="activeTab = tab.name"
        >
          {{ tab.label }}
        </n-button>
      </n-space>
    </div>
    <div class="settings-panel-body">
      <div v-show="activeTab === 'general'" class="settings-tab-pane">
        <n-form label-placement="left" label-width="auto" class="compact-settings-form">
          <n-form-item :label="t('settings.showTaskIcons')">
            <n-switch v-model:value="settingsStore.settings.showTaskIcons" />
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

          <n-divider title-placement="left">{{ t('settings.logs') }}</n-divider>
          <n-form-item :label="t('settings.saveLogs')">
            <n-switch v-model:value="settingsStore.settings.saveLogs" />
          </n-form-item>
          <n-form-item :label="t('settings.maxLogFiles')">
            <n-input-number
              v-model:value="settingsStore.settings.maxLogFiles"
              :min="10"
              :max="1000"
              style="width: 120px;"
            />
          </n-form-item>

          <n-divider title-placement="left">{{ t('settings.security') }}</n-divider>

          <template v-if="currentPlatform !== 'windows'">
            <n-form-item>
              <template #label>
                <n-space align="center" :size="6" :wrap="false">
                  <span>{{ t('settings.sudoPassword') }}</span>
                  <n-tooltip trigger="hover" placement="top" :style="{ maxWidth: '380px' }">
                    <template #trigger>
                      <n-icon size="18" class="sudo-security-warning-icon">
                        <WarningOutline />
                      </n-icon>
                    </template>
                    <div class="sudo-security-tooltip">
                      <div class="sudo-security-tooltip__title">{{ t('settings.sudoPasswordWarning') }}</div>
                      <div class="sudo-security-tooltip__body">{{ t('settings.sudoPasswordWarningContent') }}</div>
                    </div>
                  </n-tooltip>
                </n-space>
              </template>
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
        </n-form>
      </div>

      <div v-show="activeTab === 'icons'" class="settings-tab-pane">
        <CommandIconSettings v-model="settingsStore.settings.commandIcons" />
      </div>

      <div v-show="activeTab === 'aitools'" class="settings-tab-pane">
        <AIToolsPanel />
      </div>

      <div
        v-if="featureFlagsStore.flags.ssh"
        v-show="activeTab === 'ssh'"
        class="settings-tab-pane"
      >
        <SshPanel />
      </div>

      <div v-show="activeTab === 'mcp'" class="settings-tab-pane">
        <MCPPanel />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  NForm,
  NFormItem,
  NSelect,
  NSwitch,
  NInputNumber,
  NRadio,
  NRadioGroup,
  NButton,
  NSpace,
  NTooltip,
  NIcon,
  NDivider,
  NInput,
  useMessage,
} from 'naive-ui';
import { WarningOutline } from '@vicons/ionicons5';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../stores/settings';
import { useSettingsHeaderTabs } from '../../composables/useSettingsHeaderTabs';
import { getAdapter, detectBackendType } from '../../adapters';
import { useFeatureFlagsStore } from '../../stores/featureFlags';
import type { SystemTerminalInfo, ShellInfo } from '../../adapters/types';
import CommandIconSettings from '../CommandIconSettings.vue';
import AIToolsPanel from './AIToolsPanel.vue';
import SshPanel from './SshPanel.vue';
import MCPPanel from './MCPPanel.vue';

withDefaults(
  defineProps<{
    showTabBar?: boolean;
  }>(),
  { showTabBar: false },
);

const { t } = useI18n();
const message = useMessage();
const settingsStore = useSettingsStore();
const featureFlagsStore = useFeatureFlagsStore();
const { settingsHeaderTabs } = useSettingsHeaderTabs();

const activeTab = defineModel<string>('activeTab', { default: 'general' });

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

const loadAvailableTerminals = async () => {
  loadingTerminals.value = true;
  try {
    const adapter = await getAdapter();
    const terminals = await adapter.system.getAvailableTerminals();
    availableTerminals.value = terminals;
    // In server mode backend returns [] by design; do not warn
    if (terminals.length === 0 && detectBackendType() !== 'server') {
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

const detectPlatform = async () => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) {
    currentPlatform.value = "windows";
  } else if (ua.includes("mac")) {
    currentPlatform.value = "macos";
  } else {
    currentPlatform.value = "linux";
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

onMounted(async () => {
  await detectPlatform();
  await Promise.all([loadAvailableTerminals(), loadAvailableShells()]);
  
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
}

.settings-inline-tab-bar {
  flex-shrink: 0;
  padding: 8px 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.settings-inline-tabs {
  flex-wrap: wrap;
}

.settings-panel-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.settings-tab-pane {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-width: 100%;
  box-sizing: border-box;
  height: 100%;
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

.setting-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-left: 8px;
}

:global(.n-config-provider--light) .setting-hint {
  color: rgba(0, 0, 0, 0.45);
}

.sudo-security-warning-icon {
  color: var(--n-warning-color);
  cursor: help;
  flex-shrink: 0;
  vertical-align: middle;
}

.sudo-security-tooltip__title {
  font-weight: 600;
  margin-bottom: 8px;
}

.sudo-security-tooltip__body {
  line-height: 1.5;
  opacity: 0.95;
}
</style>

