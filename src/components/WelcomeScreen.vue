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

      <!-- Discord; zh-CN shows QQ QR in bottom-right corner -->
      <div v-if="currentLocale !== 'zh-CN'" class="community-links">
        <a href="https://discord.gg/wnEwmNBD" target="_blank" class="community-link discord-link">
          {{ t('welcome.community.discord') }}
        </a>
      </div>
      
      <!-- Actions slot for additional buttons -->
      <div v-if="$slots.actions" class="welcome-actions">
        <slot name="actions"></slot>
      </div>

      <!-- Release Notes Section -->
      <div v-if="updaterStore.showWhatsNew && updaterStore.whatsNewReleaseNotes.length > 0" class="whats-new-section">
        <div class="whats-new-title-bar">
          <div class="whats-new-title">
            {{ t('settings.currentVersionFeatures') }} 
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
      
      <!-- New Version Available Section -->
      <div v-if="updaterStore.newVersionNote" class="new-version-section">
        <div class="new-version-header">
          <div class="new-version-title">
            <component :is="iconComponents.upgrade" class="upgrade-icon" />
            {{ t('settings.newVersionAvailable') }}
            <span class="version-badge new-version-badge">{{ updaterStore.newVersionNote.tag }}</span>
          </div>
          <n-button 
            type="primary" 
            size="small" 
            :loading="updaterStore.downloading"
            @click="handleUpgrade"
          >
            <template #icon>
              <component :is="iconComponents.download" />
            </template>
            {{ updaterStore.downloading ? t('settings.downloading') : t('settings.downloadAndInstall') }}
          </n-button>
        </div>
        <n-progress 
          v-if="updaterStore.downloading" 
          type="line" 
          :percentage="updaterStore.downloadProgress" 
          :show-indicator="true"
          style="margin-top: 12px;"
        />
        <n-collapse :default-expanded-names="[]" style="margin-top: 12px;">
          <n-collapse-item :title="t('settings.viewNewFeatures')" name="features">
            <div class="new-version-features" v-html="formatReleaseBody(updaterStore.newVersionNote.body)"></div>
          </n-collapse-item>
        </n-collapse>
      </div>
    </div>

    <div
      v-if="currentLocale === 'zh-CN'"
      class="welcome-qrcode-corner"
      aria-label="QQ group"
    >
      <p class="welcome-qrcode-corner-title">{{ t('welcome.community.qqGroup') }}</p>
      <img
        src="/qrcode.jpg"
        alt=""
        class="welcome-qrcode-corner-img"
        width="200"
        height="200"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { NScrollbar, NButton, NProgress, NCollapse, NCollapseItem } from "naive-ui";
import { useUpdaterStore } from "../stores/updater";
import { iconComponents } from "../utils/icons";
import { useLocale } from "../composables/useLocale";

interface Props {
  effectiveTheme: string;
}

defineProps<Props>();

const { t } = useI18n();
const updaterStore = useUpdaterStore();
const { currentLocale } = useLocale();

// Handle upgrade button click
const handleUpgrade = async () => {
  try {
    await updaterStore.downloadAndInstall();
  } catch (error) {
    console.error('Failed to download and install update:', error);
  }
};


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
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  overflow-y: auto;
  padding: 20px;
  box-sizing: border-box;
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
  margin-bottom: 32px;
}

.welcome-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 30px;
}

/* Community */
.community-links {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 30px;
}

.welcome-qrcode-corner {
  position: absolute;
  right: max(16px, env(safe-area-inset-right, 0px));
  bottom: max(16px, env(safe-area-inset-bottom, 0px));
  z-index: 2;
  text-align: center;
  pointer-events: none;
}

.welcome-qrcode-corner-title {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--n-text-color-2);
  line-height: 1.3;
}

.welcome-qrcode-corner-img {
  display: block;
  width: 200px;
  height: 200px;
  object-fit: contain;
  border-radius: 8px;
  border: 1px solid var(--n-border-color);
  background: var(--n-color-embedded);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.community-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.3s ease;
}

.discord-link {
  background: linear-gradient(135deg, #5865f2 0%, #7289da 100%);
  color: white;
}

.discord-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(88, 101, 242, 0.4);
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

/* New Version Available Section */
.new-version-section {
  margin-top: 20px;
  text-align: left;
  background: linear-gradient(135deg, rgba(24, 160, 88, 0.1) 0%, rgba(54, 173, 106, 0.05) 100%);
  border-radius: 12px;
  border: 1px solid rgba(24, 160, 88, 0.3);
  padding: 20px;
}

.new-version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.new-version-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--n-text-color-1);
  display: flex;
  align-items: center;
  gap: 10px;
}

.upgrade-icon {
  color: #18a058;
}

.new-version-badge {
  background: linear-gradient(135deg, #2080f0 0%, #409eff 100%);
}

.new-version-features {
  font-size: 13px;
  line-height: 1.6;
  color: var(--n-text-color-2);
}

.new-version-features :deep(h2),
.new-version-features :deep(h3),
.new-version-features :deep(h4) {
  margin: 12px 0 6px;
  font-weight: 600;
  color: var(--n-text-color-1);
}

.new-version-features :deep(h2) { font-size: 15px; }
.new-version-features :deep(h3) { font-size: 14px; }
.new-version-features :deep(h4) { font-size: 13px; }

.new-version-features :deep(ul) {
  margin: 6px 0;
  padding-left: 18px;
}

.new-version-features :deep(li) {
  margin: 3px 0;
}

.new-version-features :deep(code) {
  background: rgba(128, 128, 128, 0.15);
  padding: 2px 5px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}

.new-version-features :deep(p) {
  margin: 6px 0;
}
</style>
