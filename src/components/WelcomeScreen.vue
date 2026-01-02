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

      <!-- Release Notes Section -->
      <div v-if="updaterStore.showWhatsNew && updaterStore.whatsNewReleaseNotes.length > 0" class="whats-new-section">
        <div class="whats-new-title-bar">
          <div class="whats-new-title">
            {{ t('settings.whatsNew') }} 
            <span class="version-badge">v{{ updaterStore.currentVersion }}</span>
          </div>
          <n-button text class="close-whats-new" @click="updaterStore.dismissWhatsNew">
            <template #icon>
              <component :is="iconComponents.close" />
            </template>
          </n-button>
        </div>
        <div class="whats-new-container">
          <n-scrollbar style="max-height: 300px;">
            <div class="whats-new-content">
              <div v-for="release in updaterStore.whatsNewReleaseNotes" :key="release.tag" class="release-note-item">
                <div class="release-note-header">
                  <span class="release-note-tag">{{ release.tag }}</span>
                  <span class="release-note-date">{{ release.date }}</span>
                </div>
                <div class="release-note-body" v-html="formatReleaseBody(release.body)"></div>
              </div>
            </div>
          </n-scrollbar>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { NScrollbar, NButton } from "naive-ui";
import { useUpdaterStore } from "../stores/updater";
import { iconComponents } from "../utils/icons";

interface Props {
  effectiveTheme: string;
}

defineProps<Props>();

const { t } = useI18n();
const updaterStore = useUpdaterStore();


// Format release body (convert markdown to HTML)
const formatReleaseBody = (body: string): string => {
  if (!body) return '';
  // Simple markdown conversion
  return body
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
};
</script>

<style scoped>
.welcome-screen-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  overflow-y: auto;
  padding: 20px;
}

.welcome-screen {
  max-width: 800px;
  width: 100%;
  text-align: center;
  padding-bottom: 40px;
}

.welcome-logo-container {
  margin-bottom: 24px;
}

.welcome-logo {
  width: 80px;
  height: 80px;
}

.welcome-title {
  font-size: 28px;
  margin-bottom: 12px;
  color: var(--n-text-color-1);
}

.welcome-description {
  font-size: 16px;
  color: var(--n-text-color-3);
  margin-bottom: 40px;
}

.welcome-features {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 40px;
  text-align: left;
}

.feature-card {
  padding: 20px;
  background: var(--n-card-color);
  border-radius: 8px;
  border: 1px solid var(--n-border-color);
  transition: all 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--n-primary-color);
}

.feature-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--n-text-color-1);
}

.feature-description {
  font-size: 14px;
  color: var(--n-text-color-3);
  line-height: 1.5;
}

.welcome-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 30px;
}

/* What's New Section */
.whats-new-section {
  margin-top: 40px;
  text-align: left;
  background: var(--n-card-color);
  border-radius: 12px;
  border: 1px solid var(--n-border-color);
  padding: 24px;
}

.whats-new-title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.whats-new-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--n-text-color-1);
  display: flex;
  align-items: center;
  gap: 12px;
}

.close-whats-new {
  color: var(--n-text-color-3);
  transition: color 0.2s;
}

.close-whats-new:hover {
  color: var(--n-text-color-1);
}

.whats-new-container {
  background: var(--n-color-embedded);
  border-radius: 8px;
  border: 1px solid var(--n-border-color);
}

.whats-new-content {
  padding: 16px;
}

.version-badge {
  display: inline-block;
  background: linear-gradient(135deg, #18a058 0%, #36ad6a 100%);
  color: white;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.release-note-item {
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--n-border-color);
}

.release-note-item:last-child {
  padding-bottom: 0;
  margin-bottom: 0;
  border-bottom: none;
}

.release-note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.release-note-tag {
  font-weight: 600;
  font-size: 14px;
  color: var(--n-text-color-1);
}

.release-note-date {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.release-note-body {
  font-size: 13px;
  line-height: 1.6;
  color: var(--n-text-color-2);
}

.release-note-body :deep(h2),
.release-note-body :deep(h3),
.release-note-body :deep(h4) {
  margin: 12px 0 6px;
  font-weight: 600;
  color: var(--n-text-color-1);
}

.release-note-body :deep(h2) { font-size: 15px; }
.release-note-body :deep(h3) { font-size: 14px; }
.release-note-body :deep(h4) { font-size: 13px; }

.release-note-body :deep(ul) {
  margin: 6px 0;
  padding-left: 18px;
}

.release-note-body :deep(li) {
  margin: 3px 0;
}

.release-note-body :deep(code) {
  background: rgba(128, 128, 128, 0.15);
  padding: 2px 5px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}

.release-note-body :deep(p) {
  margin: 6px 0;
}

/* Light theme overrides if needed */
.light-theme .welcome-screen {
  /* Add specific light theme overrides here if base styles rely on CSS vars that don't switch */
}
</style>
