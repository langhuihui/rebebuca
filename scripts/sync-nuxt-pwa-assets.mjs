#!/usr/bin/env node
/**
 * Nitro static output (.output/public) omits PWA files left at .nuxt/dist/client
 * by vite-plugin-pwa. Copy them next to index.html so /manifest.webmanifest and /sw.js work.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const clientDir = path.join(root, '.nuxt', 'dist', 'client');
const outPublic = path.join(root, '.output', 'public');

if (!fs.existsSync(clientDir)) {
  console.warn('sync-nuxt-pwa-assets: skip — missing', clientDir);
  process.exit(0);
}
if (!fs.existsSync(outPublic)) {
  console.warn('sync-nuxt-pwa-assets: skip — missing', outPublic);
  process.exit(0);
}

const copyIfPresent = (name) => {
  const from = path.join(clientDir, name);
  if (!fs.existsSync(from)) return;
  fs.copyFileSync(from, path.join(outPublic, name));
};

for (const name of ['manifest.webmanifest', 'sw.js']) {
  copyIfPresent(name);
}

for (const name of fs.readdirSync(clientDir)) {
  if (name.startsWith('workbox-') && name.endsWith('.js')) {
    copyIfPresent(name);
  }
}
