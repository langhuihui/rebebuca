import { useAuthStore } from '@/stores/auth';

export default defineNuxtPlugin((nuxtApp) => {
  const pinia = nuxtApp.$pinia;
  if (pinia) {
    const authStore = useAuthStore(pinia);
    authStore.initialize();
  }
});
