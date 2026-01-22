/**
 * Tauri HTTP fetch wrapper
 * Uses Tauri's HTTP plugin for network requests in Tauri environment
 * Uses proxy API for server mode to avoid CORS issues
 * Falls back to native fetch in browser environment
 */

import { detectBackendType } from '../adapters';

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
 * Build proxy URL for server mode
 */
function buildProxyUrl(targetUrl: string): string {
  const protocol = window.location.protocol;
  const host = window.location.host;
  // Encode the target URL as a query parameter
  return `${protocol}//${host}/api/proxy?url=${encodeURIComponent(targetUrl)}`;
}

/**
 * Tauri-aware fetch implementation
 * Uses Tauri HTTP plugin in Tauri environment
 * Uses proxy API in server mode to avoid CORS
 * Falls back to native fetch otherwise
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
      
      // Log headers for debugging
      if (init?.headers) {
        const headersObj = init.headers instanceof Headers 
          ? Object.fromEntries(init.headers.entries())
          : init.headers;
        console.log('[TauriFetch] Request headers:', JSON.stringify(headersObj, null, 2));
      } else {
        console.log('[TauriFetch] No headers in request');
      }
      
      const response = await httpFetch(input, init);
      console.log('[TauriFetch] Tauri HTTP response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });
      
      // Log response body for error debugging
      if (!response.ok) {
        const body = await response.clone().text().catch(() => ' unable to read body');
        console.log('[TauriFetch] Error response body:', body.substring(0, 500));
      }
      
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
  
  // Check if we're in server mode - use proxy to avoid CORS
  const backendType = detectBackendType();
  if (backendType === 'server') {
    console.log('[TauriFetch] Using proxy for server mode:', url);
    const proxyUrl = buildProxyUrl(url);

    // Convert headers to plain object for proper serialization
    const headersObj: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headersObj[key] = value;
        });
      } else if (Array.isArray(init.headers)) {
        for (const [key, value] of init.headers) {
          headersObj[key] = value;
        }
      } else {
        Object.assign(headersObj, init.headers);
      }
    }

    // Remove problematic headers that shouldn't be forwarded through proxy
    delete headersObj['X-Proxy-Headers'];
    delete headersObj['host'];
    delete headersObj['content-length'];

    console.log('[TauriFetch] Proxy request headers:', Object.keys(headersObj));

    try {
      const response = await fetch(proxyUrl, {
        method: init?.method || 'GET',
        headers: headersObj,
        body: init?.body
      });
      console.log('[TauriFetch] Proxy response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      // Log error details if not ok
      if (!response.ok) {
        try {
          const errorText = await response.clone().text();
          console.error('[TauriFetch] Proxy error response body:', errorText);
        } catch {
          // Ignore clone errors
        }
      }

      return response;
    } catch (error) {
      console.error('[TauriFetch] Proxy request failed:', {
        error: error instanceof Error ? error.message : String(error),
        url,
      });
      throw error;
    }
  }
  
  // Fall back to native fetch (only in browser environment)
  console.warn('[TauriFetch] WARNING: Using native fetch (not in Tauri environment):', url);
  return fetch(input, init);
}
