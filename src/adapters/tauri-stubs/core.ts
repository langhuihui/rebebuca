/**
 * Tauri Core API Stub for Server/Mock mode
 * These are no-op implementations that prevent runtime errors
 */

export async function invoke<T>(_cmd: string, _args?: Record<string, unknown>): Promise<T> {
  console.warn('[Tauri Stub] invoke() called in non-Tauri environment:', _cmd);
  throw new Error(`Tauri invoke not available in server mode: ${_cmd}`);
}

export function transformCallback<T>(
  _callback?: (response: T) => void,
  _once?: boolean
): number {
  console.warn('[Tauri Stub] transformCallback() called in non-Tauri environment');
  return 0;
}

export class Channel<T = unknown> {
  id: number = 0;
  
  constructor() {
    console.warn('[Tauri Stub] Channel created in non-Tauri environment');
  }
  
  set onmessage(_handler: (response: T) => void) {
    console.warn('[Tauri Stub] Channel.onmessage set in non-Tauri environment');
  }
  
  get onmessage(): (response: T) => void {
    return () => {};
  }
  
  toJSON(): string {
    return `__CHANNEL__:${this.id}`;
  }
}

export class PluginListener {
  plugin: string;
  event: string;
  
  constructor(plugin: string, event: string) {
    this.plugin = plugin;
    this.event = event;
  }
  
  async unregister(): Promise<void> {
    console.warn('[Tauri Stub] PluginListener.unregister() called in non-Tauri environment');
  }
}

export async function addPluginListener<T>(
  _plugin: string,
  _event: string,
  _handler: (payload: T) => void
): Promise<PluginListener> {
  console.warn('[Tauri Stub] addPluginListener() called in non-Tauri environment');
  return new PluginListener(_plugin, _event);
}

export function convertFileSrc(_filePath: string, _protocol?: string): string {
  console.warn('[Tauri Stub] convertFileSrc() called in non-Tauri environment');
  return _filePath;
}

export interface Resource {
  rid: number;
  close(): Promise<void>;
}

export class Resource implements Resource {
  rid: number = 0;
  
  async close(): Promise<void> {
    console.warn('[Tauri Stub] Resource.close() called in non-Tauri environment');
  }
}
