// Safe platform detection functions that handle browser environment
export const safeGetPlatform = async () => {
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
    const { platform } = await import("@tauri-apps/plugin-os");
    return platform();
  } catch (error) {
    console.error("Failed to get platform:", error);
    return null;
  }
};

// Check if current platform is Windows
export const isWindows = async () => {
  const platform = await safeGetPlatform();
  return platform === "windows";
};

// Check if current platform is macOS
export const isMacOS = async () => {
  const platform = await safeGetPlatform();
  return platform === "macos";
};

// Check if current platform is Linux
export const isLinux = async () => {
  const platform = await safeGetPlatform();
  return platform === "linux";
};