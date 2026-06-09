// Window control helpers (minimize/maximize/close/drag). No-ops in browser / Node web UI.

export const safeGetCurrentWindow = async () => null;

export const minimizeWindow = async () => {};
export const toggleMaximize = async () => {};

/**
 * Close the current browser tab/window when possible.
 * Browsers only allow closing windows opened by script; otherwise shows a minimal fallback page.
 */
export const closeBrowserWindow = (fallbackMessage = 'Service stopped. You can close this tab.'): void => {
  if (typeof window === 'undefined') return;

  window.close();

  window.setTimeout(() => {
    if (window.closed) return;

    try {
      window.open('', '_self', '');
      window.close();
    } catch {
      // ignore
    }

    window.setTimeout(() => {
      if (window.closed) return;
      document.title = 'Rebebuca';
      const text = fallbackMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      document.body.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,sans-serif;color:#666;text-align:center;padding:24px">' +
        `<p>${text}</p></div>`;
    }, 200);
  }, 150);
};

export const closeWindow = async () => {
  closeBrowserWindow();
};

export const startDrag = async (_event: MouseEvent) => {
  // In browser/server mode, window dragging is not available
};
