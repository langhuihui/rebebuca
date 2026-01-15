import { getRequestContext } from '@cloudflare/next-on-pages';

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

export function getDB(): D1Database {
  const ctx = getRequestContext();
  return ctx.env.DB;
}

export function generateId(): string {
  return crypto.randomUUID();
}
