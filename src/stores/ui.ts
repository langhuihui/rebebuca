import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { iconComponents } from "../utils/icons";

export const useUIStore = defineStore("ui", () => {
  // UI state
  const sidebarVisible = ref(true);
  const historyPanelVisible = ref(true);
  const isWindowsPlatform = ref(false);
  const selectedHistoryItem = ref<any>(null);
  const consoleScrollbarRef = ref<any>(null);

  // Dialog state
  const configDialogVisible = ref(false);
  const editingConfig = ref<any>(null);

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

  const toggleHistoryPanel = () => {
    historyPanelVisible.value = !historyPanelVisible.value;
  };

  const setWindowsPlatform = (value: boolean) => {
    isWindowsPlatform.value = value;
  };

  const setSelectedHistoryItem = (item: any) => {
    selectedHistoryItem.value = item;
  };

  const setConsoleScrollbarRef = (ref: any) => {
    consoleScrollbarRef.value = ref;
  };

  const openConfigDialog = (config: any = null) => {
    editingConfig.value = config;
    configDialogVisible.value = true;
  };

  const closeConfigDialog = () => {
    configDialogVisible.value = false;
    editingConfig.value = null;
  };

  return {
    // State
    sidebarVisible,
    historyPanelVisible,
    isWindowsPlatform,
    selectedHistoryItem,
    consoleScrollbarRef,
    configDialogVisible,
    editingConfig,

    // Computed
    themeOptions,

    // Actions
    toggleSidebar,
    toggleHistoryPanel,
    setWindowsPlatform,
    setSelectedHistoryItem,
    setConsoleScrollbarRef,
    openConfigDialog,
    closeConfigDialog,
  };
});
