/**
 * Rebebuca Website Entry Point
 * 
 * This is the entry point for the website. It uses the mock backend adapter
 * and renders the WebsitePage component which embeds the app demo.
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import WebsitePage from './pages/WebsitePage.vue';
import i18n from './locales';

// Force mock backend for website
(window as any).__VITE_BACKEND__ = 'mock';

const app = createApp(WebsitePage);
const pinia = createPinia();

app.use(pinia);
app.use(i18n);

app.mount('#app');
