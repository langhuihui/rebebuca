<template>
  <div class="page">
    <Header />
    <main class="main-content">
      <div class="container">
        <h1>Pricing</h1>
        <div class="pricing-grid">
          <div class="pricing-card">
            <h2>Free</h2>
            <p class="price">$0</p>
            <ul>
              <li>10 terminal sessions</li>
              <li>Basic task management</li>
              <li>Community support</li>
            </ul>
            <button @click="handleChoosePlan('free')" class="btn btn-secondary">
              Get Started
            </button>
          </div>
          <div class="pricing-card featured">
            <div class="badge">Popular</div>
            <h2>Pro</h2>
            <p class="price">$9.99/month</p>
            <ul>
              <li>Unlimited terminal sessions</li>
              <li>Advanced task management</li>
              <li>AI collaboration features</li>
              <li>Priority support</li>
              <li>Cloud sync</li>
            </ul>
            <button @click="handleChoosePlan('pro')" class="btn btn-primary">
              Upgrade to Pro
            </button>
          </div>
          <div class="pricing-card">
            <h2>Enterprise</h2>
            <p class="price">$29.99/month</p>
            <ul>
              <li>Everything in Pro</li>
              <li>Team management</li>
              <li>SSO integration</li>
              <li>Custom branding</li>
              <li>Dedicated support</li>
              <li>SLA guarantee</li>
            </ul>
            <button @click="handleChoosePlan('enterprise')" class="btn btn-secondary">
              Contact Sales
            </button>
          </div>
        </div>
      </div>
    </main>
    <Footer />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import Header from '@/components/Header.vue';
import Footer from '@/components/Footer.vue';
import { useAuth } from '@/composables/useAuth';

const router = useRouter();
const { isAuthenticated, redirectToLogin } = useAuth();

const authStore = useAuthStore();

function handleChoosePlan(plan: string) {
  if (isAuthenticated.value) {
    // Redirect to dashboard with plan selection
    authStore.openAuthPortal('/dashboard/subscriptions');
  } else {
    // Redirect to login with plan in query params
    redirectToLogin(router.currentRoute.value.fullPath);
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  padding: 4rem 2rem;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 3rem;
  text-align: center;
  color: #1a1a2e;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.pricing-card {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  position: relative;
  border: 2px solid transparent;
}

.pricing-card.featured {
  border-color: #667eea;
  transform: scale(1.05);
}

.badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
}

.pricing-card h2 {
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
  color: #1a1a2e;
}

.price {
  font-size: 2.5rem;
  font-weight: 800;
  color: #667eea;
  margin-bottom: 2rem;
}

.pricing-card ul {
  list-style: none;
  padding: 0;
  margin-bottom: 2rem;
}

.pricing-card li {
  padding: 0.75rem 0;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
}

.pricing-card li:last-child {
  border-bottom: none;
}

.btn {
  width: 100%;
  padding: 0.875rem 1.5rem;
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
  color: #667eea;
  border: 2px solid #667eea;
}

.btn-secondary:hover {
  background: rgba(102, 126, 234, 0.1);
}
</style>
