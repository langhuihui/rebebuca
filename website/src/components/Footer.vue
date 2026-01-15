<template>
  <footer class="footer">
    <div class="container">
      <div class="footer-content">
        <div class="footer-section">
          <h3>Rebebuca</h3>
          <p>Terminal Collaboration Platform</p>
        </div>
        <div class="footer-section">
          <h3>Product</h3>
          <router-link to="/" class="footer-link">Features</router-link>
          <router-link to="/pricing" class="footer-link">Pricing</router-link>
        </div>
        <div class="footer-section">
          <h3>Company</h3>
          <router-link to="/about" class="footer-link">About</router-link>
        </div>
        <div class="footer-section">
          <h3>Legal</h3>
          <a href="#" class="footer-link">Privacy Policy</a>
          <a href="#" class="footer-link">Terms of Service</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; {{ new Date().getFullYear() }} Rebebuca. All rights reserved.</p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
</script>

<style scoped>
.footer {
  background: #1a1a2e;
  color: #eee;
  padding: 3rem 0 1rem;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.footer-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.footer-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #667eea;
}

.footer-section p {
  color: #a0a0a0;
  font-size: 0.875rem;
}

.footer-link {
  display: block;
  color: #a0a0a0;
  text-decoration: none;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  transition: color 0.2s;
}

.footer-link:hover {
  color: #667eea;
}

.footer-bottom {
  border-top: 1px solid #374151;
  padding-top: 1rem;
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
}
</style>
