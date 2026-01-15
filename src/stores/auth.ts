import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import authService, { User, Subscription } from '@/services/authService';

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const subscription = ref<Subscription | null>(null);
  const loading = ref(false);
  const initialized = ref(false);

  // Getters
  const isAuthenticated = computed(() => !!user.value);
  const isPro = computed(() => 
    subscription.value?.planType === 'pro' || 
    subscription.value?.planType === 'enterprise'
  );
  const isEnterprise = computed(() => subscription.value?.planType === 'enterprise');
  const planType = computed(() => subscription.value?.planType || 'free');

  // Actions
  async function initialize(force: boolean = false) {
    if (initialized.value && !force) return;

    loading.value = true;
    try {
      if (authService.isAuthenticated()) {
        user.value = await authService.getCurrentUser();
        if (user.value) {
          subscription.value = await authService.getSubscription();
        }
      } else {
        user.value = null;
        subscription.value = null;
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    } finally {
      loading.value = false;
      initialized.value = true;
    }
  }

  async function login(email: string, password: string) {
    loading.value = true;
    try {
      const response = await authService.login(email, password);
      user.value = response.user;
      subscription.value = await authService.getSubscription();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      };
    } finally {
      loading.value = false;
    }
  }

  async function register(email: string, password: string, displayName?: string) {
    loading.value = true;
    try {
      const response = await authService.register(email, password, displayName);
      if (response.session) {
        user.value = response.user;
        subscription.value = await authService.getSubscription();
      }
      return { 
        success: true, 
        requiresEmailConfirmation: response.requiresEmailConfirmation 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Registration failed' 
      };
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    loading.value = true;
    try {
      await authService.logout();
      user.value = null;
      subscription.value = null;
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      loading.value = false;
    }
  }

  async function refreshSubscription() {
    if (!user.value) return;
    try {
      subscription.value = await authService.getSubscription();
    } catch (error) {
      console.error('Failed to refresh subscription:', error);
    }
  }

  function openAuthPortal(path?: string) {
    authService.openAuthPortal(path);
  }

  function openSubscriptions() {
    authService.openSubscriptions();
  }

  return {
    // State
    user,
    subscription,
    loading,
    initialized,
    // Getters
    isAuthenticated,
    isPro,
    isEnterprise,
    planType,
    // Actions
    initialize,
    login,
    register,
    logout,
    refreshSubscription,
    openAuthPortal,
    openSubscriptions,
  };
});
