export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDB } from '@/lib/db';


// GET /api/user/invitation-status - Check if user has used an invitation code
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Super admin and admin don't need invitation code
    if (user.role === 'super_admin' || user.role === 'admin') {
      return NextResponse.json({
        hasUsedInvitationCode: true,
      });
    }

    const db = getDB();

    // Check if user has used an invitation code (used_by_user_id points to this user)
    const usedCode = await db.prepare(`
      SELECT id FROM invitation_codes
      WHERE used_by_user_id = ?
      LIMIT 1
    `).bind(user.id).first();

    return NextResponse.json({
      hasUsedInvitationCode: !!usedCode,
    });
  } catch (error) {
    console.error('Get invitation status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
