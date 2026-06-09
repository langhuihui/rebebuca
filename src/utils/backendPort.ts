const DEFAULT_BACKEND_PORT = 3000;

/**
 * Resolve the HTTP port the Rebebuca backend is serving on.
 * Prefer runtime window.location (production npx rebebuca), then build-time VITE_SERVER_URL.
 */
export function resolveBackendPort(): number {
  if (typeof window !== 'undefined' && window.location.hostname) {
    const { port, protocol } = window.location;
    if (port) return Number(port);
    return protocol === 'https:' ? 443 : 80;
  }

  const serverUrl = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (serverUrl) {
    try {
      const url = new URL(serverUrl);
      if (url.port) return Number(url.port);
      return url.protocol === 'wss:' || url.protocol === 'https:' ? 443 : DEFAULT_BACKEND_PORT;
    } catch {
      // fall through
    }
  }

  return DEFAULT_BACKEND_PORT;
}
