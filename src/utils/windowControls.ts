// Safe window control functions that handle browser environment
export const safeGetCurrentWindow = async () => {
  // Check if running in Tauri environment
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

      // Method 2: Check user agent
      if (
        typeof navigator !== "undefined" &&
        navigator.userAgent.includes("Tauri")
      ) {
        return true;
      }

      // Method 3: Check for webview environment (common in Tauri)
      if (
        typeof window !== "undefined" &&
        (window as any).chrome &&
        (window as any).chrome.runtime
      ) {
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  };

  if (!isTauri()) {
    // Silent fallback in browser environment
    return null;
  }

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow();
  } catch (error) {
    console.error("Failed to get current window:", error);
    return null;
  }
};

// Window controls
export const minimizeWindow = async () => {
  const appWindow = await safeGetCurrentWindow();
  if (appWindow) {
    await appWindow.minimize();
  }
};

export const toggleMaximize = async () => {
  const appWindow = await safeGetCurrentWindow();
  if (appWindow) {
    await appWindow.toggleMaximize();
  }
};

export const closeWindow = async () => {
  const appWindow = await safeGetCurrentWindow();
  if (appWindow) {
    await appWindow.close();
  }
};

// Window drag functionality
export const startDrag = async (event: MouseEvent) => {
  // Only start drag on left mouse button
  if (event.button !== 0) return;

  // Don't start drag if clicking on buttons
  const target = event.target as HTMLElement;
  if (target.closest(".n-button")) return;

  try {
    if (await safeGetCurrentWindow()) {
      // Use Tauri window dragging in desktop app
      const appWindow = await safeGetCurrentWindow();
      if (appWindow) {
        await appWindow.startDragging();
      }
    } else {
      // In browser environment, prevent default behavior to allow titlebar to be draggable
      // The CSS cursor: move on .custom-titlebar will provide visual feedback
      console.log("Window dragging not available in browser environment");
    }
  } catch (error) {
    console.error("Failed to start dragging:", error);
  }
};