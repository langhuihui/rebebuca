/**
 * Auth Store for Rebebuca Website
 * Manages authentication state using Pinia
 */

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
  async function initialize() {
    if (initialized.value) return;

    loading.value = true;
    try {
      if (authService.isAuthenticated()) {
        user.value = await authService.getCurrentUser();
        if (user.value) {
          subscription.value = await authService.getSubscription();
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    } finally {
      loading.value = false;
      initialized.value = true;
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
    refreshSubscription,
    openAuthPortal,
    openSubscriptions,
  };
});
