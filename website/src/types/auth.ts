/**
 * Types for authentication
 */

export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  locale: string;
  emailConfirmed: boolean;
  createdAt: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface Subscription {
  id: string;
  planType: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  startedAt: string;
  expiresAt: string | null;
  product: {
    id: string;
    name: string;
    features: string[];
  };
}
