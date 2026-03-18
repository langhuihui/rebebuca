#!/usr/bin/env node
/**
 * Rebebuca CLI
 *
 * Usage:
 *   npx rebebuca
 *   npx rebebuca --port 8080
 *   npx rebebuca --port 8080 --host 0.0.0.0
 *   npx rebebuca --no-open
 *
 * Options:
 *   --port <number>    Port for the web UI (default: 3000)
 *   --host <string>    Host to bind to (default: 127.0.0.1)
 *   --no-open          Do not open browser automatically
 *   -h, --help         Show this help message
 *   -v, --version      Show version number
 */

import { createServer } from '../node-server/server.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Parse arguments ─────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { port: 3000, host: '127.0.0.1', open: true };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }

    if (arg === '-v' || arg === '--version') {
      printVersion();
      process.exit(0);
    }

    if (arg === '--no-open') {
      args.open = false;
      continue;
    }

    if (arg === '--port' || arg === '-p') {
      const next = argv[i + 1];
      if (!next || isNaN(Number(next))) {
        console.error(`Error: --port requires a valid number`);
        process.exit(1);
      }
      args.port = parseInt(next, 10);
      i++;
      continue;
    }

    if (arg.startsWith('--port=')) {
      const val = arg.slice('--port='.length);
      if (isNaN(Number(val))) {
        console.error(`Error: --port requires a valid number`);
        process.exit(1);
      }
      args.port = parseInt(val, 10);
      continue;
    }

    if (arg === '--host') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        console.error(`Error: --host requires a value`);
        process.exit(1);
      }
      args.host = next;
      i++;
      continue;
    }

    if (arg.startsWith('--host=')) {
      args.host = arg.slice('--host='.length);
      continue;
    }

    // Positional: treat first bare number as port (convenience shorthand)
    if (!isNaN(Number(arg)) && Number(arg) > 0) {
      args.port = parseInt(arg, 10);
      continue;
    }
  }

  return args;
}

function getVersion() {
  try {
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg.version || 'unknown';
  } catch (_) {
    return 'unknown';
  }
}

function printVersion() {
  console.log(getVersion());
}

function printHelp() {
  console.log(`
  Rebebuca v${getVersion()} — Run Configuration Management Tool

  Usage:
    npx rebebuca [options]

  Options:
    --port <number>    Port for the web UI  (default: 3000)
    --host <string>    Host to bind to      (default: 127.0.0.1)
    --no-open          Skip auto-open in browser
    -h, --help         Show this help message
    -v, --version      Show version number

  Examples:
    npx rebebuca
    npx rebebuca --port 8080
    npx rebebuca --port 8080 --host 0.0.0.0
    npx rebebuca 9000          # shorthand for --port 9000
`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));

console.log(`\n  Rebebuca v${getVersion()}`);
console.log(`  Starting on port ${args.port}...\n`);

try {
  await createServer({ port: args.port, host: args.host });

  if (args.open) {
    const url = `http://localhost:${args.port}`;
    try {
      // Dynamic import to avoid bundler issues
      const { default: open } = await import('open');
      await open(url);
    } catch (_) {
      // open is optional — fall back gracefully
      console.log(`  Open your browser at ${url}`);
    }
  }
} catch (err) {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✗ Port ${args.port} is already in use.`);
    console.error(`    Try a different port: npx rebebuca --port ${args.port + 1}\n`);
  } else {
    console.error('\n  ✗ Failed to start Rebebuca:', err.message);
  }
  process.exit(1);
}
