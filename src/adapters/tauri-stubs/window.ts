/**
 * Tauri Window API Stub for Server/Mock mode
 * These are no-op implementations that prevent runtime errors
 */

import type { UnlistenFn, EventCallback } from './event';

export interface PhysicalPosition {
  x: number;
  y: number;
}

export interface PhysicalSize {
  width: number;
  height: number;
}

export interface LogicalPosition {
  x: number;
  y: number;
}

export interface LogicalSize {
  width: number;
  height: number;
}

class WindowStub {
  label: string;
  
  constructor(label: string) {
    this.label = label;
  }
  
  async listen<T>(_event: string, _handler: EventCallback<T>): Promise<UnlistenFn> {
    console.warn('[Tauri Stub] Window.listen() called in non-Tauri environment');
    return () => {};
  }
  
  async once<T>(_event: string, _handler: EventCallback<T>): Promise<UnlistenFn> {
    console.warn('[Tauri Stub] Window.once() called in non-Tauri environment');
    return () => {};
  }
  
  async emit(_event: string, _payload?: unknown): Promise<void> {
    console.warn('[Tauri Stub] Window.emit() called in non-Tauri environment');
  }
  
  async scaleFactor(): Promise<number> {
    return window.devicePixelRatio || 1;
  }
  
  async innerPosition(): Promise<PhysicalPosition> {
    return { x: 0, y: 0 };
  }
  
  async outerPosition(): Promise<PhysicalPosition> {
    return { x: 0, y: 0 };
  }
  
  async innerSize(): Promise<PhysicalSize> {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  
  async outerSize(): Promise<PhysicalSize> {
    return { width: window.outerWidth, height: window.outerHeight };
  }
  
  async isFullscreen(): Promise<boolean> {
    return false;
  }
  
  async isMinimized(): Promise<boolean> {
    return false;
  }
  
  async isMaximized(): Promise<boolean> {
    return false;
  }
  
  async isFocused(): Promise<boolean> {
    return document.hasFocus();
  }
  
  async isDecorated(): Promise<boolean> {
    return true;
  }
  
  async isResizable(): Promise<boolean> {
    return true;
  }
  
  async isVisible(): Promise<boolean> {
    return true;
  }
  
  async title(): Promise<string> {
    return document.title;
  }
  
  async theme(): Promise<'light' | 'dark' | null> {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  async center(): Promise<void> {}
  async requestUserAttention(_type?: number): Promise<void> {}
  async setResizable(_resizable: boolean): Promise<void> {}
  async setTitle(title: string): Promise<void> {
    document.title = title;
  }
  async maximize(): Promise<void> {}
  async unmaximize(): Promise<void> {}
  async minimize(): Promise<void> {}
  async unminimize(): Promise<void> {}
  async show(): Promise<void> {}
  async hide(): Promise<void> {}
  async close(): Promise<void> {}
  async setDecorations(_decorations: boolean): Promise<void> {}
  async setAlwaysOnTop(_alwaysOnTop: boolean): Promise<void> {}
  async setSize(_size: LogicalSize | PhysicalSize): Promise<void> {}
  async setMinSize(_size?: LogicalSize | PhysicalSize): Promise<void> {}
  async setMaxSize(_size?: LogicalSize | PhysicalSize): Promise<void> {}
  async setPosition(_position: LogicalPosition | PhysicalPosition): Promise<void> {}
  async setFullscreen(_fullscreen: boolean): Promise<void> {}
  async setFocus(): Promise<void> {}
  async setIcon(_icon: string | Uint8Array): Promise<void> {}
  async setSkipTaskbar(_skip: boolean): Promise<void> {}
  async setCursorGrab(_grab: boolean): Promise<void> {}
  async setCursorVisible(_visible: boolean): Promise<void> {}
  async setCursorIcon(_icon: string): Promise<void> {}
  async setCursorPosition(_position: LogicalPosition | PhysicalPosition): Promise<void> {}
  async setIgnoreCursorEvents(_ignore: boolean): Promise<void> {}
  async startDragging(): Promise<void> {}
}

let currentWindow: WindowStub | null = null;

export function getCurrentWindow(): WindowStub {
  if (!currentWindow) {
    currentWindow = new WindowStub('main');
  }
  return currentWindow;
}

export function getAll(): WindowStub[] {
  return [getCurrentWindow()];
}

export { WindowStub as Window };
