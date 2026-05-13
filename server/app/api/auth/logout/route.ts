import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDB } from '@/lib/db';


export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    let refreshToken = cookieStore.get('refresh_token')?.value;

    // Support desktop/API clients that send refreshToken in JSON body
    if (!refreshToken) {
      try {
        const body = await request.json() as { refreshToken?: string };
        if (body?.refreshToken) {
          refreshToken = body.refreshToken;
        }
      } catch {
        // ignore invalid json
      }
    }

    // Delete session from database
    if (refreshToken) {
      const db = await getDB();
      await db.prepare('DELETE FROM sessions WHERE refresh_token = ?').bind(refreshToken).run();
    }

    // Clear cookies
    cookieStore.delete('access_token');
    cookieStore.delete('refresh_token');

    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
