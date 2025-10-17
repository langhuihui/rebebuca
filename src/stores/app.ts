import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { createAnsiConverter } from "../utils/ansiUtils";
import { useTheme } from "../composables/useTheme";
import { forceThemeOnFloatingComponents } from "../utils/themeUtils";
import { nextTick } from "vue";

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
    // Cache the result to avoid repeated checks
    if (isTauriEnvironment.value !== null) {
      return isTauriEnvironment.value;
    }

    try {
      // Method 1: Check for Tauri globals
      if (typeof window !== "undefined") {
        if (
          (window as any).__TAURI__ ||
          (window as any).__TAURI_INTERNALS__ ||
          (window as any).__TAURI_METADATA__
        ) {
          isTauriEnvironment.value = true;
          return true;
        }
      }

      // Method 2: Check user agent
      if (
        typeof navigator !== "undefined" &&
        navigator.userAgent.includes("Tauri")
      ) {
        isTauriEnvironment.value = true;
        return true;
      }

      // Method 3: Check for webview environment (common in Tauri)
      if (
        typeof window !== "undefined" &&
        (window as any).chrome &&
        (window as any).chrome.runtime
      ) {
        isTauriEnvironment.value = true;
        return true;
      }

      isTauriEnvironment.value = false;
      return false;
    } catch (error) {
      isTauriEnvironment.value = false;
      return false;
    }
  };

  // Safe listen function that handles browser environment
  const safeListen = async (event: string, handler: (event: any) => void) => {
    if (!detectTauriEnvironment()) {
      // Silent fallback in browser environment
      return () => { }; // Return empty unlisten function
    }

    try {
      const { listen } = await import("@tauri-apps/api/event");
      return await listen(event, handler);
    } catch (error) {
      console.error(`Failed to listen to '${event}':`, error);
      return () => { }; // Return empty unlisten function
    }
  };

  // Safe sendNotification function that handles browser environment
  const safeSendNotification = async (options: {
    title: string;
    body: string;
  }) => {
    if (!detectTauriEnvironment()) {
      // Silent fallback in browser environment
      return;
    }

    try {
      const { sendNotification } = await import(
        "@tauri-apps/plugin-notification"
      );
      await sendNotification(options);
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
