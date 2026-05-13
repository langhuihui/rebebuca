import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDB, generateId, User } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';
import type { D1Database } from '@cloudflare/workers-types';


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

    const db = await getDB();

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

      // Get environment context for Cloudflare Workers
      let env: any = null;
      try {
        const ctx = await getCloudflareContext({ async: true });
        env = ctx.env;
      } catch {
        // If context is unavailable, env will be null and email will use environment variables
      }

      // Send email with reset link
      const emailResult = await sendPasswordResetEmail(email, token, env, request);
      if (!emailResult.success) {
        console.error(`Failed to send password reset email to ${email}:`, emailResult.error);
        // During debugging, we can return the error. In production, we'd hide this.
        return NextResponse.json(
          { error: `Email failed: ${emailResult.error}`, details: emailResult },
          { status: 500 }
        );
      }
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message: 'If an account exists with this email, you will receive a password reset link',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    
    // Add detailed error information for debugging
    let errorMessage = 'Internal server error';
    if (error instanceof Error) {
      errorMessage = error.message;
      // Check if it's a D1 database error
      if (error.message.includes('D1_ERROR') || error.message.includes('no such table')) {
        try {
          const ctx = await getCloudflareContext({ async: true });
          const hasDB = ctx?.env?.DB ? 'yes' : 'no';
          const envKeys = ctx?.env ? Object.keys(ctx.env).join(', ') : 'no env';
          console.error('D1 Debug Info:', {
            hasDB,
            envKeys,
            error: error.message,
          });
        } catch (ctxError) {
          console.error('Failed to get context:', ctxError);
        }
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        // Only include debug info in development
        ...(process.env.NODE_ENV === 'development' ? { 
          details: error instanceof Error ? error.stack : String(error) 
        } : {})
      },
      { status: 500 }
    );
  }
}
