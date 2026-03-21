#!/usr/bin/env node
/**
 * Copy Nuxt static output to dist/server (used by build:server-app).
 * Avoids GNU cp edge cases (e.g. hard-link / nested "server" paths on Linux CI).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, '.output', 'public');
const dest = path.join(root, 'dist', 'server');

if (!fs.existsSync(src)) {
  console.error('copy-server-static: missing', src, '— run nuxi generate first.');
  process.exit(1);
}

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true, dereference: true });
