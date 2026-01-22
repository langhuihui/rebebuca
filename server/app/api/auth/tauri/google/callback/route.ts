export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { jwtVerify } from 'jose';
import { getDB, generateId, User, createInvitationCodesForUser } from '@/lib/db';
import { createAccessToken, createRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUser {
  sub: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture: string;
  email: string;
  email_verified: boolean;
}

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
    if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// Google OAuth callback for Tauri/desktop apps.
// Exchanges `code` for Google token, creates Rebebuca session tokens, then:
// - if state contains a loopback redirect, redirects browser to it with tokens
// - otherwise returns JSON
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.json(
      { error: 'Google authorization failed', details: error },
      { status: 400 }
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: 'Missing required parameters', details: 'code and state are required' },
      { status: 400 }
    );
  }

  // Verify signed state (stateless, no cookies)
  let appRedirect: string | undefined;
  try {
    const ctx = getRequestContext();
    const secret = new TextEncoder().encode(ctx.env.JWT_SECRET || 'default-secret-change-in-production');
    const { payload } = await jwtVerify(state, secret);

    const typ = payload.typ;
    const provider = payload.provider;
    const redirect = payload.redirect;

    if (typ !== 'oauth_state' || provider !== 'google') {
      return NextResponse.json(
        { error: 'Invalid state', details: 'State verification failed' },
        { status: 400 }
      );
    }

    if (typeof redirect === 'string' && isAllowedLoopbackRedirect(redirect)) {
      appRedirect = redirect;
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid state', details: 'State verification failed' },
      { status: 400 }
    );
  }

  try {
    const ctx = getRequestContext();
    const clientId = ctx.env.GOOGLE_CLIENT_ID;
    const clientSecret = ctx.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'OAuth not configured', details: 'Google OAuth is not properly configured' },
        { status: 500 }
      );
    }

    const redirectUri = `${origin}/api/auth/tauri/google/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json() as GoogleTokenResponse;

    if (tokenData.error) {
      console.error('Google token error:', tokenData.error_description);
      return NextResponse.json(
        { error: 'Token exchange failed', details: tokenData.error_description },
        { status: 400 }
      );
    }

    const accessToken = tokenData.access_token;

    // Fetch user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch user info', details: userResponse.statusText },
        { status: 400 }
      );
    }

    const googleUser = await userResponse.json() as GoogleUser;

    if (!googleUser.email) {
      return NextResponse.json(
        { error: 'No email found', details: 'Google user has no email address' },
        { status: 400 }
      );
    }

    const db = getDB();
    const now = new Date().toISOString();

    // Find or create user
    let user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(googleUser.email).first<User>();

    if (!user) {
      const userId = generateId();
      await db.prepare(`
        INSERT INTO users (id, email, password_hash, display_name, avatar_url, email_verified, auth_provider, role, is_banned, created_at, updated_at)
        VALUES (?, ?, NULL, ?, ?, 1, 'google', 'user', 0, ?, ?)
      `).bind(
        userId,
        googleUser.email,
        googleUser.name,
        googleUser.picture,
        now,
        now
      ).run();

      // Create 3 invitation codes for the new user
      await createInvitationCodesForUser(userId, 3);

      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<User>();
    } else {
      await db.prepare(`
        UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?
      `).bind(googleUser.picture, now, user.id).run();
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User creation failed', details: 'Failed to create or retrieve user' },
        { status: 500 }
      );
    }

    // Create JWT tokens
    const jwtAccessToken = await createAccessToken(user.id, user.email);
    const refreshToken = await createRefreshToken(user.id, user.email);
    const refreshExpiry = getRefreshTokenExpiry();

    // Store refresh token in session
    await db.prepare(`
      INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(generateId(), user.id, refreshToken, refreshExpiry.toISOString(), now).run();

    // If we have a loopback redirect, send tokens back to the desktop app.
    if (appRedirect) {
      const callbackUrl = new URL(appRedirect);
      callbackUrl.searchParams.set('accessToken', jwtAccessToken);
      callbackUrl.searchParams.set('refreshToken', refreshToken);
      callbackUrl.searchParams.set('provider', 'google');

      return NextResponse.redirect(callbackUrl.toString());
    }

    // Fallback: return JSON (useful for debugging)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
      },
      tokens: {
        accessToken: jwtAccessToken,
        refreshToken: refreshToken,
      },
      origin,
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.json(
      { error: 'OAuth failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
