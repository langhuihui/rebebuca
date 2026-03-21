#!/usr/bin/env node
/**
 * Copy Nuxt static output to dist/server (used by build:server-app).
 * Stages via OS temp dir: .output/public may contain symlinks (e.g. …/server)
 * that make dist/server resolve *inside* the source tree; Node's cpSync then
 * throws ERR_FS_CP_EINVAL on Linux CI.
 */
import fs from 'node:fs';
import os from 'node:os';
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rebebuca-server-'));
const staging = path.join(tmpDir, 'out');
try {
  fs.cpSync(src, staging, { recursive: true, dereference: true });
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(staging, dest, { recursive: true, dereference: true });
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
