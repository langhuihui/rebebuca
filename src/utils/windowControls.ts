// Window control helpers (minimize/maximize/close/drag). No-ops in browser / Node web UI.

export const safeGetCurrentWindow = async () => null;

export const minimizeWindow = async () => {};
export const toggleMaximize = async () => {};
export const closeWindow = async () => {};

export const startDrag = async (_event: MouseEvent) => {
  // In browser/server mode, window dragging is not available
};
