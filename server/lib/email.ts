/**
 * Email sending utility for password reset
 * Supports multiple email providers via environment variables
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  error?: string;
  provider?: string;
}

/**
 * Get the base URL for password reset links
 */
function getBaseUrl(request?: Request): string {
  // Try to get from environment variable first
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // Try to get from request URL
  if (request) {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  }
  
  // Fallback for Cloudflare Workers
  if (typeof process !== 'undefined' && process.env?.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Default fallback
  return 'http://localhost:3000';
}

/**
 * Send email using Resend API
 */
async function sendWithResend(options: EmailOptions, env?: any): Promise<{ success: boolean; error?: string }> {
  const apiKey = env?.RESEND_API_KEY || (typeof process !== 'undefined' ? process.env?.RESEND_API_KEY : undefined);
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const fromEmail = env?.RESEND_FROM_EMAIL || (typeof process !== 'undefined' ? process.env?.RESEND_FROM_EMAIL : undefined) || 'noreply@rebebuca.com';
  
  console.log('[Resend] Sending email from:', fromEmail, 'to:', options.to);
  
  const requestBody = {
    from: fromEmail,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>/g, ''),
  };
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  console.log('[Resend] Response status:', response.status);
  
  if (!response.ok) {
    console.error('Resend API error:', responseText);
    return { success: false, error: responseText };
  }

  return { success: true };
}

/**
 * Send email using the configured provider
 */
export async function sendEmail(
  options: EmailOptions,
  env?: any,
  request?: Request
): Promise<EmailResult> {
  const resendApiKey = env?.RESEND_API_KEY || (typeof process !== 'undefined' ? process.env?.RESEND_API_KEY : undefined);
  
  // Debug logging
  console.log('[Email] Attempting to send email to:', options.to);

  // Try Resend first (recommended for Cloudflare Pages/Workers)
  if (resendApiKey) {
    try {
      const result = await sendWithResend(options, env);
      if (result.success) return { success: true, provider: 'resend' };
      return { success: false, error: result.error || 'Resend API returned failure status', provider: 'resend' };
    } catch (error) {
      console.error('Resend send failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error), provider: 'resend' };
    }
  }

  // If no email service is configured, log the email (for development)
  const nodeEnv = env?.NODE_ENV || (typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined);
  if (nodeEnv === 'development' || process.env.NODE_ENV === 'development') {
    console.log('Email would be sent:', {
      to: options.to,
      subject: options.subject,
    });
    return { success: true, provider: 'log' };
  }

  console.error('No email service configured');
  return { success: false, error: 'No email service configured' };
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  env?: any,
  request?: Request
): Promise<EmailResult> {
  const baseUrl = getBaseUrl(request);
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Rebebuca</h1>
        </div>
        <div style="background: #ffffff; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
          <p style="color: #666;">You requested to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Reset Password</a>
          </div>
          <p style="color: #999; font-size: 14px; margin-top: 30px;">Or copy and paste this link into your browser:</p>
          <p style="color: #667eea; font-size: 12px; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">${resetUrl}</p>
          <p style="color: #999; font-size: 14px; margin-top: 30px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Rebebuca. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const text = `
Reset Your Password

You requested to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.

© ${new Date().getFullYear()} Rebebuca. All rights reserved.
  `;

  return sendEmail(
    {
      to: email,
      subject: 'Reset Your Password - Rebebuca',
      html,
      text,
    },
    env,
    request
  );
}
