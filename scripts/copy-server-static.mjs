#!/usr/bin/env node
/**
 * Copy Nuxt static output to web-public/ (used by build:server-app, shipped in npm).
 * Stages via OS temp dir: .output/public may contain symlinks (e.g. …/server)
 * that make the dest resolve *inside* the source tree; Node's cpSync then
 * throws ERR_FS_CP_EINVAL on Linux CI.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, '.output', 'public');
const publicDir = path.join(root, 'public');
const dest = path.join(root, 'web-public');

if (!fs.existsSync(src)) {
  console.error('copy-server-static: missing', src, '— run nuxi generate first.');
  process.exit(1);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rebebuca-server-'));
const staging = path.join(tmpDir, 'out');
try {
  fs.cpSync(src, staging, { recursive: true, dereference: true });
  // Nuxt static output omits root-level public/ files referenced as /logo.svg, /qrcode.jpg, etc.
  // Without them, the Node static handler falls through to index.html and images break.
  if (fs.existsSync(publicDir)) {
    fs.cpSync(publicDir, staging, { recursive: true, dereference: true });
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(staging, dest, { recursive: true, dereference: true });
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
