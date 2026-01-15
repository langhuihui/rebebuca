export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { jwtVerify } from 'jose';
import { getDB, generateId, User } from '@/lib/db';
import { createAccessToken, createRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
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

// GitHub OAuth callback for Tauri/desktop apps.
// Exchanges `code` for GitHub token, creates Rebebuca session tokens, then:
// - if state contains a loopback redirect, redirects browser to it with tokens
// - otherwise returns JSON
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.json(
      { error: 'GitHub authorization failed', details: error },
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

    if (typ !== 'oauth_state' || provider !== 'github') {
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
    const clientId = ctx.env.GITHUB_CLIENT_ID;
    const clientSecret = ctx.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'OAuth not configured', details: 'GitHub OAuth is not properly configured' },
        { status: 500 }
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json() as GitHubTokenResponse;

    if (tokenData.error) {
      console.error('GitHub token error:', tokenData.error_description);
      return NextResponse.json(
        { error: 'Token exchange failed', details: tokenData.error_description },
        { status: 400 }
      );
    }

    const accessToken = tokenData.access_token;

    // Fetch user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'User-Agent': 'Rebebuca-App',
      },
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch user info', details: userResponse.statusText },
        { status: 400 }
      );
    }

    const githubUser = await userResponse.json() as GitHubUser;

    // Get user's email (may need to fetch from emails endpoint if private)
    let email = githubUser.email;

    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'User-Agent': 'Rebebuca-App',
        },
      });

      if (emailsResponse.ok) {
        const emails = await emailsResponse.json() as GitHubEmail[];
        const primaryEmail = emails.find(e => e.primary && e.verified);
        email = primaryEmail?.email || emails[0]?.email;
      }
    }

    if (!email) {
      return NextResponse.json(
        { error: 'No email found', details: 'GitHub user has no email address' },
        { status: 400 }
      );
    }

    const db = getDB();
    const now = new Date().toISOString();

    // Find or create user
    let user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();

    if (!user) {
      const userId = generateId();
      await db.prepare(`
        INSERT INTO users (id, email, password_hash, display_name, avatar_url, email_verified, auth_provider, created_at, updated_at)
        VALUES (?, ?, NULL, ?, ?, 1, 'github', ?, ?)
      `).bind(
        userId,
        email,
        githubUser.name || githubUser.login,
        githubUser.avatar_url,
        now,
        now
      ).run();

      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<User>();
    } else {
      await db.prepare(`
        UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?
      `).bind(githubUser.avatar_url, now, user.id).run();
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
      // helps local handler sanity-check
      callbackUrl.searchParams.set('provider', 'github');

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
    console.error('GitHub OAuth error:', error);
    return NextResponse.json(
      { error: 'OAuth failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
