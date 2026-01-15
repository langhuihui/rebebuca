export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDB } from '@/lib/db';


// GET /api/user/profile - Get user profile
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      profile: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        locale: user.locale,
        timezone: user.timezone,
        emailVerified: user.email_verified === 1,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/user/profile - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as { displayName?: string; avatarUrl?: string; locale?: string; timezone?: string };
    const { displayName, avatarUrl, locale, timezone } = body;

    const db = getDB();
    const now = new Date().toISOString();

    // Build update query dynamically
    const updates: string[] = ['updated_at = ?'];
    const values: (string | null)[] = [now];

    if (displayName !== undefined) {
      updates.push('display_name = ?');
      values.push(displayName);
    }
    if (avatarUrl !== undefined) {
      updates.push('avatar_url = ?');
      values.push(avatarUrl);
    }
    if (locale !== undefined) {
      updates.push('locale = ?');
      values.push(locale);
    }
    if (timezone !== undefined) {
      updates.push('timezone = ?');
      values.push(timezone);
    }

    values.push(user.id);

    await db.prepare(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();

    // Fetch updated user
    const updatedUser = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();

    return NextResponse.json({
      message: 'Profile updated successfully',
      profile: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
