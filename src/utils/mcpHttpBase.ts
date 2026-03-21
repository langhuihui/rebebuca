/**
 * HTTP origin of the Rebebuca Node backend (where /health, /mcp/* live).
 * Under Vite dev, the page is on a different port than the backend; MCP must target the WS host.
 */
export function getMcpHttpBase(): string {
  const raw = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (raw && /^wss?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      const proto = u.protocol === 'wss:' ? 'https:' : 'http:';
      return `${proto}//${u.host}`;
    } catch {
      /* fall through */
    }
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://127.0.0.1:3000';
}
