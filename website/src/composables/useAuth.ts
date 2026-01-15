/**
 * Composable for authentication in website
 */

import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';

export function useAuth() {
  const authStore = useAuthStore();
  const loading = ref(false);

  // Computed properties
  const isAuthenticated = computed(() => authStore.isAuthenticated);
  const user = computed(() => authStore.user);
  const subscription = computed(() => authStore.subscription);
  const isPro = computed(() => authStore.isPro);
  const isEnterprise = computed(() => authStore.isEnterprise);
  const planType = computed(() => authStore.planType);

  /**
   * Initialize authentication
   */
  async function initialize() {
    if (!authStore.initialized) {
      loading.value = true;
      try {
        await authStore.initialize();
      } catch (error) {
        console.error('Failed to initialize auth:', error);
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
    try {
      const user = await authStore.user;
      return user;
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Redirect to login page
   */
  function redirectToLogin(redirectTo?: string) {
    const redirectPath = redirectTo || '/';
    authStore.openAuthPortal(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  /**
   * Redirect to registration page
   */
  function redirectToRegister(redirectTo?: string) {
    const redirectPath = redirectTo || '/';
    authStore.openAuthPortal(`/register?redirect=${encodeURIComponent(redirectPath)}`);
  }

  /**
   * Refresh subscription data
   */
  async function refreshSubscription() {
    loading.value = true;
    try {
      await authStore.refreshSubscription();
    } catch (error) {
      console.error('Failed to refresh subscription:', error);
    } finally {
      loading.value = false;
    }
  }

  return {
    // State
    loading: computed(() => loading.value),
    user,
    subscription,
    isAuthenticated,
    isPro,
    isEnterprise,
    planType,
    // Actions
    initialize,
    getCurrentUser,
    redirectToLogin,
    redirectToRegister,
    refreshSubscription,
  };
}
