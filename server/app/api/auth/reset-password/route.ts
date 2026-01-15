export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { hashPassword } from '@/lib/auth';


interface ResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  used: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { token?: string; password?: string };
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
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

    // Find valid reset token
    const resetToken = await db.prepare(`
      SELECT * FROM password_reset_tokens 
      WHERE token = ? AND used = 0 AND expires_at > datetime('now')
    `).bind(token).first<ResetToken>();

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    // Update password and mark token as used
    await db.batch([
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
        .bind(passwordHash, now, resetToken.user_id),
      db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?')
        .bind(resetToken.id),
      // Invalidate all sessions for this user
      db.prepare('DELETE FROM sessions WHERE user_id = ?')
        .bind(resetToken.user_id),
    ]);

    return NextResponse.json({
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
