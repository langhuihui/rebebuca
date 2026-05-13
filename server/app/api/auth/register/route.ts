import { NextRequest, NextResponse } from 'next/server';
import { getDB, generateId, createInvitationCodesForUser } from '@/lib/db';
import { hashPassword } from '@/lib/auth';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; password?: string; displayName?: string; locale?: string };
    const { email, password, displayName, locale } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
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

    const db = await getDB();

    // Check if user already exists
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const userId = generateId();
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, locale, auth_provider, role, is_banned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'email', 'user', 0, ?, ?)
    `).bind(userId, email, passwordHash, displayName || email.split('@')[0], locale || 'en', now, now).run();

    // Create 3 invitation codes for the new user
    await createInvitationCodesForUser(userId, 3);

    // Don't auto-login after registration - user needs to login first
    // Then they will be checked for invitation code status

    return NextResponse.json({
      message: 'Registration successful. Please login to continue.',
      user: {
        id: userId,
        email,
        displayName: displayName || email.split('@')[0],
        locale: locale || 'en',
        emailConfirmed: false,
        createdAt: now,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
