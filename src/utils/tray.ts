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
let interactionsAttached = false;

// Build tray menu based on current store state
const buildMenu = async (
  store: any
): Promise<any | null> => {
  if (!menuApi) return null;

  const Menu = (menuApi as any).Menu;
  const MenuItem = (menuApi as any).MenuItem;
  const Submenu = (menuApi as any).Submenu;
  const PredefinedMenuItem = (menuApi as any).PredefinedMenuItem;

  const createSubmenu = (text: string, innerMenu: any): any | null => {
    if (!Submenu) return null;
    try {
      return new Submenu({ text, children: innerMenu });
    } catch (_) {
      try {
        return new Submenu({ text, items: innerMenu });
      } catch (__) {
        try {
          return new Submenu(text, innerMenu);
        } catch (___) {
          return null;
        }
      }
    }
  };

  const createSeparator = (): any | null => {
    if (!PredefinedMenuItem) return null;
    try {
      return new PredefinedMenuItem('Separator');
    } catch (_) {
      try {
        return new PredefinedMenuItem({ kind: 'Separator' });
      } catch (__) {
        try {
          return (PredefinedMenuItem as any).separator ? (PredefinedMenuItem as any).separator() : null;
        } catch (___) {
          return null;
        }
      }
    }
  };

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
      const submenu = createSubmenu(`进程: ${name}`, submenuMenu);
      if (submenu) {
        topLevelItems.push(submenu);
      } else {
        topLevelItems.push(stopItem);
        if (topLevelItems.length < maxTopLevel) topLevelItems.push(restartItem);
      }
    } else {
      // Fallback: push two flat items (counts towards the 10 limit)
      topLevelItems.push(stopItem);
      if (topLevelItems.length < maxTopLevel) topLevelItems.push(restartItem);
    }
  }

  // Optional separator if space remains and we have configs
  if (PredefinedMenuItem && configsToShow.length > 0 && topLevelItems.length > 0 && topLevelItems.length < maxTopLevel) {
    const sep = createSeparator();
    if (sep) topLevelItems.push(sep);
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

// Show and focus main window
const showMainWindow = async () => {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    try {
      if (typeof (win as any).isMinimized === 'function' && await (win as any).isMinimized()) {
        if (typeof (win as any).unminimize === 'function') await (win as any).unminimize();
      }
    } catch (_) {}
    try {
      if (typeof (win as any).isVisible === 'function' && !(await (win as any).isVisible())) {
        if (typeof (win as any).show === 'function') await (win as any).show();
      }
    } catch (_) {}
    try {
      if (typeof (win as any).setFocus === 'function') await (win as any).setFocus();
    } catch (_) {}
  } catch (e) {
    console.error('Failed to show main window:', e);
  }
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
  const runningCount = (store.history || []).filter((h: any) => h.status === 'running' && h.processId).length;
  const text = `Rebebuca - 正在运行: ${runningCount}`;
  try {
    if (typeof (trayIconRef as any).setTooltip === 'function') {
      await (trayIconRef as any).setTooltip(text);
    }
  } catch (_) {}
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
        await attachTrayInteractions();
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
          return;
        }
        await attachTrayInteractions();
      } catch (e) {
        console.warn('Failed to update tray menu, recreating tray:', e);
        trayIconRef = null;
        await ensureTray(store);
        return;
      }
    }

    // Update tooltip with running count
    await updateTrayTooltip(store);
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
