<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 *
 * User Menu Component - 支持直接 GitHub/Google OAuth 登录
-->

<template>
  <div class="user-menu">
    <!-- Loading state -->
    <div v-if="authStore.loading" class="user-info loading">
      <n-spin size="small" />
    </div>

    <!-- Authenticated user -->
    <template v-else-if="authStore.isAuthenticated && authStore.user">
      <div class="user-info authenticated">
        <div class="user-avatar">
          <img v-if="authStore.user.avatarUrl" :src="authStore.user.avatarUrl" :alt="authStore.user.displayName || authStore.user.email" />
          <div v-else class="avatar-placeholder">
            {{ (authStore.user.displayName || authStore.user.email)[0].toUpperCase() }}
          </div>
        </div>
        <div class="user-details">
          <span class="user-name">{{ authStore.user.displayName || authStore.user.email }}</span>
          <span v-if="subscription" class="subscription-badge" :class="planType">
            {{ planType }}
          </span>
        </div>

        <!-- Dropdown trigger -->
        <div class="dropdown-trigger">
          <n-icon size="14">
            <chevron-down-outline />
          </n-icon>
        </div>
      </div>
    </template>

    <!-- Not authenticated -->
    <div v-else class="user-info not-authenticated">
      <!-- OAuth Login Buttons - Direct OAuth -->
      <n-space :size="8">
        <n-button
          size="small"
          quaternary
          @click="handleGithubLogin"
          class="oauth-button github"
          :loading="oauthLoading === 'github'"
        >
          <template #icon>
            <n-icon size="16">
              <logo-github />
            </n-icon>
          </template>
          GitHub
        </n-button>
        <n-button
          size="small"
          quaternary
          @click="handleGoogleLogin"
          class="oauth-button google"
          :loading="oauthLoading === 'google'"
        >
          <template #icon>
            <n-icon size="16">
              <logo-google />
            </n-icon>
          </template>
          Google
        </n-button>

        <!-- Email Login -->
        <n-button
          size="small"
          quaternary
          @click="handleEmailLogin"
          class="email-button"
          :loading="oauthLoading === 'email'"
        >
          <template #icon>
            <n-icon size="16">
              <mail-outline />
            </n-icon>
          </template>
          {{ t('auth.login') }}
        </n-button>
      </n-space>
    </div>

    <!-- OAuth Login Dialog -->
    <OAuthLoginDialog
      v-model="showOAuthDialog"
      @login-success="handleOAuthSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { NButton, NIcon, NSpin, NSpace, useMessage } from 'naive-ui';
import { ChevronDownOutline, LogoGithub, LogoGoogle, MailOutline } from '@vicons/ionicons5';
import authService from '@/services/authService';
import { proxyFetch } from '@/utils/proxyFetch';
import { useAuthStore } from '@/stores/auth';
import OAuthLoginDialog from './OAuthLoginDialog.vue';

async function openExternalUrl(url: string): Promise<void> {
  window.open(url, '_blank');
}

const { t } = useI18n();
const authStore = useAuthStore();
const message = useMessage();

// State
const showOAuthDialog = ref(false);
const oauthLoading = ref<'github' | 'google' | 'email' | null>(null);

// Computed
const planType = computed(() => authStore.planType);
const subscription = computed(() => authStore.subscription);

// OAuth Server URL
const AUTH_SERVER_URL = import.meta.env.VITE_AUTH_SERVER_URL || 'http://localhost:3000';

type OAuthTokensPayload = {
  accessToken: string;
  refreshToken: string;
  provider?: string | null;
};

// Loopback OAuth for a packaged desktop shell is not used; web UI uses email login.
async function getLoopbackRedirectUrl(): Promise<string> {
  throw new Error('GitHub/Google login via loopback is not available in web mode. Use Email login.');
}

async function waitForOAuthTokens(_expectedProvider: 'github' | 'google', _timeoutMs: number = 2 * 60 * 1000): Promise<OAuthTokensPayload> {
  return new Promise((_, reject) => reject(new Error('Not available in web mode')));
}

// Direct OAuth login (opens system browser, receives tokens via loopback callback)
async function startOAuthLogin(provider: 'github' | 'google') {
  try {
    oauthLoading.value = provider;

    const redirectUrl = await getLoopbackRedirectUrl();

    // Subscribe before opening browser to avoid race
    const tokensPromise = waitForOAuthTokens(provider);

    // Get provider OAuth URL from server
    const response = await proxyFetch(`${AUTH_SERVER_URL}/api/auth/desktop/${provider}?redirect=${encodeURIComponent(redirectUrl)}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to get OAuth URL');
    }

    const data = await response.json() as { url: string };

    // Open browser for OAuth
    await openExternalUrl(data.url);

    // Wait for loopback callback to deliver tokens
    const tokens = await tokensPromise;

    authService.setSession({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    await authStore.initialize(true);

    message.success('Successfully logged in!');
  } catch (err) {
    console.error('OAuth login error:', err);
    message.error(err instanceof Error ? err.message : 'Failed to start OAuth login');
  } finally {
    oauthLoading.value = null;
  }
}

// Handlers
function handleGithubLogin() {
  startOAuthLogin('github');
}

function handleGoogleLogin() {
  startOAuthLogin('google');
}

function handleEmailLogin() {
  showOAuthDialog.value = true;
}

async function handleOAuthSuccess() {
  // Refresh auth state after successful OAuth login
  await authStore.initialize(true);
}
</script>

<style scoped>
.user-menu {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.user-info:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.user-info.loading {
  padding: 0.5rem;
}

.user-info.authenticated {
  gap: 0.75rem;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  flex-shrink: 0;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  align-items: flex-start;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: inherit;
  line-height: 1.2;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subscription-badge {
  font-size: 0.6875rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.subscription-badge.free {
  background-color: #e5e7eb;
  color: #374151;
}

.subscription-badge.pro {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.subscription-badge.enterprise {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  transition: background-color 0.2s;
}

.dropdown-trigger:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.oauth-button {
  padding: 0.375rem 0.75rem;
}

.oauth-button.github {
  color: #24292e;
}

.oauth-button.github:hover {
  background-color: rgba(36, 41, 46, 0.1);
}

.oauth-button.google {
  color: #4285f4;
}

.oauth-button.google:hover {
  background-color: rgba(66, 133, 244, 0.1);
}

.oauth-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.email-button {
  padding: 0.375rem 0.75rem;
}

/* Dark theme support */
.custom-titlebar.light-theme .user-info:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.custom-titlebar:not(.light-theme) .user-info:hover {
  background-color: rgba(255, 255, 255, 0.1);
}
</style>
