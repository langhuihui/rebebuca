export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';

// This route is no longer needed with D1/JWT auth
// Keeping it for backwards compatibility, redirects to dashboard
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const next = new URL(request.url).searchParams.get('next') ?? '/dashboard';
  
  return NextResponse.redirect(`${origin}${next}`);
}
