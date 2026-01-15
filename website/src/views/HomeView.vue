<template>
  <div class="home-page">
    <Header />

    <main class="main-content">
      <!-- Hero Section -->
      <section class="hero">
        <div class="container">
          <h1 class="hero-title">
            Terminal Collaboration Platform
          </h1>
          <p class="hero-subtitle">
            Connect, collaborate, and manage your terminals with ease
          </p>
          <div class="hero-actions">
            <button @click="handleGetStarted" class="btn btn-primary btn-large">
              Get Started
            </button>
            <button @click="$router.push('/pricing')" class="btn btn-secondary btn-large">
              View Pricing
            </button>
          </div>
        </div>
      </section>

      <!-- Features Section -->
      <section class="features">
        <div class="container">
          <h2 class="section-title">Features</h2>
          <div class="features-grid">
            <div class="feature-card">
              <h3>Terminal Sessions</h3>
              <p>Manage multiple terminal sessions in one place</p>
            </div>
            <div class="feature-card">
              <h3>Collaboration</h3>
              <p>Share sessions and work together in real-time</p>
            </div>
            <div class="feature-card">
              <h3>Task Management</h3>
              <p>Organize your workflow with built-in task tools</p>
            </div>
          </div>
        </div>
      </section>

      <!-- User Info Section (for authenticated users) -->
      <section v-if="isAuthenticated && user" class="user-section">
        <div class="container">
          <h2 class="section-title">Welcome, {{ user.displayName || user.email }}!</h2>
          <div class="user-info-card">
            <div class="info-row">
              <strong>Email:</strong>
              <span>{{ user.email }}</span>
            </div>
            <div class="info-row">
              <strong>Plan:</strong>
              <span class="plan-badge" :class="planType">
                {{ planType }}
              </span>
            </div>
            <div v-if="subscription" class="info-row">
              <strong>Status:</strong>
              <span :class="`status-${subscription.status}`">
                {{ subscription.status }}
              </span>
            </div>
            <div class="info-row">
              <strong>Account Created:</strong>
              <span>{{ new Date(user.createdAt).toLocaleDateString() }}</span>
            </div>
            <button @click="openDashboard" class="btn btn-primary">
              Go to Dashboard
            </button>
          </div>
        </div>
      </section>
    </main>

    <Footer />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Header from '@/components/Header.vue';
import Footer from '@/components/Footer.vue';
import { useAuth } from '@/composables/useAuth';

const router = useRouter();
const {
  user,
  subscription,
  isAuthenticated,
  planType,
  initialize,
  redirectToLogin,
} = useAuth();

const authStore = useAuthStore();

onMounted(async () => {
  await initialize();
});

function handleGetStarted() {
  if (isAuthenticated.value) {
    openDashboard();
  } else {
    redirectToLogin();
  }
}

function openDashboard() {
  authStore.openAuthPortal('/dashboard');
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
}

.hero {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  padding: 6rem 2rem;
  text-align: center;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.hero-title {
  font-size: 3rem;
  font-weight: 800;
  margin-bottom: 1.5rem;
  line-height: 1.2;
}

.hero-subtitle {
  font-size: 1.25rem;
  color: #a0a0a0;
  margin-bottom: 2rem;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
}

.btn {
  padding: 0.75rem 2rem;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.btn-secondary {
  background: transparent;
  color: white;
  border: 2px solid #667eea;
}

.btn-secondary:hover {
  background: rgba(102, 126, 234, 0.1);
}

.btn-large {
  padding: 1rem 2.5rem;
  font-size: 1.125rem;
}

.features {
  padding: 5rem 2rem;
  background: #f9fafb;
}

.section-title {
  font-size: 2.5rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 3rem;
  color: #1a1a2e;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
}

.feature-card h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #1a1a2e;
}

.feature-card p {
  color: #6b7280;
  line-height: 1.6;
}

.user-section {
  padding: 5rem 2rem;
  background: white;
}

.user-info-card {
  background: #f9fafb;
  padding: 2rem;
  border-radius: 1rem;
  max-width: 600px;
  margin: 0 auto;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.info-row:last-child {
  border-bottom: none;
}

.plan-badge {
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
}

.plan-badge.free {
  background: #e5e7eb;
  color: #374151;
}

.plan-badge.pro {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.plan-badge.enterprise {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.status-active {
  color: #10b981;
  font-weight: 600;
}

.status-cancelled {
  color: #ef4444;
  font-weight: 600;
}

.status-expired {
  color: #f59e0b;
  font-weight: 600;
}
</style>
