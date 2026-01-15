/**
 * Authentication Service for Rebebuca Website
 * Handles communication with the auth server API
 */

import type { User, Session, Subscription } from '@/types/auth';

const AUTH_SERVER_URL = import.meta.env.VITE_AUTH_SERVER_URL || 'http://localhost:3000';

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'rebebuca_access_token',
  REFRESH_TOKEN: 'rebebuca_refresh_token',
  USER: 'rebebuca_user',
};

class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private user: User | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      this.accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      this.refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      const userStr = localStorage.getItem(STORAGE_KEYS.USER);
      if (userStr) {
        this.user = JSON.parse(userStr);
      }
    } catch (error) {
      console.error('Failed to load auth from storage:', error);
    }
  }

  private saveToStorage() {
    try {
      if (this.accessToken) {
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, this.accessToken);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      }

      if (this.refreshToken) {
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, this.refreshToken);
      } else {
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      }

      if (this.user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(this.user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    } catch (error) {
      console.error('Failed to save auth to storage:', error);
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${AUTH_SERVER_URL}/api${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies for auth
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await this.request<{ user: User; subscription?: Subscription | null }>('/auth/me');
      this.user = response.user;
      this.saveToStorage();
      return this.user;
    } catch {
      return null;
    }
  }

  /**
   * Get user's active subscription
   */
  async getSubscription(): Promise<Subscription | null> {
    try {
      const response = await this.request<{ user: User; subscription?: Subscription | null }>('/auth/me');
      return response.subscription || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /**
   * Get cached user
   */
  getUser(): User | null {
    return this.user;
  }

  /**
   * Get access token for API calls
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Open auth portal in browser
   */
  openAuthPortal(path: string = '/login') {
    const url = `${AUTH_SERVER_URL}${path}`;
    window.open(url, '_blank');
  }

  /**
   * Open subscription management page
   */
  openSubscriptions() {
    this.openAuthPortal('/dashboard/subscriptions');
  }
}

export const authService = new AuthService();
export default authService;
