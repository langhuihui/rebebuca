/**
 * Backend-aware fetch: uses /api/proxy in server mode to avoid CORS, native fetch otherwise.
 */

import { detectBackendType } from '../adapters';

function buildProxyUrl(targetUrl: string): string {
  const protocol = window.location.protocol;
  const host = window.location.host;
  return `${protocol}//${host}/api/proxy?url=${encodeURIComponent(targetUrl)}`;
}

export async function proxyFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();
  const backendType = detectBackendType();

  if (backendType === 'server') {
    const proxyUrl = buildProxyUrl(url);
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
    delete headersObj['X-Proxy-Headers'];
    delete headersObj['host'];
    delete headersObj['content-length'];

    return fetch(proxyUrl, {
      method: init?.method || 'GET',
      headers: headersObj,
      body: init?.body,
    });
  }

  return fetch(input, init);
}
