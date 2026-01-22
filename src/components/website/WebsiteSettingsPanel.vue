<!--
 * Rebebuca Website Demo - Settings Panel
 * Copyright (C) 2025 rebebuca contributors
 -->

<template>
  <div class="settings-panel">
    <n-tabs type="line" animated>
      <!-- General Tab -->
      <n-tab-pane name="general" :tab="t('settings.general')">
        <n-form label-placement="left" label-width="auto" class="compact-settings-form">
          <n-form-item :label="t('settings.language')">
            <n-radio-group v-model:value="settings.language" @update:value="handleSettingChange">
              <n-radio v-for="opt in languageOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </n-radio>
            </n-radio-group>
          </n-form-item>
          <n-form-item :label="t('settings.confirmBeforeClose')">
            <n-switch v-model:value="settings.confirmBeforeClose" @update:value="handleSettingChange" />
          </n-form-item>
          <n-form-item :label="t('settings.closeButtonBehavior')">
            <n-radio-group v-model:value="settings.closeButtonBehavior" @update:value="handleSettingChange">
              <n-radio value="exit">{{ t("settings.closeButtonExit") }}</n-radio>
              <n-radio value="hide">{{ t("settings.closeButtonHide") }}</n-radio>
            </n-radio-group>
          </n-form-item>
          <n-form-item :label="t('settings.showTaskIcons')">
            <n-switch v-model:value="settings.showTaskIcons" @update:value="handleSettingChange" />
          </n-form-item>
          <n-form-item :label="t('settings.recentTasksCount')">
            <div style="display: flex; align-items: center; gap: 8px">
              <n-input-number
                v-model:value="settings.recentTasksCount"
                :min="0"
                :max="20"
                style="width: 120px"
                @update:value="handleSettingChange"
              />
              <span class="setting-hint">{{ t("settings.recentTasksCountHint") }}</span>
            </div>
          </n-form-item>
          <n-form-item :label="t('settings.preferredTerminal')">
            <div style="display: flex; flex-direction: column; gap: 4px">
              <n-select
                v-model:value="settings.preferredTerminal"
                :options="terminalOptions"
                :placeholder="t('settings.preferredTerminalPlaceholder')"
                clearable
                style="width: 250px"
                @update:value="handleSettingChange"
              />
              <span class="setting-hint">{{ t("settings.preferredTerminalHint") }}</span>
            </div>
          </n-form-item>
          <n-form-item :label="t('settings.preferredShell')">
            <div style="display: flex; flex-direction: column; gap: 4px">
              <n-select
                v-model:value="settings.preferredShell"
                :options="shellOptions"
                :placeholder="t('settings.preferredShellPlaceholder')"
                clearable
                style="width: 250px"
                @update:value="handleSettingChange"
              />
              <span class="setting-hint">{{ t("settings.preferredShellHint") }}</span>
            </div>
          </n-form-item>
        </n-form>
      </n-tab-pane>

      <!-- Logs Tab -->
      <n-tab-pane name="logs" :tab="t('settings.logs')">
        <n-form label-placement="left" label-width="auto" class="compact-settings-form">
          <n-form-item :label="t('settings.saveLogs')">
            <n-switch v-model:value="settings.saveLogs" @update:value="handleSettingChange" />
          </n-form-item>
          <n-form-item :label="t('settings.maxLogFiles')">
            <n-input-number
              v-model:value="settings.maxLogFiles"
              :min="10"
              :max="1000"
              style="width: 120px"
              @update:value="handleSettingChange"
            />
          </n-form-item>
          <n-form-item :label="t('history.openLogsFolder')">
            <n-button size="small" @click="handleOpenLogsFolder">
              <template #icon>
                <n-icon><folder-open-outline /></n-icon>
              </template>
              {{ t("history.openLogsFolder") }}
            </n-button>
          </n-form-item>
        </n-form>
      </n-tab-pane>

      <!-- Icons Tab -->
      <n-tab-pane name="icons" :tab="t('settings.commandIcons')">
        <div class="command-icon-settings">
          <n-data-table
            :columns="commandIconsColumns"
            :data="commandIconsData"
            size="small"
            :bordered="false"
            :max-height="280"
          />
          <div class="add-mapping">
            <n-input
              v-model:value="newCommand"
              :placeholder="t('settings.commandPlaceholder')"
              size="small"
              style="flex: 1"
            />
            <n-button
              size="small"
              type="primary"
              :disabled="!newCommand.trim()"
              @click="handleAddIcon"
            >
              {{ t("common.add") }}
            </n-button>
          </div>
          <div class="help-text">{{ t("settings.commandIconHelp") }}</div>
        </div>
      </n-tab-pane>

      <!-- Update Tab -->
      <n-tab-pane name="update" :tab="t('settings.update')">
        <div class="update-section">
          <n-space vertical size="large">
            <n-space align="center">
              <span>{{ t("settings.currentVersion") }}: {{ currentVersion }}</span>
              <n-button size="small" :loading="checkingUpdate" @click="handleCheckUpdate">
                {{ t("settings.checkUpdate") }}
              </n-button>
            </n-space>
            <n-alert v-if="updateChecked && !updateAvailable" type="info">
              {{ t("settings.noUpdate") }}
            </n-alert>
            <n-divider title-placement="left">{{ t("settings.releaseNotes") }}</n-divider>
            <div class="release-notes-section">
              <div class="release-notes-content">
                <div v-for="release in releaseNotes" :key="release.tag" class="release-item">
                  <div class="release-header">
                    <span class="release-tag">{{ release.tag }}</span>
                    <span class="release-date">{{ release.date }}</span>
                  </div>
                  <div class="release-body">{{ release.body }}</div>
                </div>
              </div>
            </div>
          </n-space>
        </div>
      </n-tab-pane>

      <!-- AI Tools Tab -->
      <n-tab-pane name="aitools" :tab="t('settings.aiTools')">
        <div class="ai-tools-panel">
          <div class="ai-tools-layout">
            <div class="tools-sidebar">
              <div
                v-for="tool in aiTools"
                :key="tool.id"
                class="tool-tab-item"
                :class="{ active: activeToolTab === tool.id }"
                @click="activeToolTab = tool.id"
              >
                <div class="tool-tab-header">
                  <img
                    v-if="tool.logo"
                    :src="tool.logo"
                    :alt="tool.name"
                    :class="['tool-logo', { 'tool-logo-invert-dark': ['opencode', 'augment-cli', 'ampcode', 'kilocode'].includes(tool.id) }]"
                    @error="(e: Event) => ((e.target as HTMLImageElement).style.display = 'none')"
                  />
                  <span>{{ tool.name }}</span>
                </div>
                <div class="tool-version">
                  {{ toolVersions[tool.id] ? `v${toolVersions[tool.id]}` : t("aiTools.notInstalled") }}
                </div>
              </div>
            </div>
            <div class="tools-content">
              <div class="tool-panel">
                <div class="tool-status">
                  <n-tag v-if="currentToolVersion" type="success" size="small">
                    v{{ currentToolVersion }}
                  </n-tag>
                  <n-tag v-else type="warning" size="small">
                    {{ t("aiTools.notInstalled") }}
                  </n-tag>
                  <n-button text size="tiny" @click="handleRecheckInstall">
                    <template #icon>
                      <n-icon size="14"><sync-outline /></n-icon>
                    </template>
                  </n-button>
                </div>
                <div class="tool-info">
                  <span class="website-link" @click="handleOpenWebsite">
                    <n-icon size="12"><add-outline /></n-icon>
                    {{ currentTool?.website }}
                  </span>
                </div>
                <n-divider>{{ t("aiTools.configuration") }}</n-divider>
                <n-space vertical :size="12">
                  <n-form-item :label="t('aiTools.provider')" label-placement="left" :label-width="100">
                    <n-select
                      v-model:value="currentConfig.provider"
                      :options="providerOptions"
                      size="small"
                      style="width: 200px"
                      @update:value="handleSettingChange"
                    />
                  </n-form-item>
                  <n-form-item
                    v-if="currentConfig.provider !== 'original'"
                    :label="t('aiTools.apiKey')"
                    label-placement="left"
                    :label-width="100"
                  >
                    <n-input-group>
                      <n-input
                        v-model:value="currentConfig.apiKey"
                        type="password"
                        show-password-on="click"
                        :placeholder="t('aiTools.apiKeyPlaceholder')"
                        size="small"
                        style="width: 200px"
                      />
                      <n-button size="small" @click="handleGetKey">
                        {{ t("aiTools.getKey") }}
                      </n-button>
                    </n-input-group>
                  </n-form-item>
                  <n-alert
                    v-if="currentConfig.provider !== 'original'"
                    type="default"
                    :bordered="false"
                    size="small"
                  >
                    {{ t("aiTools.keySyncNotice") }}
                  </n-alert>
                </n-space>
              </div>
            </div>
          </div>
        </div>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import {
  NTabs,
  NTabPane,
  NForm,
  NFormItem,
  NRadio,
  NRadioGroup,
  NSwitch,
  NInputNumber,
  NSelect,
  NButton,
  NIcon,
  NDataTable,
  NInput,
  NInputGroup,
  NSpace,
  NDivider,
  NAlert,
  NTag,
  useMessage,
} from "naive-ui";
import { FolderOpenOutline, SyncOutline, AddOutline } from "@vicons/ionicons5";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const message = useMessage();

