// This route works with Edge Runtime (Cloudflare Pages compatible)
// It calls an external SMTP service via HTTP API
export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email via external SMTP HTTP API service
 * Since Cloudflare Pages uses Edge Runtime and doesn't support direct TCP/SMTP connections,
 * we need to use an HTTP-based email service that can handle SMTP on the backend.
 * 
 * Options:
 * 1. Use a service like EmailJS, Mailgun, SendGrid that provides HTTP API
 * 2. Deploy a separate Node.js service to handle SMTP and call it via HTTP
 * 3. Use Cloudflare Email Workers (if available)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as EmailRequest;
    const { to, subject, html, text } = body;

    // Option 1: Use SMTP_HTTP_API_URL if configured (external service that handles SMTP)
    const smtpHttpApiUrl = process.env.SMTP_HTTP_API_URL;
    const smtpHttpApiKey = process.env.SMTP_HTTP_API_KEY;
    
    if (smtpHttpApiUrl) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // 如果配置了 API Key，添加到请求头
      if (smtpHttpApiKey) {
        headers['Authorization'] = `Bearer ${smtpHttpApiKey}`;
      }

      const response = await fetch(smtpHttpApiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to,
          subject,
          html,
          text: text || html.replace(/<[^>]*>/g, ''),
        }),
      });

      if (response.ok) {
        const result = await response.json() as { messageId?: string; id?: string };
        return NextResponse.json({
          success: true,
          messageId: result.messageId || result.id,
        });
      } else {
        const error = await response.text();
        console.error('SMTP HTTP API error:', error);
        return NextResponse.json(
          { error: 'Failed to send email via SMTP service', details: error },
          { status: 500 }
        );
      }
    }

    // Option 2: If SMTP credentials are provided, we need an external service
    // This is a placeholder - you'll need to deploy a separate service or use a provider
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (smtpHost && smtpUser && smtpPassword) {
      return NextResponse.json(
        { 
          error: 'Direct SMTP not supported in Edge Runtime. Please configure SMTP_HTTP_API_URL to use an external SMTP service, or use Resend/SendGrid instead.',
          hint: 'You can deploy a simple Node.js service to handle SMTP and call it via HTTP'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'No email service configured' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
