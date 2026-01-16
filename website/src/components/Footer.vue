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
          <h3>Community</h3>
          <!-- QQ Group QR Code (Chinese only) -->
          <div v-if="isChinese" class="qrcode-container">
            <span class="qrcode-label">QQ 群</span>
            <img src="/qrcode_qq.jpg" alt="QQ Group QR Code" class="qrcode-image" />
          </div>
          <p v-else class="community-hint">Join us on Discord</p>
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
import { ref, onMounted } from 'vue';

// Detect if browser language is Chinese
const isChinese = ref(false);

onMounted(() => {
  const lang = navigator.language || (navigator as any).userLanguage || '';
  isChinese.value = lang.toLowerCase().startsWith('zh');
});
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

.community-hint {
  color: #a0a0a0;
  font-size: 0.875rem;
}

.qrcode-container {
  margin-top: 0.75rem;
}

.qrcode-label {
  display: block;
  color: #a0a0a0;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.qrcode-image {
  width: 100px;
  height: 100px;
  border-radius: 0.5rem;
  background: white;
  padding: 4px;
}

.footer-bottom {
  border-top: 1px solid #374151;
  padding-top: 1rem;
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
}
</style>
