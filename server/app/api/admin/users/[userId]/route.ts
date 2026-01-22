export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getDB, User } from '@/lib/db';

// PATCH /api/admin/users/[userId] - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireSuperAdmin();

    const { userId } = await params;
    const body = await request.json() as {
      role?: 'user' | 'admin' | 'super_admin';
      isBanned?: boolean;
    };

    const db = getDB();

    // Check if user exists
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<User>();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get current user to prevent self-modification
    const currentUser = await requireSuperAdmin();
    if (userId === currentUser.id && body.role && body.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot change your own super admin role' },
        { status: 400 }
      );
    }
    
    if (userId === currentUser.id && body.isBanned === true) {
      return NextResponse.json(
        { error: 'Cannot ban yourself' },
        { status: 400 }
      );
    }

    // Build update query
    const updates: string[] = [];
    const queryParams: any[] = [];

    if (body.role !== undefined) {
      if (!['user', 'admin', 'super_admin'].includes(body.role)) {
        return NextResponse.json(
          { error: 'Invalid role' },
          { status: 400 }
        );
      }
      updates.push('role = ?');
      queryParams.push(body.role);
    }

    if (body.isBanned !== undefined) {
      updates.push('is_banned = ?');
      queryParams.push(body.isBanned ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push('updated_at = ?');
    queryParams.push(new Date().toISOString());
    queryParams.push(userId);

    await db.prepare(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...queryParams).run();

    // Get updated user
    const updatedUser = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<User>();

    return NextResponse.json({
      user: {
        id: updatedUser!.id,
        email: updatedUser!.email,
        displayName: updatedUser!.display_name,
        avatarUrl: updatedUser!.avatar_url,
        role: updatedUser!.role,
        isBanned: updatedUser!.is_banned === 1,
        emailVerified: updatedUser!.email_verified === 1,
        authProvider: updatedUser!.auth_provider,
        createdAt: updatedUser!.created_at,
        updatedAt: updatedUser!.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/admin/users/[userId] - Get user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireSuperAdmin();

    const { userId } = await params;
    const db = getDB();

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<User>();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's invitation codes
    const { results: invitationCodes } = await db.prepare(`
      SELECT * FROM invitation_codes WHERE user_id = ? ORDER BY created_at DESC
    `).bind(userId).all();

    // Get user's subscriptions
    const { results: subscriptions } = await db.prepare(`
      SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC
    `).bind(userId).all();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        role: user.role,
        isBanned: user.is_banned === 1,
        emailVerified: user.email_verified === 1,
        authProvider: user.auth_provider,
        locale: user.locale,
        timezone: user.timezone,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      invitationCodes: invitationCodes || [],
      subscriptions: subscriptions || [],
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
