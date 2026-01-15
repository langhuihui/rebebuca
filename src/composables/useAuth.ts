/**
 * Composable for authentication and user management
 * Provides methods to get user info, check authentication status, and redirect to login
 */

import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';

export function useAuth() {
  const authStore = useAuthStore();
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed properties
  const isAuthenticated = computed(() => authStore.isAuthenticated);
  const user = computed(() => authStore.user);
  const subscription = computed(() => authStore.subscription);
  const isPro = computed(() => authStore.isPro);
  const isEnterprise = computed(() => authStore.isEnterprise);
  const planType = computed(() => authStore.planType);

  /**
   * Initialize authentication on component mount
   */
  async function initializeAuth() {
    if (!authStore.initialized) {
      loading.value = true;
      error.value = null;
      try {
        await authStore.initialize();
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to initialize authentication';
        console.error('Auth initialization error:', err);
      } finally {
        loading.value = false;
      }
    }
  }

  /**
   * Get current user information
   */
  async function getCurrentUser() {
    loading.value = true;
    error.value = null;
    try {
      const user = await authStore.user;
      return user;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to get user information';
      console.error('Get user error:', err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Check if user is authenticated, redirect to login if not
   * @param redirectTo - Path to redirect to after login (default: current path)
   * @returns true if authenticated, false otherwise
   */
  function requireAuth(redirectTo?: string): boolean {
    if (!isAuthenticated.value) {
      // Open auth portal with redirect parameter
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/dashboard';
      const redirectPath = redirectTo || currentPath;
      authStore.openAuthPortal(`/login?redirect=${encodeURIComponent(redirectPath)}`);
      return false;
    }
    return true;
  }

  /**
   * Redirect to login page
   * @param redirectTo - Path to redirect to after login
   */
  function redirectToLogin(redirectTo?: string) {
    const redirectPath = redirectTo || '/';
    authStore.openAuthPortal(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  /**
   * Redirect to registration page
   * @param redirectTo - Path to redirect to after registration
   */
  function redirectToRegister(redirectTo?: string) {
    const redirectPath = redirectTo || '/';
    authStore.openAuthPortal(`/register?redirect=${encodeURIComponent(redirectPath)}`);
  }

  /**
   * Refresh user subscription data
   */
  async function refreshSubscription() {
    loading.value = true;
    error.value = null;
    try {
      await authStore.refreshSubscription();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to refresh subscription';
      console.error('Refresh subscription error:', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Logout current user
   */
  async function logout() {
    loading.value = true;
    error.value = null;
    try {
      await authStore.logout();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to logout';
      console.error('Logout error:', err);
    } finally {
      loading.value = false;
    }
  }

  return {
    // State
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    user,
    subscription,
    isAuthenticated,
    isPro,
    isEnterprise,
    planType,
    // Actions
    initializeAuth,
    getCurrentUser,
    requireAuth,
    redirectToLogin,
    redirectToRegister,
    refreshSubscription,
    logout,
  };
}
