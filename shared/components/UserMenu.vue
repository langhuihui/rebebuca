<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 -->

<template>
  <n-dropdown
    v-if="authStore.isAuthenticated"
    :options="userMenuOptions"
    trigger="click"
    @select="handleMenuSelect"
  >
    <n-button
      text
      size="small"
      class="user-menu-button titlebar-button"
      :title="authStore.user?.displayName || authStore.user?.email || t('user.account')"
      @mousedown.stop
    >
      <template #icon>
        <n-avatar
          v-if="authStore.user?.avatarUrl"
          :src="authStore.user.avatarUrl"
          :size="20"
          round
        />
        <n-icon v-else :size="18">
          <PersonOutline />
        </n-icon>
      </template>
    </n-button>
  </n-dropdown>
  <n-button
    v-else
    text
    size="small"
    class="user-menu-button titlebar-button"
    :title="t('user.login')"
    @click="showLoginModal = true"
    @mousedown.stop
  >
    <template #icon>
      <n-icon :size="18">
        <PersonOutline />
      </n-icon>
    </template>
  </n-button>

  <!-- Login Modal -->
  <n-modal
    v-model:show="showLoginModal"
    preset="card"
    :title="isRegisterMode ? t('user.register') : t('user.login')"
    style="width: 400px"
    :mask-closable="true"
    :close-on-esc="true"
    to="body"
  >
    <!-- OAuth Quick Login -->
    <div v-if="!isRegisterMode" class="oauth-section">
      <div class="oauth-buttons">
        <n-button
          size="large"
          class="oauth-button github"
          :loading="oauthLoading === 'github'"
          :disabled="!!oauthLoading"
          block
          @click="handleOAuthLogin('github')"
        >
          <template #icon>
            <n-icon size="20">
              <LogoGithub />
            </n-icon>
          </template>
          {{ t('user.loginWithGithub') }}
        </n-button>
        <n-button
          size="large"
          class="oauth-button google"
          :loading="oauthLoading === 'google'"
          :disabled="!!oauthLoading"
          block
          @click="handleOAuthLogin('google')"
        >
          <template #icon>
            <n-icon size="20">
              <LogoGoogle />
            </n-icon>
          </template>
          {{ t('user.loginWithGoogle') }}
        </n-button>
      </div>
      <n-divider>{{ t('user.orLoginWithEmail') }}</n-divider>
    </div>

    <n-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-placement="top"
    >
      <n-form-item :label="t('user.email')" path="email">
        <n-input
          v-model:value="formData.email"
          :placeholder="t('user.emailPlaceholder')"
          @keyup.enter="handleSubmit"
        />
      </n-form-item>

      <n-form-item v-if="isRegisterMode" :label="t('user.displayName')" path="displayName">
        <n-input
          v-model:value="formData.displayName"
          :placeholder="t('user.displayNamePlaceholder')"
        />
      </n-form-item>

      <n-form-item :label="t('user.password')" path="password">
        <n-input
          v-model:value="formData.password"
          type="password"
          show-password-on="click"
          :placeholder="t('user.passwordPlaceholder')"
          @keyup.enter="handleSubmit"
        />
      </n-form-item>

      <n-form-item v-if="isRegisterMode" :label="t('user.confirmPassword')" path="confirmPassword">
        <n-input
          v-model:value="formData.confirmPassword"
          type="password"
          show-password-on="click"
          :placeholder="t('user.confirmPasswordPlaceholder')"
          @keyup.enter="handleSubmit"
        />
      </n-form-item>
    </n-form>

    <template #footer>
      <div class="login-modal-footer">
        <n-button
          text
          type="primary"
          @click="toggleMode"
        >
          {{ isRegisterMode ? t('user.hasAccount') : t('user.noAccount') }}
        </n-button>
        <div class="login-modal-actions">
          <n-button @click="showLoginModal = false">
            {{ t('common.cancel') }}
          </n-button>
          <n-button
            type="primary"
            :loading="loading"
            @click="handleSubmit"
          >
            {{ isRegisterMode ? t('user.register') : t('user.login') }}
          </n-button>
        </div>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  NButton,
  NDropdown,
  NIcon,
  NAvatar,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NDivider,
  useMessage,
  type FormInst,
  type FormRules,
  type DropdownOption,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../../src/stores/auth';
import { PersonOutline, LogoGithub, LogoGoogle } from '@vicons/ionicons5';
import authService from '../../src/services/authService';

const { t } = useI18n();
const message = useMessage();
const authStore = useAuthStore();

// Modal state
const showLoginModal = ref(false);
const isRegisterMode = ref(false);
const loading = ref(false);
const oauthLoading = ref<'github' | 'google' | null>(null);
const formRef = ref<FormInst | null>(null);

// OAuth Server URL
const AUTH_SERVER_URL = import.meta.env.VITE_AUTH_SERVER_URL || 'http://localhost:3000';

