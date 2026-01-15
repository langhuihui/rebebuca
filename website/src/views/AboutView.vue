<template>
  <div class="page">
    <Header />
    <main class="main-content">
      <div class="container">
        <h1>About</h1>
        <p>Learn more about Rebebuca and our mission.</p>
      </div>
    </main>
    <Footer />
  </div>
</template>

<script setup lang="ts">
import Header from '@/components/Header.vue';
import Footer from '@/components/Footer.vue';
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
  margin-bottom: 1rem;
  color: #1a1a2e;
}

p {
  font-size: 1.125rem;
  color: #6b7280;
  line-height: 1.6;
}
</style>
