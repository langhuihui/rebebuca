<!--
 * Rebebuca - Shared Sidebar Header Component
 * Used by TaskSidebar and DemoApp
 -->

<template>
  <div class="sidebar-header">
    <div class="sidebar-header-content">
      <!-- Logo with version -->
      <div class="logo-version">
        <img
          :src="logoSrc"
          alt="Logo"
          class="logo-image"
        />
        <span class="version-text">{{ version }}</span>
        <slot name="update-indicator"></slot>
      </div>
      <!-- Action buttons -->
      <div class="header-actions">
        <slot name="actions"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  logoSrc: string;
  version: string;
}>();
</script>

<style scoped>
.sidebar-header {
  flex-shrink: 0;
}

.sidebar-header-content {
  padding: 12px 16px;
  border-bottom: 1px solid var(--n-border-color, rgba(255, 255, 255, 0.1));
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo-version {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-image {
  width: 28px;
  height: 28px;
}

.version-text {
  font-size: 11px;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.5));
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
