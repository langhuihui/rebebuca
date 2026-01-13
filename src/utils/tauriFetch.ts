/**
 * Tauri HTTP fetch wrapper
 * Uses Tauri's HTTP plugin for network requests in Tauri environment
 * Falls back to native fetch in browser environment
 */

let tauriFetchFn: typeof fetch | null = null;

/**
 * Initialize Tauri HTTP plugin (only in Tauri environment)
 */
async function initTauriHttp() {
  if (tauriFetchFn) return tauriFetchFn;
  
  try {
    // Check if running in Tauri
    const isTauri = typeof window !== 'undefined' && 
      ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI_METADATA__);
    
    if (isTauri) {
      console.log('[TauriFetch] Detected Tauri environment, loading HTTP plugin...');
      const http = await import('@tauri-apps/plugin-http');
      // Tauri HTTP plugin's fetch is compatible with standard fetch API
      tauriFetchFn = http.fetch as typeof fetch;
      console.log('[TauriFetch] Tauri HTTP plugin loaded successfully');
      return tauriFetchFn;
    } else {
      console.log('[TauriFetch] Not in Tauri environment, will use native fetch');
    }
  } catch (error) {
    console.error('[TauriFetch] Failed to load Tauri HTTP plugin:', error);
  }
  
  return null;
}

/**
 * Tauri-aware fetch implementation
 * Uses Tauri HTTP plugin in Tauri environment, native fetch otherwise
 */
export async function tauriFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();
  
  // Try to use Tauri HTTP plugin if available
  const httpFetch = await initTauriHttp();
  
  if (httpFetch) {
    try {
      console.log('[TauriFetch] Using Tauri HTTP plugin for:', url);
      const response = await httpFetch(input, init);
      console.log('[TauriFetch] Tauri HTTP response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });
      return response;
    } catch (error) {
      console.error('[TauriFetch] Tauri HTTP request failed:', {
        error: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        url,
      });
      // Don't fall back to native fetch - throw the error instead
      throw error;
    }
  }
  
  // Fall back to native fetch (only in browser environment)
  console.warn('[TauriFetch] WARNING: Using native fetch (not in Tauri environment):', url);
  return fetch(input, init);
}
