export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { jwtVerify } from 'jose';
import { getDB, generateId, User, createInvitationCodesForUser } from '@/lib/db';
import { createAccessToken, createRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';
import { cookies } from 'next/headers';


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

// Google OAuth callback: Exchange code for token and login/register user
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle errors from Google
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/login?error=missing_params`);
  }

  // Verify state for CSRF protection
  // - Legacy web flow uses random UUID state stored in cookie
  // - Tauri flow uses signed JWT state carrying an optional loopback redirect
  const ctx = getRequestContext();
  let appRedirect: string | undefined;

  // 1) Try signed JWT state (Tauri)
  try {
    const secret = new TextEncoder().encode(ctx.env.JWT_SECRET || 'default-secret-change-in-production');
    const { payload } = await jwtVerify(state, secret);
    const p = payload as unknown as Partial<OAuthStatePayload>;

    if (p.typ === 'oauth_state' && p.provider === 'google') {
      if (typeof p.redirect === 'string' && isAllowedLoopbackRedirect(p.redirect)) {
        appRedirect = p.redirect;
      }
    } else {
      return NextResponse.redirect(`${origin}/login?error=invalid_state`);
    }
  } catch {
    // 2) Fallback to legacy cookie state (web)
    const cookieStore = await cookies();
    const savedState = cookieStore.get('oauth_state')?.value;

    if (!savedState || savedState !== state) {
      return NextResponse.redirect(`${origin}/login?error=invalid_state`);
    }
  }

  try {
    const clientId = ctx.env.GOOGLE_CLIENT_ID;
    const clientSecret = ctx.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${origin}/login?error=oauth_not_configured`);
    }

    const redirectUri = `${origin}/api/auth/google/callback`;

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
      return NextResponse.redirect(`${origin}/login?error=token_exchange_failed`);
    }

    const accessToken = tokenData.access_token;

    // Fetch user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(`${origin}/login?error=google_user_fetch_failed`);
    }

    const googleUser = await userResponse.json() as GoogleUser;

    if (!googleUser.email) {
      return NextResponse.redirect(`${origin}/login?error=no_email`);
    }

    const db = getDB();
    const now = new Date().toISOString();

    // Find or create user
    let user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(googleUser.email).first<User>();

    if (!user) {
      // Create new user
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
      // Update existing user's avatar if they logged in with Google
      await db.prepare(`
        UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?
      `).bind(googleUser.picture, now, user.id).run();
    }

    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=user_creation_failed`);
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

    // If this was a Tauri OAuth flow, redirect back to loopback callback with tokens.
    if (appRedirect) {
      const callbackUrl = new URL(appRedirect);
      callbackUrl.searchParams.set('accessToken', jwtAccessToken);
      callbackUrl.searchParams.set('refreshToken', refreshToken);
      callbackUrl.searchParams.set('provider', 'google');

      const resp = NextResponse.redirect(callbackUrl.toString());
      resp.cookies.delete('oauth_state');
      return resp;
    }

    // Default web flow: set cookies and redirect to dashboard
    const response = NextResponse.redirect(`${origin}/dashboard`);

    response.cookies.set('access_token', jwtAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 15 * 60, // 15 minutes
      path: '/',
    });

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    // Clear OAuth state cookie
    response.cookies.delete('oauth_state');

    return response;
  } catch (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }
}
