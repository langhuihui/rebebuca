export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getDB, User } from '@/lib/db';

// GET /api/admin/users - Get all users
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const banned = searchParams.get('banned');

    const db = getDB();
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM users WHERE 1=1';
    const params: any[] = [];

    if (search) {
      query += ' AND (email LIKE ? OR display_name LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    if (banned !== null && banned !== '') {
      query += ' AND is_banned = ?';
      params.push(banned === 'true' ? 1 : 0);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const { results: users } = await db.prepare(query).bind(...params).all<User>();

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const countParams: any[] = [];

    if (search) {
      countQuery += ' AND (email LIKE ? OR display_name LIKE ?)';
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern);
    }

    if (role) {
      countQuery += ' AND role = ?';
      countParams.push(role);
    }

    if (banned !== null && banned !== '') {
      countQuery += ' AND is_banned = ?';
      countParams.push(banned === 'true' ? 1 : 0);
    }

    const countResult = await db.prepare(countQuery).bind(...countParams).first<{ total: number }>();
    const total = countResult?.total || 0;

    return NextResponse.json({
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        role: u.role,
        isBanned: u.is_banned === 1,
        emailVerified: u.email_verified === 1,
        authProvider: u.auth_provider,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
