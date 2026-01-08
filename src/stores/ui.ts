import { defineStore } from "pinia";
import { ref, computed } from "vue";
import i18n from "../locales";
import { iconComponents } from "../utils/icons";
import type { RunHistory } from "./runConfig";

export const useUIStore = defineStore("ui", () => {
  // UI state
  const sidebarVisible = ref(true);
  const miniMode = ref(false);
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

  // Actions
  const toggleSidebar = () => {
    sidebarVisible.value = !sidebarVisible.value;
  };

  const toggleMiniMode = async () => {
    const isTauri = () => {
      try {
        if (typeof window !== "undefined") {
          if (
            (window as any).__TAURI__ ||
            (window as any).__TAURI_INTERNALS__ ||
            (window as any).__TAURI_METADATA__
          ) {
            return true;
          }
        }
        if (
          typeof navigator !== "undefined" &&
          navigator.userAgent.includes("Tauri")
        ) {
          return true;
        }
        return false;
      } catch (error) {
        return false;
      }
    };

    if (isTauri()) {
      try {
        const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
        const appWindow = getCurrentWindow();
        
        console.log("[MiniMode] Toggling mini mode, current state:", miniMode.value);
        
        // Check if window is maximized, if so, unmaximize first
        const isMaximized = await appWindow.isMaximized();
        console.log("[MiniMode] Window maximized:", isMaximized);
        if (isMaximized) {
          await appWindow.unmaximize();
          // Wait a bit for unmaximize to complete
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        if (!miniMode.value) {
          // Entering mini mode - save current size and resize to sidebar size
          const currentSize = await appWindow.innerSize();
          const scaleFactor = await appWindow.scaleFactor();
          const logicalWidth = currentSize.width / scaleFactor;
          const logicalHeight = currentSize.height / scaleFactor;
          
          console.log("[MiniMode] Current size:", { 
            physical: { width: currentSize.width, height: currentSize.height },
            logical: { width: logicalWidth, height: logicalHeight },
            scaleFactor 
          });
          
          originalWindowSize.value = {
            width: logicalWidth,
            height: logicalHeight
          };
          
          // Resize to sidebar width (250px)
          // Use a reasonable height for the mini window
          const miniWidth = 250;
          const miniHeight = 600; // Default height for mini mode
          console.log("[MiniMode] Resizing to:", { width: miniWidth, height: miniHeight });
          
          // Set minimum size to allow smaller window
          await appWindow.setMinSize(new LogicalSize(miniWidth, 400));
          
          const newSize = new LogicalSize(miniWidth, miniHeight);
          await appWindow.setSize(newSize);
          
          // Verify the size was set
          await new Promise(resolve => setTimeout(resolve, 100));
          const newSizeCheck = await appWindow.innerSize();
          const newLogicalWidth = newSizeCheck.width / scaleFactor;
          const newLogicalHeight = newSizeCheck.height / scaleFactor;
          console.log("[MiniMode] New size after resize:", { 
            physical: { width: newSizeCheck.width, height: newSizeCheck.height },
            logical: { width: newLogicalWidth, height: newLogicalHeight }
          });
        } else {
          // Exiting mini mode - restore original size
          if (originalWindowSize.value) {
            console.log("[MiniMode] Restoring size to:", originalWindowSize.value);
            
            // Restore minimum size to original (1000x600 from config)
            await appWindow.setMinSize(new LogicalSize(1000, 600));
            
            const restoreSize = new LogicalSize(
              originalWindowSize.value.width,
              originalWindowSize.value.height
            );
            await appWindow.setSize(restoreSize);
            originalWindowSize.value = null;
          }
        }
      } catch (error) {
        console.error("[MiniMode] Failed to resize window:", error);
      }
    }
    
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
    isWindowsPlatform,
    selectedHistoryItem,
    consoleScrollbarRef,
    originalWindowSize,

    // Computed
    themeOptions,

    // Actions
    toggleSidebar,
    toggleMiniMode,
    setWindowsPlatform,
    setSelectedHistoryItem,
    setConsoleScrollbarRef,
  };
});
