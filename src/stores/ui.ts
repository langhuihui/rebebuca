import { defineStore } from "pinia";
import { ref, computed } from "vue";
import i18n from "../locales";
import { iconComponents } from "../utils/icons";
import type { RunHistory } from "./runConfig";

export const useUIStore = defineStore("ui", () => {
  // UI state
  const sidebarVisible = ref(true);
  const miniMode = ref(false);
  const sidebarWidth = ref(250);
  const isWindowsPlatform = ref(false);
  const selectedHistoryItem = ref<RunHistory | null>(null);
  const consoleScrollbarRef = ref<any>(null);
  
  // Store original window size for restoring
  const originalWindowSize = ref<{ width: number; height: number } | null>(null);

  // Computed properties
  const themeOptions = computed(() => {
    const t = i18n.global.t;
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

  const clampSidebarWidth = (width: number) =>
    Math.min(420, Math.max(200, Math.round(width)));

  // Actions
  const toggleSidebar = () => {
    sidebarVisible.value = !sidebarVisible.value;
  };

  const setSidebarWidth = (width: number) => {
    sidebarWidth.value = clampSidebarWidth(width);
  };

  const syncMiniModeWindowWidth = async (_width?: number) => {
    if (!miniMode.value) return;
  };

  const toggleMiniMode = async () => {
    miniMode.value = !miniMode.value;
    // When entering mini mode, ensure sidebar is visible
    if (miniMode.value) {
      sidebarVisible.value = true;
    }
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
    miniMode,
    sidebarWidth,
    isWindowsPlatform,
    selectedHistoryItem,
    consoleScrollbarRef,
    originalWindowSize,

    // Computed
    themeOptions,

    // Actions
    toggleSidebar,
    toggleMiniMode,
    setSidebarWidth,
    syncMiniModeWindowWidth,
    setWindowsPlatform,
    setSelectedHistoryItem,
    setConsoleScrollbarRef,
  };
});
