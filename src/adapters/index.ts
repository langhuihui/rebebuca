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
/** True while the user is intentionally stopping the local backend (close-service button). */
let serviceShuttingDown = false;

// Declare the global constant defined by Vite
declare const __VITE_BACKEND__: string;

/**
 * Detect the backend type from environment
 */
export function detectBackendType(): BackendType {
  // Check compile-time constant first (set via vite.config.ts define)
  const envBackend = typeof __VITE_BACKEND__ !== 'undefined' ? __VITE_BACKEND__ : '';
  if (envBackend && ['server', 'mock'].includes(envBackend)) {
    return envBackend as BackendType;
  }

  if (typeof window !== 'undefined') {
    if (import.meta.env?.VITE_SERVER_URL) {
      return 'server';
    }
    
    // npx rebebuca default HTTP port (when build lacks __VITE_BACKEND__ at runtime)
    const { hostname, port } = window.location;
    const isLocalHost =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    if (isLocalHost && (port === '3000' || port === '8765')) {
      return 'server';
    }
    if (window.location.pathname.startsWith('/app')) {
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
  adapterPromise = null;
}

/** Whether the local backend is being stopped on purpose (not an unexpected disconnect). */
export function isServiceShuttingDown(): boolean {
  return serviceShuttingDown;
}

/** Call before killing the backend process so WebSocket teardown is treated as expected. */
export function markServiceShuttingDown(): void {
  serviceShuttingDown = true;
  adapterInstance?.prepareShutdown?.();
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
