<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 *
 * OAuth 登录对话框
-->

<template>
  <n-modal
    v-model:show="show"
    preset="card"
    :title="t('auth.emailLogin')"
    class="oauth-login-dialog"
    :close-on-esc="false"
    :mask-closable="false"
    :closable="!loading"
    :style="{ width: '480px' }"
  >
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <n-spin size="large">
        <template #description>
          <p class="loading-text">{{ t('auth.oauth.openingBrowser') }}</p>
        </template>
      </n-spin>
    </div>

    <!-- Login Form -->
    <div v-else class="login-form">
      <p class="description">{{ t('auth.emailLoginDescription') }}</p>

      <n-form ref="formRef" :model="formData" size="small">
        <n-form-item label="Email" path="email">
          <n-input
            v-model:value="formData.email"
            placeholder="you@example.com"
            :disabled="loading"
            @keydown.enter="handleLogin"
          />
        </n-form-item>

        <n-form-item label="Password" path="password">
          <n-input
            v-model:value="formData.password"
            placeholder="•••••••"
            type="password"
            show-password-on="click"
            :disabled="loading"
            @keydown.enter="handleLogin"
          />
        </n-form-item>

        <div class="actions">
          <n-space :size="12">
            <n-button
              type="primary"
              @click="handleLogin"
              :loading="loading"
              block
            >
              {{ t('auth.login') }}
            </n-button>
            <n-button @click="handleClose" quaternary>
              {{ t('auth.oauth.cancel') }}
            </n-button>
          </n-space>
        </div>
      </n-form>

      <!-- Divider -->
      <n-divider />

      <!-- OAuth 快速登录 -->
      <div class="oauth-options">
        <p class="oauth-title">{{ t('auth.oauth.quickLogin') }}</p>
        <n-space :size="12">
          <n-button
            size="large"
            class="oauth-button github"
            @click="handleGithubLogin"
            :loading="loadingProvider === 'github'"
            block
          >
            <template #icon>
              <n-icon size="20">
                <LogoGithub />
              </n-icon>
            </template>
            {{ t('auth.oauth.github') }}
          </n-button>
          <n-button
            size="large"
            class="oauth-button google"
            @click="handleGoogleLogin"
            :loading="loadingProvider === 'google'"
            block
          >
            <template #icon>
              <n-icon size="20">
                <LogoGoogle />
              </n-icon>
            </template>
            {{ t('auth.oauth.google') }}
          </n-button>
        </n-space>
      </div>
    </div>

    <!-- Error Message -->
    <n-alert
      v-if="error"
      type="error"
      :title="error"
      closable
      @close="error = null"
      class="error-alert"
    />
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import authService from '@/services/authService';
import { tauriFetch } from '@/utils/tauriFetch';
import { isTauri } from '@/adapters';
import {
  NModal,
  NButton,
  NSpin,
  NIcon,
  NAlert,
  NForm,
  NFormItem,
  NInput,
  NDivider,
  NSpace,
  useMessage,
} from 'naive-ui';
import {
  LogoGithub,
  LogoGoogle,
} from '@vicons/ionicons5';

// Helper to open URL (works in both Tauri and browser modes)
async function openUrl(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl: tauriOpenUrl } = await import('@tauri-apps/plugin-opener');
    await tauriOpenUrl(url);
  } else {
    window.open(url, '_blank');
  }
}

const { t } = useI18n();
const message = useMessage();

// Props
const props = defineProps<{
  modelValue: boolean;
}>();

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'login-success': [];
}>();

// State
const loading = ref(false);
const loadingProvider = ref<string | null>(null);
const error = ref<string | null>(null);

// Form data
const formData = ref({
  email: '',
  password: '',
});

// Computed
const show = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

// OAuth Server URL
const AUTH_SERVER_URL = import.meta.env.VITE_AUTH_SERVER_URL || 'http://localhost:3000';

type OAuthTokensPayload = {
  accessToken: string;
  refreshToken: string;
  provider?: string | null;
};

async function getLoopbackRedirectUrl(): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<string>('start_oauth_callback_server');
}

async function waitForOAuthTokens(expectedProvider: 'github' | 'google', timeoutMs: number = 2 * 60 * 1000): Promise<OAuthTokensPayload> {
  const { listen } = await import('@tauri-apps/api/event');

  return await new Promise(async (resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(t('auth.oauth.timeout')));
    }, timeoutMs);

    const unlisten = await listen<OAuthTokensPayload>('oauth-tokens-received', (event) => {
      const payload = event.payload;
      if (!payload?.accessToken || !payload?.refreshToken) return;
      if (payload.provider && payload.provider !== expectedProvider) return;

      clearTimeout(timer);
      unlisten();
      resolve(payload);
    });
  });
}

// OAuth Login Flow (opens system browser, receives tokens via loopback callback)
async function startOAuthLogin(provider: 'github' | 'google') {
  try {
    loadingProvider.value = provider;
    error.value = null;

    const redirectUrl = await getLoopbackRedirectUrl();

    // Subscribe before opening browser to avoid race
    const tokensPromise = waitForOAuthTokens(provider);

    const response = await tauriFetch(`${AUTH_SERVER_URL}/api/auth/tauri/${provider}?redirect=${encodeURIComponent(redirectUrl)}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to get OAuth URL');
    }

    const data = await response.json() as { url: string };

    await openUrl(data.url);

    const tokens = await tokensPromise;

    authService.setSession({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    emit('login-success');
    show.value = false;

    message.success(t('auth.oauth.loginSuccess'));
  } catch (err) {
    console.error('OAuth flow error:', err);
    error.value = err instanceof Error ? err.message : t('auth.oauth.failed');
  } finally {
    loadingProvider.value = null;
  }
}

// Handlers
function handleGithubLogin() {
  startOAuthLogin('github');
}

function handleGoogleLogin() {
  startOAuthLogin('google');
}

async function handleLogin() {
  try {
    if (!formData.value.email || !formData.value.password) {
      message.warning('Please enter your email and password');
      return;
    }

    if (formData.value.password.length < 8) {
      message.warning('Password must be at least 8 characters');
      return;
    }

    loading.value = true;
    error.value = null;

    await authService.login(formData.value.email, formData.value.password);

    emit('login-success');
    show.value = false;

    message.success(t('auth.loginSuccess'));

  } catch (err) {
    console.error('Email login error:', err);
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  if (!loading.value && !loadingProvider.value) {
    show.value = false;
    error.value = null;
  }
}
</script>

<style scoped>
.oauth-login-dialog {
  .loading-state {
    padding: 3rem 0;
    text-align: center;
  }

  .loading-text {
    margin-top: 1rem;
    color: #999;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .description {
    text-align: center;
    color: #666;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .oauth-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .oauth-title {
    text-align: center;
    color: #666;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .oauth-button {
    flex: 1;
    height: 48px;
  }

  .oauth-button.github {
    background: #24292e;
    color: white;
    border-color: #24292e;
  }

  .oauth-button.github:hover {
    background: #1b1f23;
    border-color: #1b1f23;
  }

  .oauth-button.google {
    background: white;
    color: #333;
    border-color: #dadce0;
  }

  .oauth-button.google:hover {
    background: #f1f3f4;
    border-color: #d2e3fc;
  }

  .error-alert {
    margin-top: 1rem;
  }
}
</style>