type OAuthTokensPayload = {
  accessToken: string;
  refreshToken: string;
  provider?: string | null;
};

// Handle OAuth login (GitHub/Google) — web: redirect to OAuth endpoint
async function handleOAuthLogin(provider: 'github' | 'google') {
  try {
    oauthLoading.value = provider;
    const currentUrl = window.location.href;
    const oauthUrl = `${AUTH_SERVER_URL}/api/auth/${provider}?redirect=${encodeURIComponent(currentUrl)}`;
    window.location.href = oauthUrl;
  } catch (err) {
    console.error('OAuth login error:', err);
    message.error(err instanceof Error ? err.message : t('user.loginFailed'));
  } finally {
    oauthLoading.value = null;
  }
}

// Form data
const formData = ref({
  email: '',
  password: '',
  displayName: '',
  confirmPassword: '',
});

// Form rules
const formRules = computed<FormRules>(() => ({
  email: [
    { required: true, message: t('user.emailRequired'), trigger: 'blur' },
    { type: 'email', message: t('user.emailInvalid'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('user.passwordRequired'), trigger: 'blur' },
    { min: 6, message: t('user.passwordMinLength'), trigger: 'blur' },
  ],
  displayName: [
    { max: 50, message: t('user.displayNameMaxLength'), trigger: 'blur' },
  ],
  confirmPassword: isRegisterMode.value ? [
    { required: true, message: t('user.confirmPasswordRequired'), trigger: 'blur' },
    {
      validator: (_rule: any, value: string) => {
        if (value !== formData.value.password) {
          return new Error(t('user.passwordMismatch'));
        }
        return true;
      },
      trigger: 'blur',
    },
  ] : [],
}));

// User menu options
const userMenuOptions = computed<DropdownOption[]>(() => [
  {
    label: authStore.user?.displayName || authStore.user?.email || t('user.account'),
    key: 'profile',
    disabled: true,
  },
  {
    type: 'divider',
    key: 'd1',
  },
  {
    label: t('user.subscription'),
    key: 'subscription',
    props: {
      style: authStore.isPro ? 'color: #18a058' : undefined,
    },
  },
  {
    label: t('user.dashboard'),
    key: 'dashboard',
  },
  {
    type: 'divider',
    key: 'd2',
  },
  {
    label: t('user.logout'),
    key: 'logout',
  },
]);

// Toggle login/register mode
const toggleMode = () => {
  isRegisterMode.value = !isRegisterMode.value;
  formData.value = {
    email: formData.value.email,
    password: '',
    displayName: '',
    confirmPassword: '',
  };
};

// Handle form submit
const handleSubmit = async () => {
  if (!formRef.value) return;

  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  loading.value = true;

  try {
    if (isRegisterMode.value) {
      const result = await authStore.register(
        formData.value.email,
        formData.value.password,
        formData.value.displayName || undefined
      );

      if (result.success) {
        if (result.requiresEmailConfirmation) {
          message.success(t('user.registerSuccessConfirmEmail'));
        } else {
          message.success(t('user.registerSuccess'));
        }
        showLoginModal.value = false;
        resetForm();
      } else {
        message.error(result.error || t('user.registerFailed'));
      }
    } else {
      const result = await authStore.login(
        formData.value.email,
        formData.value.password
      );

      if (result.success) {
        message.success(t('user.loginSuccess'));
        showLoginModal.value = false;
        resetForm();
      } else {
        message.error(result.error || t('user.loginFailed'));
      }
    }
  } finally {
    loading.value = false;
  }
};

// Handle menu select
const handleMenuSelect = async (key: string) => {
  switch (key) {
    case 'dashboard':
      authStore.openAuthPortal('/dashboard');
      break;
    case 'subscription':
      authStore.openSubscriptions();
      break;
    case 'logout':
      await authStore.logout();
      message.success(t('user.logoutSuccess'));
      break;
  }
};

// Reset form
const resetForm = () => {
  formData.value = {
    email: '',
    password: '',
    displayName: '',
    confirmPassword: '',
  };
  isRegisterMode.value = false;
};
</script>

<style scoped>
.user-menu-button {
  position: relative;
}

.user-menu-button :deep(.n-avatar) {
  cursor: pointer;
}

.login-modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.login-modal-actions {
  display: flex;
  gap: 8px;
}

.oauth-section {
  margin-bottom: 8px;
}

.oauth-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.oauth-button {
  height: 44px;
  font-weight: 500;
}

.oauth-button.github {
  background: #24292e;
  color: white;
  border-color: #24292e;
}

.oauth-button.github:hover:not(:disabled) {
  background: #1b1f23;
  border-color: #1b1f23;
}

.oauth-button.google {
  background: white;
  color: #333;
  border: 1px solid #dadce0;
}

.oauth-button.google:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #d2e3fc;
}

.oauth-button:disabled {
  opacity: 0.6;
}
</style>
