import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getDB, generateId, generateInvitationCode, InvitationCode } from '@/lib/db';

// POST /api/admin/invitation-codes - Generate invitation codes
export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireSuperAdmin();

    const body = await request.json() as { count?: number; userId?: string };
    const { count = 1, userId } = body;

    if (count < 1 || count > 100) {
      return NextResponse.json(
        { error: 'Count must be between 1 and 100' },
        { status: 400 }
      );
    }

    const db = await getDB();
    const now = new Date().toISOString();
    const codes: InvitationCode[] = [];

    // If userId is provided, generate codes for that user
    // Otherwise, generate codes for the current user (super admin)
    const targetUserId = userId || currentUser.id;

    for (let i = 0; i < count; i++) {
      let code: string;
      let attempts = 0;
      
      // Ensure code uniqueness
      do {
        code = generateInvitationCode();
        attempts++;
        if (attempts > 10) {
          throw new Error('Failed to generate unique invitation code');
        }
      } while (await db.prepare('SELECT id FROM invitation_codes WHERE code = ?').bind(code).first());

      const id = generateId();
      await db.prepare(`
        INSERT INTO invitation_codes (id, user_id, code, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(id, targetUserId, code, now, now).run();

      const createdCode = await db.prepare('SELECT * FROM invitation_codes WHERE id = ?').bind(id).first<InvitationCode>();
      if (createdCode) {
        codes.push(createdCode);
      }
    }

    return NextResponse.json({
      codes: codes.map(c => ({
        id: c.id,
        code: c.code,
        userId: c.user_id,
        usedByUserId: c.used_by_user_id,
        usedAt: c.used_at,
        createdAt: c.created_at,
        isUsed: c.used_by_user_id !== null,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    console.error('Generate invitation codes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/admin/invitation-codes - Get all invitation codes
export async function GET() {
  try {
    await requireSuperAdmin();

    const db = await getDB();

    const { results: codes } = await db.prepare(`
      SELECT ic.*, 
             u1.email as creator_email,
             u2.email as used_by_email
      FROM invitation_codes ic
      LEFT JOIN users u1 ON ic.user_id = u1.id
      LEFT JOIN users u2 ON ic.used_by_user_id = u2.id
      ORDER BY ic.created_at DESC
      LIMIT 1000
    `).all<InvitationCode & { creator_email: string | null; used_by_email: string | null }>();

    return NextResponse.json({
      codes: codes.map(c => ({
        id: c.id,
        code: c.code,
        userId: c.user_id,
        creatorEmail: c.creator_email,
        usedByUserId: c.used_by_user_id,
        usedByEmail: c.used_by_email,
        usedAt: c.used_at,
        createdAt: c.created_at,
        isUsed: c.used_by_user_id !== null,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    console.error('Get invitation codes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
