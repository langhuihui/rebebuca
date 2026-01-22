export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getDB, generateId, User } from '@/lib/db';
import { verifyPassword, createAccessToken, createRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';
import { cookies } from 'next/headers';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const db = getDB();

    // Find user
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user has password
    // OAuth users may not have a password_hash unless they set one later
    // If they have a password, we allow login regardless of auth_provider
    if (!user.password_hash) {
      const provider = user.auth_provider || 'OAuth';
      return NextResponse.json(
        { error: `This account uses ${provider} login. Please use your ${provider} provider to login, or reset your password to enable email login.` },
        { status: 401 }
      );
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create tokens
    const accessToken = await createAccessToken(user.id, user.email);
    const refreshToken = await createRefreshToken(user.id, user.email);
    const refreshExpiry = getRefreshTokenExpiry();
    const now = new Date().toISOString();

    // Store refresh token
    await db.prepare(`
      INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(generateId(), user.id, refreshToken, refreshExpiry.toISOString(), now).run();

    // Set cookies
    const cookieStore = await cookies();
    cookieStore.set('access_token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });
    cookieStore.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        locale: user.locale,
        emailConfirmed: user.email_verified === 1,
        createdAt: user.created_at,
      },
      session: {
        accessToken,
        refreshToken,
        // Access tokens are 7 days by default
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
