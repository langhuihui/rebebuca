/**
 * Authentication Service for Rebebuca
 * Handles communication with the auth server
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

export interface AuthResponse {
  user: User;
  session?: Session;
  message?: string;
  requiresEmailConfirmation?: boolean;
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
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  /**
   * Register a new user
   */
  async register(email: string, password: string, displayName?: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });

    if (response.session) {
      this.accessToken = response.session.accessToken;
      this.refreshToken = response.session.refreshToken;
      this.user = response.user;
      this.saveToStorage();
    }

    return response;
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.session) {
      this.accessToken = response.session.accessToken;
      this.refreshToken = response.session.refreshToken;
      this.user = response.user;
      this.saveToStorage();
    }

    return response;
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors during logout
    }

    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    this.saveToStorage();
  }

  /**
   * Refresh the access token
   */
  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await this.request<{ session: Session }>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      this.accessToken = response.session.accessToken;
      this.refreshToken = response.session.refreshToken;
      this.saveToStorage();
      return true;
    } catch {
      this.accessToken = null;
      this.refreshToken = null;
      this.user = null;
      this.saveToStorage();
      return false;
    }
  }

  /**
   * Get the current user
   */
  async getCurrentUser(): Promise<User | null> {
    if (!this.accessToken) {
      return null;
    }

    try {
      const response = await this.request<{ user: User }>('/auth/me');
      this.user = response.user;
      this.saveToStorage();
      return this.user;
    } catch {
      // Try to refresh token
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        return this.getCurrentUser();
      }
      return null;
    }
  }

  /**
   * Get user's active subscription
   */
  async getSubscription(): Promise<Subscription | null> {
    if (!this.accessToken) {
      return null;
    }

    try {
      const response = await this.request<{ activeSubscription: Subscription | null }>(
        '/user/subscriptions'
      );
      return response.activeSubscription;
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
   * Open the auth portal in browser
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
