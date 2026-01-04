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
    preset="card"
    :title="t('task.settings')"
    style="width: 680px;"
    :segmented="{ content: true }"
    class="compact-modal"
    to="body"
  >
    <n-tabs v-model:value="activeTab" type="line" animated>
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
          <n-form-item :label="t('settings.recentTasksCount')">
            <n-input-number 
              v-model:value="settingsStore.settings.recentTasksCount" 
              :min="0" 
              :max="20" 
              style="width: 120px;"
            />
            <span class="setting-hint">{{ t('settings.recentTasksCountHint') }}</span>
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
import { ref, computed, watch, onMounted } from 'vue';
import {
  NModal,
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
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../../stores/settings';
import { useUpdaterStore } from '../../stores/updater';
import { useLocale } from '../../composables/useLocale';
import CommandIconSettings from '../CommandIconSettings.vue';
import DevLogViewer from '../DevLogViewer.vue';

interface ReleaseNote {
  tag: string;
  date: string;
  body: string;
}

const props = defineProps<{
  show: boolean;
  initialTab?: string;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

const { t } = useI18n();
const settingsStore = useSettingsStore();
const updaterStore = useUpdaterStore();
const { localeMode, getLocalizedOptions, setLocale } = useLocale();

const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

const activeTab = ref('general');
const currentVersion = ref('');
const updateChecked = ref(false);
const releaseNotes = ref<ReleaseNote[] | null>(null);
const loadingReleaseNotes = ref(false);

const currentLanguage = ref(localeMode.value);
const languageOptions = computed(() => getLocalizedOptions());

const handleLanguageChange = (value: string) => {
  setLocale(value);
  currentLanguage.value = value;
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

// Auto-save settings when they change
watch(
  () => settingsStore.settings,
  async () => {
    await settingsStore.saveSettings();
  },
  { deep: true }
);

// Set initial tab when dialog opens
watch(showDialog, async (show) => {
  if (show && props.initialTab) {
    activeTab.value = props.initialTab;
  }
});

onMounted(async () => {
  currentVersion.value = await updaterStore.getCurrentVersion();
});

// Expose method to set active tab
defineExpose({
  setActiveTab: (tab: string) => {
    activeTab.value = tab;
  },
});
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

.setting-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-left: 8px;
}

:global(.n-config-provider--light) .setting-hint {
  color: rgba(0, 0, 0, 0.45);
}
</style>
