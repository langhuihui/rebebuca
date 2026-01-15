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
import { onMounted } from 'vue';
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

onMounted(async () => {
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
