export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getDB, generateId } from '@/lib/db';
import { hashPassword, createAccessToken, createRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';
import { cookies } from 'next/headers';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; password?: string; displayName?: string; locale?: string };
    const { email, password, displayName, locale } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const db = getDB();

    // Check if user already exists
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const userId = generateId();
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, locale, auth_provider, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'email', ?, ?)
    `).bind(userId, email, passwordHash, displayName || email.split('@')[0], locale || 'en', now, now).run();

    // Create tokens
    const accessToken = await createAccessToken(userId, email);
    const refreshToken = await createRefreshToken(userId, email);
    const refreshExpiry = getRefreshTokenExpiry();

    // Store refresh token
    await db.prepare(`
      INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(generateId(), userId, refreshToken, refreshExpiry.toISOString(), now).run();

    // Set cookies
    const cookieStore = await cookies();
    cookieStore.set('access_token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 15 * 60, // 15 minutes
      path: '/',
    });
    cookieStore.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return NextResponse.json({
      message: 'Registration successful',
      user: {
        id: userId,
        email,
        displayName: displayName || email.split('@')[0],
        locale: locale || 'en',
        emailConfirmed: false,
        createdAt: now,
      },
      session: {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + 15 * 60 * 1000,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
