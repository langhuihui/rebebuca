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
// Promise for adapter creation (to prevent race conditions)
let adapterPromise: Promise<BackendAdapter> | null = null;

// Declare the global constant defined by Vite
declare const __VITE_BACKEND__: string;

/**
 * Detect the backend type from environment
 */
export function detectBackendType(): BackendType {
  // Check compile-time constant first (set via vite.config.ts define)
  const envBackend = typeof __VITE_BACKEND__ !== 'undefined' ? __VITE_BACKEND__ : '';
  if (envBackend && ['tauri', 'server', 'mock'].includes(envBackend)) {
    return envBackend as BackendType;
  }
  
  // Auto-detect based on environment
  if (typeof window !== 'undefined') {
    // Check if running in Tauri
    if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) {
      return 'tauri';
    }
    
    // Check if served from remote-agent-server (has /ws endpoint on same origin)
    // This is detected by checking if we're not in Tauri and not on a typical dev server port
    // or if VITE_SERVER_URL is set
    if (import.meta.env?.VITE_SERVER_URL) {
      return 'server';
    }
    
    // Check if the page was served with /ws path available (server mode indicator)
    // The remote-agent-server serves static files and has /ws endpoint
    const isServerMode = window.location.port === '8765' || 
                         window.location.pathname.startsWith('/app');
    if (isServerMode) {
      return 'server';
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
      const { createServerAdapter } = await import('./server');
      adapter = createServerAdapter();
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
 * Uses a promise to prevent race conditions during initialization
 */
export async function getAdapter(): Promise<BackendAdapter> {
  // If we already have an instance, return it
  if (adapterInstance) {
    return adapterInstance;
  }
  
  // If we're already creating an instance, wait for it
  if (adapterPromise) {
    return adapterPromise;
  }
  
  // Create a new instance
  adapterPromise = createAdapter().then(adapter => {
    adapterInstance = adapter;
    return adapter;
  }).catch(error => {
    console.error('[Adapter] Failed to create adapter:', error);
    // Reset promise so we can retry
    adapterPromise = null;
    throw error;
  });
  
  return adapterPromise;
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