// Settings state
const settings = reactive({
  language: "zh-CN",
  confirmBeforeClose: true,
  closeButtonBehavior: "exit" as "exit" | "hide",
  showTaskIcons: true,
  recentTasksCount: 5,
  preferredTerminal: "Terminal.app",
  preferredShell: "/bin/zsh",
  saveLogs: true,
  maxLogFiles: 100,
});

const languageOptions = [
  { label: "中文", value: "zh-CN" },
  { label: "English", value: "en" },
];

const terminalOptions = computed(() => [
  { label: `Terminal.app (${t("settings.default")})`, value: "Terminal.app" },
  { label: "iTerm2", value: "iTerm2" },
  { label: "Alacritty", value: "Alacritty" },
]);

const shellOptions = computed(() => [
  { label: `/bin/zsh (${t("settings.default")})`, value: "/bin/zsh" },
  { label: "/bin/bash", value: "/bin/bash" },
  { label: "/bin/fish", value: "/bin/fish" },
]);

// Command icons
const commandIcons = reactive<Record<string, string>>({
  npm: "npm",
  "go build": "go",
  cargo: "rust",
  python: "python",
  node: "nodejs",
  yarn: "yarn",
  pnpm: "pnpm",
  docker: "docker",
});

const commandIconsData = computed(() =>
  Object.entries(commandIcons).map(([command, icon]) => ({ command, icon }))
);

