export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDB } from '@/lib/db';


// POST /api/user/use-invitation-code - Use an invitation code
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as { code?: string };
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Invitation code is required' },
        { status: 400 }
      );
    }

    const db = getDB();

    // Check if user has already used an invitation code
    const existingUsage = await db.prepare(`
      SELECT id FROM invitation_codes
      WHERE used_by_user_id = ?
      LIMIT 1
    `).bind(user.id).first();

    if (existingUsage) {
      return NextResponse.json(
        { error: 'You have already used an invitation code' },
        { status: 400 }
      );
    }

    // Find the invitation code
    const invitationCode = await db.prepare(`
      SELECT * FROM invitation_codes
      WHERE code = ?
    `).bind(code.toUpperCase().replace(/\s+/g, '-')).first();

    if (!invitationCode) {
      return NextResponse.json(
        { error: 'Invalid invitation code' },
        { status: 404 }
      );
    }

    // Check if code is already used
    if (invitationCode.used_by_user_id) {
      return NextResponse.json(
        { error: 'This invitation code has already been used' },
        { status: 400 }
      );
    }

    // Check if user is trying to use their own invitation code
    if (invitationCode.user_id === user.id) {
      return NextResponse.json(
        { error: 'You cannot use your own invitation code' },
        { status: 400 }
      );
    }

    // Mark the code as used
    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE invitation_codes
      SET used_by_user_id = ?, used_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(user.id, now, now, invitationCode.id).run();

    return NextResponse.json({
      message: 'Invitation code used successfully',
    });
  } catch (error) {
    console.error('Use invitation code error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
