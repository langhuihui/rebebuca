import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { createAnsiConverter } from "../utils/ansiUtils";
import { useTheme } from "../composables/useTheme";
import { forceThemeOnFloatingComponents } from "../utils/themeUtils";
import { nextTick } from "vue";
import { getAdapter, isTauri, type BackendAdapter } from "../adapters";

// Adapter instance
let adapter: BackendAdapter | null = null;

const getAdapterInstance = async (): Promise<BackendAdapter> => {
  if (!adapter) {
    adapter = await getAdapter();
  }
  return adapter;
};

export const useAppStore = defineStore("app", () => {
  // App state
  const isTauriEnvironment = ref<boolean | null>(null);
  const ansiConverter = ref(createAnsiConverter(true));

  // Get theme from composable
  const { effectiveTheme } = useTheme();

  // Watch theme changes and recreate ANSI converter
  watch(
    effectiveTheme,
    (newTheme) => {
      ansiConverter.value = createAnsiConverter(newTheme === "light");
      // Also force theme on floating components when theme changes
      forceThemeOnFloatingComponents(effectiveTheme.value, nextTick);
    },
    { immediate: false }
  );

  // Tauri environment detection
  const detectTauriEnvironment = () => {
    if (isTauriEnvironment.value !== null) {
      return isTauriEnvironment.value;
    }
    isTauriEnvironment.value = isTauri();
    return isTauriEnvironment.value;
  };

  // Safe listen function that handles browser environment
  const safeListen = async (event: string, handler: (event: any) => void) => {
    if (!detectTauriEnvironment()) {
      return () => { };
    }

    try {
      const { listen } = await import("@tauri-apps/api/event");
      return await listen(event, handler);
    } catch (error) {
      console.error(`Failed to listen to '${event}':`, error);
      return () => { };
    }
  };

  // Safe sendNotification function that handles browser environment
  const safeSendNotification = async (options: {
    title: string;
    body: string;
  }) => {
    try {
      const adapterInstance = await getAdapterInstance();
      await adapterInstance.notification.show(options);
    } catch (error) {
      console.error("Failed to send notification:", error);
    }
  };

  return {
    // State
    isTauriEnvironment,
    ansiConverter,

    // Actions
    detectTauriEnvironment,
    safeListen,
    safeSendNotification,
  };
});
