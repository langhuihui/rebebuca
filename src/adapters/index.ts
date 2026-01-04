/**
 * Backend Adapter Factory
 * 
 * Provides the appropriate backend adapter based on environment
 */

import type { BackendAdapter, BackendType } from './types';

// Re-export types
export * from './types';

// Singleton adapter instance
let adapterInstance: BackendAdapter | null = null;

/**
 * Detect the backend type from environment
 */
export function detectBackendType(): BackendType {
  // Check environment variable first
  const envBackend = import.meta.env.VITE_BACKEND as BackendType | undefined;
  if (envBackend && ['tauri', 'server', 'mock'].includes(envBackend)) {
    return envBackend;
  }
  
  // Auto-detect based on environment
  if (typeof window !== 'undefined') {
    // Check if running in Tauri
    if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) {
      return 'tauri';
    }
  }
  
  // Default to mock for web
  return 'mock';
}

/**
 * Create a backend adapter of the specified type
 */
export async function createAdapter(type?: BackendType): Promise<BackendAdapter> {
  const backendType = type || detectBackendType();
  
  console.log(`[Adapter] Creating ${backendType} adapter`);
  
  let adapter: BackendAdapter;
  
  switch (backendType) {
    case 'tauri': {
      const { createTauriAdapter } = await import('./tauri');
      adapter = createTauriAdapter();
      break;
    }
    case 'server': {
      // Server adapter will be implemented later
      // For now, fall back to mock
      console.warn('[Adapter] Server adapter not yet implemented, using mock');
      const { createMockAdapter } = await import('./mock');
      adapter = createMockAdapter();
      break;
    }
    case 'mock':
    default: {
      const { createMockAdapter } = await import('./mock');
      adapter = createMockAdapter();
      break;
    }
  }
  
  await adapter.init();
  return adapter;
}

/**
 * Get the singleton adapter instance
 * Creates one if it doesn't exist
 */
export async function getAdapter(): Promise<BackendAdapter> {
  if (!adapterInstance) {
    adapterInstance = await createAdapter();
  }
  return adapterInstance;
}

/**
 * Set a custom adapter instance (useful for testing)
 */
export function setAdapter(adapter: BackendAdapter): void {
  adapterInstance = adapter;
}

/**
 * Reset the adapter instance
 */
export async function resetAdapter(): Promise<void> {
  if (adapterInstance) {
    await adapterInstance.dispose();
    adapterInstance = null;
  }
}

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  return detectBackendType() === 'tauri';
}

/**
 * Check if running in mock/demo mode
 */
export function isMock(): boolean {
  return detectBackendType() === 'mock';
}

/**
 * Check if running with server backend
 */
export function isServer(): boolean {
  return detectBackendType() === 'server';
}
