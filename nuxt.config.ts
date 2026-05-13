import path from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';
import { createVitePwaOptions } from './shared/pwa';

const rootDir = path.resolve(process.cwd());
const pwaBase = createVitePwaOptions();

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  srcDir: 'app',
  compatibilityDate: '2025-03-19',
  alias: {
    '@': path.resolve(rootDir, 'src'),
    '@shared': path.resolve(rootDir, 'shared'),
  },
  modules: ['@pinia/nuxt'],
  nitro: {
    preset: 'static',
  },
  dir: {
    public: 'public',
  },
  vite: {
    define: {
      __VITE_BACKEND__: JSON.stringify('server'),
    },
    server: {
      fs: { allow: [rootDir, path.join(rootDir, 'public')] },
    },
    plugins: [
      {
        name: 'resolve-public-assets',
        resolveId(id) {
          if (id === '/logo.svg') return path.resolve(rootDir, 'public/logo.svg');
          if (id === '/logo-dark.svg') return path.resolve(rootDir, 'public/logo-dark.svg');
          if (id === '/text.svg') return path.resolve(rootDir, 'public/text.svg');
          if (id === '/qrcode.jpg') return path.resolve(rootDir, 'public/qrcode.jpg');
          return null;
        },
      },
      VitePWA({
        ...pwaBase,
        devOptions: {
          ...pwaBase.devOptions,
          enabled: process.env.NODE_ENV !== 'production',
        },
      }),
    ],
  },
  app: {
    rootId: 'app',
    rootTag: 'div',
    head: {
      title: 'Rebebuca',
      meta: [
        { name: 'theme-color', content: '#5A00FF' },
        { name: 'mobile-web-app-capable', content: 'yes' },
      ],
      link: [
        { rel: 'icon', href: '/logo.svg' },
        { rel: 'apple-touch-icon', href: '/pwa-192.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
      ],
    },
  },
});
