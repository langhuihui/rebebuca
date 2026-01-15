/**
 * Proxy endpoint for R2 files to avoid CORS issues
 * GET /api/proxy?file=releases.json
 * GET /api/proxy?file=notification.json
 */

import { NextRequest, NextResponse } from 'next/server';

const R2_BASE_URL = 'https://download.m7s.live/rb';

// Allowed files that can be proxied
const ALLOWED_FILES = ['releases.json', 'notification.json', 'latest.json'];

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'Missing file parameter' },
        { status: 400 }
      );
    }

    // Security: only allow specific files
    if (!ALLOWED_FILES.includes(file)) {
      return NextResponse.json(
        { error: 'File not allowed' },
        { status: 403 }
      );
    }

    const url = `${R2_BASE_URL}/${file}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch file: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
