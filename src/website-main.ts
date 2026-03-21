/**
 * Rebebuca marketing site entry — lightweight landing (no app demo bundle).
 */

import { createApp } from 'vue';
import WebsiteLanding from './pages/WebsiteLanding.vue';

(window as any).__VITE_BACKEND__ = 'mock';

createApp(WebsiteLanding).mount('#app');
