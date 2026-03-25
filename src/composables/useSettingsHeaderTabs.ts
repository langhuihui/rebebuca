import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useFeatureFlagsStore } from "../stores/featureFlags";
import {
  SettingsOutline,
  GridOutline,
  TerminalOutline,
  SparklesOutline,
  ServerOutline,
  GitBranchOutline,
} from "@vicons/ionicons5";
import type { Component } from "vue";

export interface SettingsTab {
  name: string;
  label: string;
  icon: Component;
}

export function useSettingsHeaderTabs() {
  const { t } = useI18n();
  const featureFlagsStore = useFeatureFlagsStore();

  const settingsHeaderTabs = computed<SettingsTab[]>(() => {
    const tabs: SettingsTab[] = [
      { name: "general", label: t("settings.general"), icon: SettingsOutline },
      { name: "icons", label: t("settings.commandIcons"), icon: GridOutline },
      { name: "backendlog", label: t("settings.backendLogs"), icon: TerminalOutline },
      { name: "aitools", label: t("settings.aiTools"), icon: SparklesOutline },
    ];
    if (featureFlagsStore.flags.ssh) {
      tabs.push({ name: "ssh", label: t("settings.ssh"), icon: ServerOutline });
    }
    tabs.push({ name: "mcp", label: "MCP", icon: GitBranchOutline });
    tabs.push({ name: "openclaw", label: t("settings.openClaw"), icon: null });
    return tabs;
  });

  return { settingsHeaderTabs };
}