const commandIconsColumns = [
  { title: t("settings.command"), key: "command" },
  { title: t("settings.icon"), key: "icon" },
];

const newCommand = ref("");

// Update state
const currentVersion = ref("0.4.6");
const updateChecked = ref(false);
const updateAvailable = ref(false);
const checkingUpdate = ref(false);

const releaseNotes = ref([
  { tag: "v0.4.6", date: "2025-01-11", body: "🐛 修复 TypeScript 编译错误\n🔧 修复重复图标定义问题" },
  { tag: "v0.4.5", date: "2025-01-10", body: "✨ 新增控制台输出区域\n✨ 优化侧边栏布局" },
  { tag: "v0.4.0", date: "2025-01-05", body: "✨ 新增 AI 工具集成面板\n✨ 新增命令广场功能" },
]);

// AI Tools state
const activeToolTab = ref("claude-code");

const aiTools = [
  { id: "claude-code", name: "Claude Code", website: "https://github.com/anthropics/claude-code", logo: "/ai-tools-logos/claude-code.svg" },
  { id: "codex", name: "OpenAI Codex", website: "https://github.com/openai/codex", logo: "/ai-tools-logos/codex.png" },
  { id: "gemini-cli", name: "Gemini CLI", website: "https://github.com/google-gemini/gemini-cli", logo: "/ai-tools-logos/gemini-cli.webp" },
  { id: "copilot-cli", name: "Copilot CLI", website: "https://github.com/github/copilot-cli", logo: "/ai-tools-logos/copilot-cli.png" },
];

const toolVersions = reactive<Record<string, string | null>>({
  "claude-code": "1.2.3",
  codex: null,
  "gemini-cli": "2.1.0",
  "copilot-cli": "1.0.0",
});

const toolConfigs = reactive<Record<string, { provider: string; apiKey: string }>>({
  "claude-code": { provider: "ollama", apiKey: "" },
  codex: { provider: "original", apiKey: "" },
  "gemini-cli": { provider: "openai", apiKey: "sk-***" },
  "copilot-cli": { provider: "original", apiKey: "" },
});

const providerOptions = [
  { label: "原厂模式", value: "original" },
  { label: "Ollama", value: "ollama" },
  { label: "OpenAI", value: "openai" },
  { label: "Anthropic", value: "anthropic" },
  { label: "DeepSeek", value: "deepseek" },
];

const currentTool = computed(() => aiTools.find((t) => t.id === activeToolTab.value));
const currentToolVersion = computed(() => toolVersions[activeToolTab.value]);
const currentConfig = computed(() => toolConfigs[activeToolTab.value]);

// Handlers
const handleSettingChange = () => {
  message.info(t("website.demo.settingsSaved"));
};

const handleOpenLogsFolder = () => {
  message.info(t("website.demo.folderHint"));
};

const handleAddIcon = () => {
  if (newCommand.value.trim()) {
    commandIcons[newCommand.value] = "task";
    newCommand.value = "";
    message.success(t("website.demo.settingsSaved"));
  }
};

const handleCheckUpdate = async () => {
  checkingUpdate.value = true;
  await new Promise((r) => setTimeout(r, 1500));
  checkingUpdate.value = false;
  updateChecked.value = true;
  updateAvailable.value = false;
  message.info(t("settings.noUpdate"));
};

const handleRecheckInstall = () => {
  message.info(t("aiTools.recheckInstall"));
};

const handleOpenWebsite = () => {
  message.info(t("website.demo.folderHint"));
};

const handleGetKey = () => {
  message.info(t("website.demo.folderHint"));
};
</script>

<style scoped>
.settings-panel {
  padding: 0;
  height: 100%;
}

.tool-tab-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  margin-bottom: 4px;
}

.tool-logo {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.tool-version {
  font-size: 11px;
  opacity: 0.6;
}

.help-text {
  margin-top: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}
</style>
