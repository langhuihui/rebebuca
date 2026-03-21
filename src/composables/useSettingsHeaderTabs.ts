import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useFeatureFlagsStore } from "../stores/featureFlags";

export function useSettingsHeaderTabs() {
  const { t } = useI18n();
  const featureFlagsStore = useFeatureFlagsStore();

  const settingsHeaderTabs = computed(() => {
    const tabs: { name: string; label: string }[] = [
      { name: "general", label: t("settings.general") },
      { name: "icons", label: t("settings.commandIcons") },
      { name: "aitools", label: t("settings.aiTools") },
    ];
    if (featureFlagsStore.flags.ssh) {
      tabs.push({ name: "ssh", label: t("settings.ssh") });
    }
    tabs.push({ name: "mcp", label: "MCP" });
    return tabs;
  });

  return { settingsHeaderTabs };
}
