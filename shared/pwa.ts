/**
 * Shared PWA (Web App Manifest + Workbox defaults) for Vite and Nuxt builds.
 */
import type { VitePWAOptions } from "vite-plugin-pwa";

export function createVitePwaOptions(): Partial<VitePWAOptions> {
  return {
    registerType: "autoUpdate",
    includeAssets: ["logo.svg", "pwa-192.png", "pwa-512.png"],
    manifest: {
      name: "Rebebuca",
      short_name: "Rebebuca",
      description: "Run configuration management tool",
      theme_color: "#5A00FF",
      background_color: "#ffffff",
      display: "standalone",
      orientation: "any",
      start_url: "/",
      scope: "/",
      icons: [
        {
          src: "pwa-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "pwa-512.png",
          sizes: "512x512",
          type: "image/png",
        },
        {
          src: "pwa-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    workbox: {
      maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,jpg,jpeg,webp}"],
      navigateFallback: "/index.html",
      navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/ws(?:\/|$)/],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "google-fonts-cache",
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
      ],
    },
    devOptions: {
      enabled: false,
    },
  };
}
