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
  processId?: string;
}

// A small wrapper to detect Tauri env at runtime without importing types
const isTauriEnv = (): boolean => {
  try {
    if (typeof window !== 'undefined') {
      if ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI_METADATA__) {
        return true;
      }
    }
    if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Tauri')) return true;
  } catch (_) {}
  return false;
};

let trayIconRef: any | null = null;
let menuApi: any | null = null;
let trayApi: any | null = null;

// Build tray menu based on current store state
const buildMenu = async (
  store: any
): Promise<any | null> => {
  if (!menuApi) return null;

  const Menu = (menuApi as any).Menu;
  const MenuItem = (menuApi as any).MenuItem;
  const Submenu = (menuApi as any).Submenu;
  const PredefinedMenuItem = (menuApi as any).PredefinedMenuItem;

  // Fallback checks
  if (!Menu || !MenuItem) return null;

  // Compute items
  const running: SimpleRunHistoryItem[] = (store.history || []).filter((h: SimpleRunHistoryItem) => h.status === 'running' && h.processId);

  // Prioritize running items, then configs, total top-level entries limited to 10
  const maxTopLevel = 10;
  const runningToShow = running.slice(0, maxTopLevel);
  const remaining = Math.max(0, maxTopLevel - runningToShow.length);

  const configs: SimpleRunConfig[] = (store.configs || []) as SimpleRunConfig[];
  const configsToShow = configs.slice(0, remaining);

  const topLevelItems: any[] = [];

  // Running processes section
  for (const item of runningToShow) {
    const name = item.name;
    const pid = item.processId || '';

    // Actions
    const stopItem = new MenuItem({
      id: `stop:${pid}`,
      text: `停止 ${name}`,
      action: async () => {
        try {
          if (pid) {
            await store.stopCurrentRun(pid);
          }
        } catch (e) {
          console.error('Failed to stop process from tray:', e);
        }
      }
    });

    const restartItem = new MenuItem({
      id: `restart:${pid}`,
      text: `重启 ${name}`,
      action: async () => {
        try {
          const cfg: SimpleRunConfig | undefined = store.getConfig(item.configId);
          if (pid) {
            await store.stopCurrentRun(pid);
          }
          if (cfg) {
            await store.executeCommand(cfg);
          }
        } catch (e) {
          console.error('Failed to restart process from tray:', e);
        }
      }
    });

    // Prefer grouping actions under process name if Submenu exists
    if (Submenu) {
      const submenuMenu = new Menu({ items: [stopItem, restartItem] });
      const submenu = new Submenu({ text: `进程: ${name}`, children: submenuMenu });
      topLevelItems.push(submenu);
    } else {
      // Fallback: push two flat items (counts towards the 10 limit)
      topLevelItems.push(stopItem);
      if (topLevelItems.length < maxTopLevel) topLevelItems.push(restartItem);
    }
  }

  // Optional separator if space remains and we have configs
  if (PredefinedMenuItem && configsToShow.length > 0 && topLevelItems.length > 0 && topLevelItems.length < maxTopLevel) {
    try {
      const sep = new PredefinedMenuItem('Separator');
      topLevelItems.push(sep);
    } catch (_) {
      // ignore if API differs
    }
  }

  // Config list section (Start only)
  for (const cfg of configsToShow) {
    const startItem = new MenuItem({
      id: `start:${cfg.id}`,
      text: `启动 ${cfg.name}`,
      action: async () => {
        try {
          await store.executeCommand(cfg);
        } catch (e) {
          console.error('Failed to start config from tray:', e);
        }
      }
    });

    // Put action under a submenu named by config if Submenu is supported
    if (Submenu) {
      const submenuMenu = new Menu({ items: [startItem] });
      const submenu = new Submenu({ text: `配置: ${cfg.name}`, children: submenuMenu });
      topLevelItems.push(submenu);
    } else {
      topLevelItems.push(startItem);
    }

    if (topLevelItems.length >= maxTopLevel) break;
  }

  // Build final menu
  try {
    const menu = new Menu({ items: topLevelItems });
    return menu;
  } catch (e) {
    console.error('Failed to create tray menu:', e);
    return null;
  }
};

// Create or update the tray icon with the latest menu
const ensureTray = async (store: any) => {
  try {
    if (!trayApi || !menuApi) return;

    const newMenu = await buildMenu(store);
    if (!newMenu) return;

    const TrayIcon = (trayApi as any).TrayIcon;
    if (!TrayIcon) return;

    if (!trayIconRef) {
      // Create new tray
      try {
        // Some environments expose a static async constructor
        if (typeof (TrayIcon as any).new === 'function') {
          trayIconRef = await (TrayIcon as any).new({
            menu: newMenu,
            tooltip: 'Rebebuca',
          });
        } else {
          // Fallback to constructor form
          trayIconRef = new (TrayIcon as any)({
            menu: newMenu,
            tooltip: 'Rebebuca',
          });
        }
      } catch (e) {
        console.error('Failed to create tray icon:', e);
        trayIconRef = null;
      }
    } else {
      // Update existing tray menu if supported
      try {
        if (typeof trayIconRef.setMenu === 'function') {
          await trayIconRef.setMenu(newMenu);
        } else if (typeof trayIconRef.menu === 'function') {
          // Some APIs expose a setter named `menu`
          await trayIconRef.menu(newMenu);
        } else if (typeof (TrayIcon as any).setMenu === 'function') {
          await (TrayIcon as any).setMenu(newMenu);
        } else {
          // Recreate as a last resort
          trayIconRef = null;
          await ensureTray(store);
        }
      } catch (e) {
        console.warn('Failed to update tray menu, recreating tray:', e);
        trayIconRef = null;
        await ensureTray(store);
      }
    }
  } catch (e) {
    console.error('ensureTray failed:', e);
  }
};

export const setupSystemTrayMenu = async (store: any) => {
  if (!isTauriEnv()) return;

  try {
    // Dynamic import to avoid type issues in browser
    menuApi = await import('@tauri-apps/api/menu');
    trayApi = await import('@tauri-apps/api/tray');
  } catch (e) {
    console.warn('Tauri menu/tray APIs not available:', e);
    return;
  }

  // Initial build
  await ensureTray(store);

  // Watch for changes to update tray menu dynamically
  watch(
    () => [store.history.map((h: any) => [h.id, h.status, h.processId, h.name]).join('|'), store.configs.map((c: any) => [c.id, c.name]).join('|')],
    async () => {
      await ensureTray(store);
    },
    { deep: false }
  );
};
