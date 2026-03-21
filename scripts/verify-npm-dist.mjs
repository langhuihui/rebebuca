/**
 * Ensures web-public/ exists before npm pack/publish (npx static UI).
 * Run via package.json "prepublishOnly" / "prepack".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = path.join(root, 'web-public', 'index.html');

if (!fs.existsSync(indexHtml)) {
  console.error(
    'prepublish: missing web-public (expected index.html).\n' +
      '  Run: pnpm run build:server-app',
  );
  process.exit(1);
}
