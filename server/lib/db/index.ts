import { getCloudflareContext } from '@opennextjs/cloudflare';

export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  display_name: string | null;
  avatar_url: string | null;
  locale: string;
  timezone: string;
  email_verified: number;
  auth_provider: 'email' | 'cloudflare_access' | 'github' | 'google';
  role: 'user' | 'admin' | 'super_admin';
  is_banned: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price_usd: number;
  price_cny: number | null;
  features: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  product_id: string;
  plan_type: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'cancelled' | 'expired';
  started_at: string;
  expires_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface Payment {
  id: string;
  user_id: string;
  subscription_id: string | null;
  payment_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string;
  metadata: string | null;
  created_at: string;
  updated_at: string;
  subscription?: Subscription;
}

export interface Session {
  id: string;
  user_id: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
}

export interface InvitationCode {
  id: string;
  user_id: string;
  code: string;
  used_by_user_id: string | null;
  used_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getDB(): Promise<D1Database> {
  try {
    const ctx = await getCloudflareContext({ async: true });
    if (!ctx?.env?.DB) {
      console.error('DB binding not found in context. Available env keys:', ctx?.env ? Object.keys(ctx.env) : 'no env');
      throw new Error('D1 database binding "DB" not found. Please check Pages project settings > Functions > D1 Database bindings.');
    }
    return ctx.env.DB;
  } catch (error) {
    console.error('Failed to get DB from context:', error);
    throw new Error(`Failed to access D1 database: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a random invitation code
 */
export function generateInvitationCode(): string {
  // Generate a code like: ABC-DEF-GHI (9 characters, uppercase, hyphenated)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed 0, 1, I, O for clarity
  let code = '';
  for (let i = 0; i < 9; i++) {
    if (i > 0 && i % 3 === 0) {
      code += '-';
    }
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Create invitation codes for a new user
 */
export async function createInvitationCodesForUser(userId: string, count: number = 3): Promise<InvitationCode[]> {
  const db = await getDB();
  const now = new Date().toISOString();
  const codes: InvitationCode[] = [];

  for (let i = 0; i < count; i++) {
    let code: string;
    let attempts = 0;
    
    // Ensure code uniqueness (retry if collision)
    do {
      code = generateInvitationCode();
      attempts++;
      if (attempts > 10) {
        throw new Error('Failed to generate unique invitation code');
      }
    } while (await db.prepare('SELECT id FROM invitation_codes WHERE code = ?').bind(code).first());

    const id = generateId();
    await db.prepare(`
      INSERT INTO invitation_codes (id, user_id, code, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, userId, code, now, now).run();

    const createdCode = await db.prepare('SELECT * FROM invitation_codes WHERE id = ?').bind(id).first<InvitationCode>();
    if (createdCode) {
      codes.push(createdCode);
    }
  }

  return codes;
}
