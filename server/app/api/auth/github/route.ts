import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';


// GitHub OAuth: Redirect to GitHub authorization
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const ctx = await getCloudflareContext({ async: true });
  
  const clientId = ctx.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'GitHub OAuth not configured' }, { status: 500 });
  }

  const redirectUri = `${origin}/api/auth/github/callback`;
  const state = crypto.randomUUID(); // CSRF protection
  
  // Store state in cookie for verification
  const response = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=${state}`
  );
  
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });
  
  return response;
}
