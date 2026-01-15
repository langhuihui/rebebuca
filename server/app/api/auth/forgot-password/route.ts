export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getDB, generateId, User } from '@/lib/db';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string };
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const db = getDB();

    // Find user
    const user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<User>();

    if (user) {
      // Generate reset token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry
      const now = new Date().toISOString();

      // Store reset token
      await db.prepare(`
        INSERT INTO password_reset_tokens (id, user_id, token, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(generateId(), user.id, token, expiresAt.toISOString(), now).run();

      // TODO: Send email with reset link
      // For now, just log the token (in production, send email)
      console.log(`Password reset token for ${email}: ${token}`);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message: 'If an account exists with this email, you will receive a password reset link',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
