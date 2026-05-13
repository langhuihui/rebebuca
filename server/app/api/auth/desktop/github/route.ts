import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SignJWT } from 'jose';

const STATE_ALG = 'HS256';

type OAuthStatePayload = {
  typ: 'oauth_state';
  provider: 'github' | 'google';
  nonce: string;
  redirect?: string;
};

function isAllowedLoopbackRedirect(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:') return false;
    // allow only loopback
    if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// GitHub OAuth: return GitHub authorization URL for local web UI (loopback redirect).
// The `state` is a short-lived signed JWT and may include a loopback redirect URL.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const ctx = await getCloudflareContext({ async: true });

  const clientId = ctx.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'GitHub OAuth not configured' }, { status: 500 });
  }

  // IMPORTANT: use the same callback as web OAuth so we don't need extra GitHub callback URLs
  const redirectUri = `${origin}/api/auth/github/callback`;

  const appRedirect = searchParams.get('redirect');
  const redirect = appRedirect && isAllowedLoopbackRedirect(appRedirect) ? appRedirect : undefined;

  const secret = new TextEncoder().encode(ctx.env.JWT_SECRET || 'default-secret-change-in-production');

  const statePayload: OAuthStatePayload = {
    typ: 'oauth_state',
    provider: 'github',
    nonce: crypto.randomUUID(),
    ...(redirect ? { redirect } : {}),
  };

  const state = await new SignJWT(statePayload)
    .setProtectedHeader({ alg: STATE_ALG })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secret);

  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=${encodeURIComponent(state)}`;

  return NextResponse.json({ url, state });
}
