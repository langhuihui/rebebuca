import { cookies, headers } from 'next/headers';
import { verifyToken, TokenPayload } from './jwt';
import { getDB, User, createInvitationCodesForUser } from '../db';
import { verifyCloudflareAccessJWT, getCloudflareAccessEmail } from './cloudflare-access';

export async function getCurrentUser(): Promise<User | null> {
  const db = await getDB();
  const headerStore = await headers();
  
  // First, try Cloudflare Access authentication
  const cfEmail = headerStore.get('CF-Access-Authenticated-User-Email');
  const cfJwt = headerStore.get('CF-Access-JWT-Assertion');
  
  if (cfEmail && cfJwt) {
    // Create a mock request to verify the JWT
    const mockRequest = new Request('https://dummy.com', {
      headers: {
        'CF-Access-JWT-Assertion': cfJwt,
        'CF-Access-Authenticated-User-Email': cfEmail,
      },
    });
    
    const cfPayload = await verifyCloudflareAccessJWT(mockRequest);
    if (cfPayload) {
      // Find or create user based on Cloudflare Access email
      let user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(cfPayload.email).first<User>();
      
      if (!user) {
        // Auto-create user from Cloudflare Access
        const userId = crypto.randomUUID();
        const now = new Date().toISOString();
        
        await db.prepare(`
          INSERT INTO users (id, email, password_hash, display_name, email_verified, auth_provider, role, is_banned, created_at, updated_at)
          VALUES (?, ?, NULL, ?, 1, ?, 'user', 0, ?, ?)
        `).bind(
          userId,
          cfPayload.email,
          cfPayload.email.split('@')[0], // Use email prefix as display name
          'cloudflare_access',
          now,
          now
        ).run();
        
        // Create 3 invitation codes for the new user
        await createInvitationCodesForUser(userId, 3);
        
        user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<User>();
      }
      
      return user || null;
    }
  }
  
  // Next, try Authorization: Bearer <token> (for desktop / API clients)
  const authHeader = headerStore.get('authorization') || headerStore.get('Authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = await verifyToken(token);
    if (payload && payload.type === 'access') {
      const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(payload.sub).first<User>();
      return user || null;
    }
  }

  // Fallback to traditional cookie-based JWT authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload || payload.type !== 'access') {
    return null;
  }

  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(payload.sub).first<User>();

  return user || null;
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Not authenticated');
  }
  return user;
}

/**
 * Check if user is a super admin
 */
export async function requireSuperAdmin(): Promise<User> {
  const user = await requireAuth();
  if (user.role !== 'super_admin') {
    throw new Error('Forbidden: Super admin access required');
  }
  if (user.is_banned) {
    throw new Error('Forbidden: Account is banned');
  }
  return user;
}

/**
 * Check if user is an admin (admin or super_admin)
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    throw new Error('Forbidden: Admin access required');
  }
  if (user.is_banned) {
    throw new Error('Forbidden: Account is banned');
  }
  return user;
}

export { createAccessToken, createRefreshToken, verifyToken, getRefreshTokenExpiry } from './jwt';
export { hashPassword, verifyPassword } from './password';
export type { TokenPayload };
