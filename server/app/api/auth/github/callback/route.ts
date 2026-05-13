import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { jwtVerify } from 'jose';
import { getDB, generateId, User, createInvitationCodesForUser } from '@/lib/db';
import { createAccessToken, createRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';
import { cookies } from 'next/headers';


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

// GitHub OAuth callback: Exchange code for token and login/register user
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle errors from GitHub
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/login?error=missing_params`);
  }

  // Verify state for CSRF protection
  // - Legacy web flow uses random UUID state stored in cookie
  // - Local web UI flow uses signed JWT state carrying an optional loopback redirect
  const ctx = await getCloudflareContext({ async: true });
  let appRedirect: string | undefined;

  // 1) Try signed JWT state (local / loopback OAuth)
  try {
    const secret = new TextEncoder().encode(ctx.env.JWT_SECRET || 'default-secret-change-in-production');
    const { payload } = await jwtVerify(state, secret);
    const p = payload as unknown as Partial<OAuthStatePayload>;

    if (p.typ === 'oauth_state' && p.provider === 'github') {
      if (typeof p.redirect === 'string' && isAllowedLoopbackRedirect(p.redirect)) {
        appRedirect = p.redirect;
      }
    } else {
      // If it looks like a JWT but isn't our payload, treat as invalid.
      // (If it's a UUID, jwtVerify throws and we will fallback below.)
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
    const clientId = ctx.env.GITHUB_CLIENT_ID;
    const clientSecret = ctx.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${origin}/login?error=oauth_not_configured`);
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
      return NextResponse.redirect(`${origin}/login?error=token_exchange_failed`);
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
      return NextResponse.redirect(`${origin}/login?error=github_user_fetch_failed`);
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
      return NextResponse.redirect(`${origin}/login?error=no_email`);
    }

    const db = await getDB();
    const now = new Date().toISOString();

    // Find or create user
    let user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();

    if (!user) {
      // Create new user
      const userId = generateId();
      await db.prepare(`
        INSERT INTO users (id, email, password_hash, display_name, avatar_url, email_verified, auth_provider, role, is_banned, created_at, updated_at)
        VALUES (?, ?, NULL, ?, ?, 1, 'github', 'user', 0, ?, ?)
      `).bind(
        userId,
        email,
        githubUser.name || githubUser.login,
        githubUser.avatar_url,
        now,
        now
      ).run();
      
      // Create 3 invitation codes for the new user
      await createInvitationCodesForUser(userId, 3);
      
      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<User>();
    } else {
      // Update existing user's avatar if they logged in with GitHub
      await db.prepare(`
        UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?
      `).bind(githubUser.avatar_url, now, user.id).run();
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

    // If this was a local loopback OAuth flow, redirect back to the app with tokens.
    if (appRedirect) {
      const callbackUrl = new URL(appRedirect);
      callbackUrl.searchParams.set('accessToken', jwtAccessToken);
      callbackUrl.searchParams.set('refreshToken', refreshToken);
      callbackUrl.searchParams.set('provider', 'github');

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
    console.error('GitHub OAuth error:', error);
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }
}
