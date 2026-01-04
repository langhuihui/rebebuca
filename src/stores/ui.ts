import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { iconComponents } from "../utils/icons";
import type { RunHistory } from "./runConfig";

export const useUIStore = defineStore("ui", () => {
  // UI state
  const sidebarVisible = ref(true);
  const isWindowsPlatform = ref(false);
  const selectedHistoryItem = ref<RunHistory | null>(null);
  const consoleScrollbarRef = ref<any>(null);

  // Computed properties
  const themeOptions = computed(() => {
    const { t } = useI18n();
    return [
      {
        label: t("theme.light"),
        key: "light",
        icon: iconComponents.sun,
      },
      {
        label: t("theme.dark"),
        key: "dark",
        icon: iconComponents.moon,
      },
      {
        label: t("theme.system"),
        key: "system",
        icon: iconComponents.system,
      },
    ];
  });

  // Actions
  const toggleSidebar = () => {
    sidebarVisible.value = !sidebarVisible.value;
  };

  const setWindowsPlatform = (value: boolean) => {
    isWindowsPlatform.value = value;
  };

  const setSelectedHistoryItem = (item: RunHistory | null) => {
    selectedHistoryItem.value = item;
  };

  const setConsoleScrollbarRef = (ref: any) => {
    consoleScrollbarRef.value = ref;
  };

  return {
    // State
    sidebarVisible,
    isWindowsPlatform,
    selectedHistoryItem,
    consoleScrollbarRef,

    // Computed
    themeOptions,

    // Actions
    toggleSidebar,
    setWindowsPlatform,
    setSelectedHistoryItem,
    setConsoleScrollbarRef,
  };
});
