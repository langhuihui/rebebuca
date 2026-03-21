import { watch } from 'vue';

// Minimal interface shape to avoid tight coupling with store types
interface SimpleRunConfig {
  id: string;
  name: string;
  command: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  arguments?: string[];
}

interface SimpleRunHistoryItem {
  id: string;
  configId: string;
  name: string;
  status: 'running' | 'success' | 'error';
  pid?: string;
}

// Tauri has been removed; tray is only relevant for desktop (Tauri), so always false
const isTauriEnv = (): boolean => false;

let trayIconRef: any | null = null;
let menuApi: any | null = null;
let trayApi: any | null = null;
let interactionsAttached = false;
let trayUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

// Build tray menu based on current store state
const buildMenu = async (
  store: any
): Promise<any | null> => {
  // In Tauri v2, we need to check if tray functionality is available
  if (!isTauriEnv()) return null;
  return null;
};

// Show and focus main window
const showMainWindow = async () => {
  if (!isTauriEnv()) return;
};

// Attach tray interactions like click to show app window
const attachTrayInteractions = async () => {
  if (!trayIconRef || interactionsAttached) return;
  try {
    const clickHandler = async (event: any) => {
      const btn = event?.button ?? event?.mouseButton ?? event?.buttonState;
      const isLeft = btn === 'left' || btn === 0 || btn === 'Left';
      if (isLeft) {
        await showMainWindow();
      }
    };

    if (typeof (trayIconRef as any).onClick === 'function') {
      (trayIconRef as any).onClick(clickHandler);
      interactionsAttached = true;
    } else if (typeof (trayIconRef as any).setOnClick === 'function') {
      await (trayIconRef as any).setOnClick(clickHandler);
      interactionsAttached = true;
    } else if (trayApi && typeof (trayApi as any).onClick === 'function') {
      await (trayApi as any).onClick(clickHandler);
      interactionsAttached = true;
    }
  } catch (e) {
    console.warn('Failed to attach tray interactions:', e);
  }
};

const updateTrayTooltip = async (store: any) => {
  if (!trayIconRef) return;
  const runningCount = (store.history || []).filter((h: any) => h.status === 'running' && h.pid).length;
  const text = `Rebebuca - 正在运行: ${runningCount}`;
  try {
    if (typeof (trayIconRef as any).setTooltip === 'function') {
      await (trayIconRef as any).setTooltip(text);
    }
  } catch (_) { }
};

// Create or update the tray icon with the latest menu
const ensureTray = async (store: any) => {
  console.log('[TRAY] ensureTray called');

  // Check if we're in Tauri environment
  if (!isTauriEnv()) {
    console.log('[TRAY] Not in Tauri environment, returning');
    return;
  }

  try {
    const newMenu = await buildMenu(store);
    if (!newMenu) {
      console.log('[TRAY] Failed to build menu');
      return;
    }
    console.log('[TRAY] Menu built successfully');

    const TrayIcon = (trayApi as any).TrayIcon;
    if (!TrayIcon) {
      console.log('[TRAY] TrayIcon not available in trayApi');
      return;
    }
    console.log('[TRAY] TrayIcon available:', TrayIcon);

    if (!trayIconRef) {
      // Create new tray - only once
      console.log('[TRAY] Creating new tray icon...');
      try {
        // Create tray icon with Tauri v2 API
        // Note: icon is optional, will use default app icon if not provided
        const trayOptions: any = {
          id: 'main-tray',
          menu: newMenu,
          tooltip: 'Rebebuca',
        };
        
        console.log('[TRAY] Calling TrayIcon.new with options:', trayOptions);
        trayIconRef = await TrayIcon.new(trayOptions);
        console.log('[TRAY] Tray icon created successfully, id:', trayIconRef?.id);
        await attachTrayInteractions();
      } catch (e) {
        // Gracefully handle tray creation errors
        console.error('[TRAY] Failed to create tray icon:', e);
        trayIconRef = null;
      }
    } else {
      // Update existing tray menu without recreating
      console.log('[TRAY] Updating existing tray menu...');
      try {
        // Try to set the menu directly
        if (typeof trayIconRef.setMenu === 'function') {
          await trayIconRef.setMenu(newMenu);
          console.log('[TRAY] Menu updated successfully');
        } else {
          console.warn('[TRAY] setMenu not available, tray menu will not be updated');
        }
      } catch (e) {
        console.warn('[TRAY] Failed to update tray menu:', e);
        // Only recreate if absolutely necessary
        console.log('[TRAY] Attempting to recreate tray as fallback...');
        try {
          if (typeof trayIconRef.destroy === 'function') {
            await trayIconRef.destroy();
            // Wait a bit for the old tray to be fully destroyed
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          trayIconRef = null;
          
          // Recreate
          const trayOptions: any = {
            id: 'main-tray',
            menu: newMenu,
            tooltip: 'Rebebuca',
          };
          trayIconRef = await TrayIcon.new(trayOptions);
          await attachTrayInteractions();
          console.log('[TRAY] Tray recreated successfully');
        } catch (recreateError) {
          console.error('[TRAY] Failed to recreate tray:', recreateError);
        }
      }
    }

    // Update tooltip with running count
    await updateTrayTooltip(store);
  } catch (e) {
    console.error('ensureTray failed:', e);
  }
};

export const setupSystemTrayMenu = async (store: any) => {
  console.log('[TRAY] Setting up system tray menu...');

  // Only setup tray in Tauri environment
  if (!isTauriEnv()) {
    console.log('[TRAY] Not in Tauri environment, skipping tray setup');
    return;
  }

  console.log('[TRAY] In Tauri environment, proceeding with tray setup');

  try {
    // Initial build
    console.log('[TRAY] Building initial tray...');
    await ensureTray(store);

    // Watch for changes to update tray menu dynamically with debouncing
    watch(
      () => [store.history.map((h: any) => [h.id, h.status, h.pid, h.name]).join('|'), store.configs.map((c: any) => [c.id, c.name]).join('|')],
      async () => {
        // Clear existing timeout
        if (trayUpdateTimeout) {
          clearTimeout(trayUpdateTimeout);
        }

        // Set new timeout to debounce updates
        trayUpdateTimeout = setTimeout(async () => {
          console.log('[TRAY] Updating tray menu due to store changes...');
          await ensureTray(store);
          trayUpdateTimeout = null;
        }, 500); // 500ms debounce
      },
      { deep: false }
    );
  } catch (e) {
    console.error('[TRAY] setupSystemTrayMenu failed:', e);
  }
};