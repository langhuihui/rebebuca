import { jwtVerify, createRemoteJWKSet } from 'jose';

// Cloudflare Access configuration
const CF_ACCESS_TEAM_DOMAIN = 'https://langhuihui.cloudflareaccess.com';
const CF_ACCESS_CERTS_URL = `${CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`;
const CF_ACCESS_AUD = '40f924bfc8dcc59e438eb42e71ea0e9b7778447709c0be3b28601ec9972c3c1e';

// Cache JWKS for performance
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwksCache) {
    jwksCache = createRemoteJWKSet(new URL(CF_ACCESS_CERTS_URL));
  }
  return jwksCache;
}

export interface CloudflareAccessPayload {
  email: string;
  sub: string; // User ID from identity provider
  aud: string[];
  iss: string;
  iat: number;
  exp: number;
  type: string;
  identity_nonce: string;
  custom?: Record<string, unknown>;
}

export async function verifyCloudflareAccessJWT(request: Request): Promise<CloudflareAccessPayload | null> {
  // Get JWT from cookie or header
  const cfAccessJwt = request.headers.get('CF-Access-JWT-Assertion');
  
  if (!cfAccessJwt) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(cfAccessJwt, getJWKS(), {
      audience: CF_ACCESS_AUD,
      issuer: CF_ACCESS_TEAM_DOMAIN,
    });

    return payload as unknown as CloudflareAccessPayload;
  } catch (error) {
    console.error('Cloudflare Access JWT verification failed:', error);
    return null;
  }
}

export function getCloudflareAccessEmail(request: Request): string | null {
  return request.headers.get('CF-Access-Authenticated-User-Email');
}
