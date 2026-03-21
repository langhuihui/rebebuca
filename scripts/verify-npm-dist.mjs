/**
 * Ensures dist/server exists before npm publish (npx static UI).
 * Run via package.json "prepublishOnly".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = path.join(root, 'dist', 'server', 'index.html');

if (!fs.existsSync(indexHtml)) {
  console.error(
    'prepublish: missing dist/server (expected index.html).\n' +
      '  Run: pnpm run build:server-app',
  );
  process.exit(1);
}
