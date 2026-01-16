<template>
  <div class="header">
    <div class="container">
      <div class="logo">
        <h1>Rebebuca</h1>
      </div>
      <nav class="nav">
        <router-link to="/" class="nav-link">Home</router-link>
        <router-link to="/pricing" class="nav-link">Pricing</router-link>
        <router-link to="/about" class="nav-link">About</router-link>
      </nav>
      <div class="auth-section">
        <!-- Discord link (English only) -->
        <a v-if="!isChinese" href="https://discord.gg/cNp7NYfH" target="_blank" rel="noopener noreferrer" class="discord-link" title="Join Discord">
          <svg class="discord-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
        </a>

        <!-- Loading state -->
        <div v-if="loading" class="auth-loading">Loading...</div>

        <!-- Authenticated user -->
        <div v-else-if="isAuthenticated && user" class="user-info">
          <div class="user-display">
            <span class="user-name">{{ user.displayName || user.email }}</span>
            <span v-if="subscription" class="plan-badge" :class="planType">
              {{ planType }}
            </span>
          </div>
          <div class="user-menu">
            <button @click="openDashboard" class="menu-item">Dashboard</button>
            <button @click="refreshSubscription" class="menu-item">Refresh</button>
          </div>
        </div>

        <!-- Not authenticated -->
        <div v-else class="auth-buttons">
          <button @click="redirectToLogin" class="btn btn-secondary">Login</button>
          <button @click="redirectToRegister" class="btn btn-primary">Sign Up</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useAuth } from '@/composables/useAuth';

const {
  loading,
  user,
  subscription,
  isAuthenticated,
  planType,
  initialize,
  redirectToLogin,
  redirectToRegister,
  refreshSubscription,
} = useAuth();

const authStore = useAuthStore();

// Detect if browser language is Chinese
const isChinese = ref(false);

onMounted(async () => {
  // Check browser language
  const lang = navigator.language || (navigator as any).userLanguage || '';
  isChinese.value = lang.toLowerCase().startsWith('zh');
  
  await initialize();
});

function openDashboard() {
  authStore.openAuthPortal('/dashboard');
}
</script>

<style scoped>
.header {
  background: #1a1a2e;
  color: #eee;
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo h1 {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.nav {
  display: flex;
  gap: 2rem;
}

.nav-link {
  color: #eee;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.nav-link:hover {
  color: #667eea;
}

.auth-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.discord-link {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a0a0a0;
  transition: color 0.2s;
}

.discord-link:hover {
  color: #5865F2;
}

.discord-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.auth-loading {
  color: #888;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.plan-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.plan-badge.free {
  background: #374151;
  color: #9ca3af;
}

.plan-badge.pro {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.plan-badge.enterprise {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.user-menu {
  display: flex;
  gap: 0.5rem;
}

.menu-item {
  background: #374151;
  color: #eee;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.menu-item:hover {
  background: #4b5563;
}

.auth-buttons {
  display: flex;
  gap: 0.75rem;
}

.btn {
  padding: 0.5rem 1.25rem;
  border-radius: 0.375rem;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: transparent;
  color: #eee;
  border: 1px solid #4b5563;
}

.btn-secondary:hover {
  background: #374151;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
}
</style>
