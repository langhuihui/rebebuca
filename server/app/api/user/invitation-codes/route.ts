export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDB, InvitationCode } from '@/lib/db';


// GET /api/user/invitation-codes - Get user's invitation codes
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const db = getDB();

    const { results: codes } = await db.prepare(`
      SELECT * FROM invitation_codes
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(user.id).all<InvitationCode>();

    // Format invitation codes
    const formattedCodes = codes.map((code) => ({
      id: code.id,
      code: code.code,
      usedByUserId: code.used_by_user_id,
      usedAt: code.used_at,
      createdAt: code.created_at,
      isUsed: code.used_by_user_id !== null,
    }));

    return NextResponse.json({
      codes: formattedCodes,
    });
  } catch (error) {
    console.error('Get invitation codes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
