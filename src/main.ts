/**
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
 */

import { createApp } from 'vue';
import App from './App.vue';
import { createPinia } from 'pinia';
import hljs from 'highlight.js';
// import 'highlight.js/styles/github-dark.css'; // Temporarily disabled to check background
import i18n from './locales';
import './assets/styles/app.scss';
import { initDevLogger } from './utils/devLogger';
import { startMCPCacheUpdates } from './services/debugService';

// Initialize dev logger to capture console output
initDevLogger();

// Start MCP cache updates in development mode
if (import.meta.env.DEV) {
  // Delay start to ensure app is fully loaded
  setTimeout(() => {
    startMCPCacheUpdates(5000); // Update every 5 seconds
  }, 2000);
}

// Naive UI
import {
  create,
  NButton,
  NConfigProvider,
  NLayout,
  NLayoutHeader,
  NLayoutSider,
  NLayoutContent,
  NSpace,
  NIcon,
  NDivider,
  NScrollbar,
  NH3,
  NList,
  NListItem,
  NThing,
  NEllipsis,
  NText,
  NGrid,
  NGi,
  NCard,
  NLog,
  NTimeline,
  NTimelineItem,
  NButtonGroup,
  NMessageProvider,
  NDialogProvider,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NDynamicInput,
  NInputGroup,
  NCode,
  NDropdown
} from 'naive-ui';

const naive = create({
  components: [
    NButton,
    NConfigProvider,
    NLayout,
    NLayoutHeader,
    NLayoutSider,
    NLayoutContent,
    NSpace,
    NIcon,
    NDivider,
    NScrollbar,
    NH3,
    NList,
    NListItem,
    NThing,
    NEllipsis,
    NText,
    NGrid,
    NGi,
    NCard,
    NLog,
    NTimeline,
    NTimelineItem,
    NButtonGroup,
    NMessageProvider,
    NDialogProvider,
    NModal,
    NForm,
    NFormItem,
    NInput,
    NDynamicInput,
    NInputGroup,
    NCode,
    NDropdown
  ]
});

const app = createApp(App);
const pinia = createPinia();

// Configure hljs for code highlighting
hljs.configure({
  ignoreUnescapedHTML: true
});
app.provide('hljs', hljs);

app.use(naive);
app.use(pinia);
app.use(i18n);

// Initialize auth store
import { useAuthStore } from './stores/auth';
const authStore = useAuthStore(pinia);
authStore.initialize();

app.mount('#app');