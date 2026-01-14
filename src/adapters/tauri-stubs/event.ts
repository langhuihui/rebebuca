/**
 * Tauri Event API Stub for Server/Mock mode
 * These are no-op implementations that prevent runtime errors
 */

export type UnlistenFn = () => void;

export interface Event<T> {
  event: string;
  id: number;
  payload: T;
}

export type EventCallback<T> = (event: Event<T>) => void;

export async function listen<T>(
  _event: string,
  _handler: EventCallback<T>
): Promise<UnlistenFn> {
  console.warn('[Tauri Stub] listen() called in non-Tauri environment');
  return () => {};
}

export async function once<T>(
  _event: string,
  _handler: EventCallback<T>
): Promise<UnlistenFn> {
  console.warn('[Tauri Stub] once() called in non-Tauri environment');
  return () => {};
}

export async function emit(_event: string, _payload?: unknown): Promise<void> {
  console.warn('[Tauri Stub] emit() called in non-Tauri environment');
}

export const TauriEvent = {
  WINDOW_RESIZED: 'tauri://resize',
  WINDOW_MOVED: 'tauri://move',
  WINDOW_CLOSE_REQUESTED: 'tauri://close-requested',
  WINDOW_CREATED: 'tauri://window-created',
  WINDOW_DESTROYED: 'tauri://destroyed',
  WINDOW_FOCUS: 'tauri://focus',
  WINDOW_BLUR: 'tauri://blur',
  WINDOW_SCALE_FACTOR_CHANGED: 'tauri://scale-change',
  WINDOW_THEME_CHANGED: 'tauri://theme-changed',
  DRAG_ENTER: 'tauri://drag-enter',
  DRAG_OVER: 'tauri://drag-over',
  DRAG_DROP: 'tauri://drag-drop',
  DRAG_LEAVE: 'tauri://drag-leave',
} as const;
