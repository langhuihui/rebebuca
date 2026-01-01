<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 -->

<template>
  <div class="welcome-screen-container" :class="{ 'light-theme': effectiveTheme === 'light' }">
    <div class="welcome-screen">
      <div class="welcome-logo-container">
        <img
          :src="effectiveTheme === 'light' ? '/logo.svg' : '/logo-dark.svg'"
          alt="Rebebuca"
          class="welcome-logo"
        />
      </div>
      <h2 class="welcome-title">
        {{ t("welcome.title") }}
      </h2>
      <p class="welcome-description">
        {{ t("welcome.description") }}
      </p>
      <div class="welcome-features">
        <div class="feature-card">
          <h3 class="feature-title">
            {{ t("welcome.quickStart.title") }}
          </h3>
          <p class="feature-description">
            {{ t("welcome.quickStart.description") }}
          </p>
        </div>
        <div class="feature-card">
          <h3 class="feature-title">
            {{ t("welcome.efficientExecution.title") }}
          </h3>
          <p class="feature-description">
            {{ t("welcome.efficientExecution.description") }}
          </p>
        </div>
        <div class="feature-card">
          <h3 class="feature-title">
            {{ t("welcome.configManagement.title") }}
          </h3>
          <p class="feature-description">
            {{ t("welcome.configManagement.description") }}
          </p>
        </div>
        <div class="feature-card">
          <h3 class="feature-title">
            {{ t("welcome.history.title") }}
          </h3>
          <p class="feature-description">
            {{ t("welcome.history.description") }}
          </p>
        </div>
      </div>
      
      <!-- Actions slot for additional buttons -->
      <div v-if="$slots.actions" class="welcome-actions">
        <slot name="actions"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

interface Props {
  effectiveTheme: string;
}

defineProps<Props>();

const { t } = useI18n();
</script>
