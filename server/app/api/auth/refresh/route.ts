import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDB, generateId, User, Session } from '@/lib/db';
import { verifyToken, createAccessToken, createRefreshToken, getRefreshTokenExpiry } from '@/lib/auth';


export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    let refreshToken = cookieStore.get('refresh_token')?.value;

    // Support desktop/API clients that send refreshToken in JSON body
    if (!refreshToken) {
      try {
        const body = await request.json() as { refreshToken?: string };
        if (body?.refreshToken) {
          refreshToken = body.refreshToken;
        }
      } catch {
        // ignore invalid json
      }
    }

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token' },
        { status: 401 }
      );
    }

    // Verify refresh token
    const payload = await verifyToken(refreshToken);
    if (!payload || payload.type !== 'refresh') {
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      );
    }

    const db = await getDB();

    // Check if session exists and is valid
    const session = await db.prepare(`
      SELECT * FROM sessions WHERE refresh_token = ? AND expires_at > datetime('now')
    `).bind(refreshToken).first<Session>();

    if (!session) {
      return NextResponse.json(
        { error: 'Session expired or invalid' },
        { status: 401 }
      );
    }

    // Get user
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(payload.sub).first<User>();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // Create new tokens
    const newAccessToken = await createAccessToken(user.id, user.email);
    const newRefreshToken = await createRefreshToken(user.id, user.email);
    const refreshExpiry = getRefreshTokenExpiry();
    const now = new Date().toISOString();

    // Delete old session and create new one
    await db.batch([
      db.prepare('DELETE FROM sessions WHERE refresh_token = ?').bind(refreshToken),
      db.prepare(`
        INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(generateId(), user.id, newRefreshToken, refreshExpiry.toISOString(), now),
    ]);

    // Set cookies
    cookieStore.set('access_token', newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });
    cookieStore.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return NextResponse.json({
      message: 'Token refreshed',
      session: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
