// Window control helpers (minimize/maximize/close/drag). Only relevant for Tauri desktop; in browser/server they are no-ops.

export const safeGetCurrentWindow = async () => null;

export const minimizeWindow = async () => {};
export const toggleMaximize = async () => {};
export const closeWindow = async () => {};

export const startDrag = async (_event: MouseEvent) => {
  // In browser/server mode, window dragging is not available
};
