#!/usr/bin/env node
/**
 * Rebebuca CLI
 *
 * Usage:
 *   npx rebebuca
 *   npx rebebuca --port 8080
 *   npx rebebuca list [tasks|options|all] [--json]
 *   npx rebebuca run <task-id-or-fuzzy-name>
 *   npx rebebuca kill-port 3000 [--force]
 *   npx rebebuca -- npm run build
 *   npx rebebuca complete zsh   # print completion script
 *
 * Options:
 *   --port <number>    Port for the web UI and MCP (default: 3000)
 *   --host <string>    Host to bind to (default: 127.0.0.1)
 *   --no-open          Do not open browser automatically
 *   --no-mcp           Do not expose MCP routes (/health, /mcp/*)
 *   -h, --help         Show this help message
 *   -v, --version      Show version number
 */

import { createServer } from '../node-server/server.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  cmdList,
  cmdRunTask,
  cmdShellPassthrough,
  cmdCompleteInternal,
  cmdPrintCompletion,
  cmdKillPort,
  getStorePathForHelp,
} from '../node-server/cli-subcommands.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Parse arguments ─────────────────────────────────────────────────────────

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
  const store = getStorePathForHelp();
  console.log(`
  Rebebuca v${getVersion()} — Run Configuration Management Tool

  Usage:
    npx rebebuca [options]                    Start web UI + backend
    npx rebebuca list [tasks|options|all] [--json]
    npx rebebuca run <id-or-name>             Run a user task (from ${store})
    npx rebebuca kill-port [--force|-f] <port> [<port>...]
                                              SIGTERM listeners (SIGKILL with --force)
    npx rebebuca -- <command> [args...]       Run shell command (no server)
    npx rebebuca complete bash|zsh           Print tab-completion script

  Options:
    --port <number>    Port for web UI and MCP (default: 3000)
    --host <string>    Host to bind to      (default: 127.0.0.1)
    --no-open          Skip auto-open in browser
    --no-mcp           Do not expose MCP on the same port
    -h, --help         Show this help message
    -v, --version      Show version number

  Examples:
    npx rebebuca
    npx rebebuca --port 8080 --host 0.0.0.0
    npx rebebuca 9000                         # shorthand for --port 9000
    npx rebebuca list tasks
    npx rebebuca list all --json
    npx rebebuca run dev
    npx rebebuca kill-port 3000
    npx rebebuca kill-port --force 8080 5173
    npx rebebuca -- pnpm test
    eval "$(npx rebebuca complete zsh)"       # fuzzy task ids on: rebebuca run <tab>
`);
}

/**
 * @param {string[]} argv
 * @returns {{
 *   kind: 'help' | 'version' | 'server' | 'list' | 'run' | 'kill-port' | 'shell' | 'complete' | '__complete',
 *   global: { port: number, host: string, open: boolean, enableMcp: boolean },
 *   listWhat?: string,
 *   listJson?: boolean,
 *   runQuery?: string,
 *   killPortArgs?: string[],
 *   shellArgs?: string[],
 *   completeShell?: string,
 *   completeSub?: string,
 *   completePartial?: string,
 * }}
 */
function parseCli(argv) {
  const global = {
    port: 3000,
    host: '127.0.0.1',
    open: true,
    enableMcp: true,
  };

  if (process.env.REBEBUCA_NO_MCP === '1' || process.env.REBEBUCA_NO_MCP === 'true') {
    global.enableMcp = false;
  }

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      return { kind: 'help', global };
    }

    if (arg === '-v' || arg === '--version') {
      return { kind: 'version', global };
    }

    if (arg === '--no-open') {
      global.open = false;
      i++;
      continue;
    }

    if (arg === '--no-mcp') {
      global.enableMcp = false;
      i++;
      continue;
    }

    if (arg === '--port' || arg === '-p') {
      const next = argv[i + 1];
      if (!next || isNaN(Number(next))) {
        console.error(`Error: --port requires a valid number`);
        process.exit(1);
      }
      global.port = parseInt(next, 10);
      i += 2;
      continue;
    }

    if (arg.startsWith('--port=')) {
      const val = arg.slice('--port='.length);
      if (isNaN(Number(val))) {
        console.error(`Error: --port requires a valid number`);
        process.exit(1);
      }
      global.port = parseInt(val, 10);
      i++;
      continue;
    }

    if (arg === '--host') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        console.error(`Error: --host requires a value`);
        process.exit(1);
      }
      global.host = next;
      i += 2;
      continue;
    }

    if (arg.startsWith('--host=')) {
      global.host = arg.slice('--host='.length);
      i++;
      continue;
    }

    if (arg === '--') {
      return { kind: 'shell', global, shellArgs: argv.slice(i + 1) };
    }

    if (arg === 'list') {
      const rest = argv.slice(i + 1);
      const json = rest.includes('--json');
      const filtered = rest.filter((x) => x !== '--json');
      let what = 'tasks';
      if (filtered[0]) {
        if (!['tasks', 'options', 'all'].includes(filtered[0])) {
          console.error('Usage: rebebuca list [tasks|options|all] [--json]');
          process.exit(1);
        }
        what = filtered[0];
      }
      return { kind: 'list', global, listWhat: what, listJson: json };
    }

    if (arg === 'run') {
      const rest = argv.slice(i + 1);
      if (!rest.length) {
        console.error('Usage: rebebuca run <task-id-or-name>');
        process.exit(1);
      }
      return { kind: 'run', global, runQuery: rest.join(' ') };
    }

    if (arg === 'kill-port') {
      const rest = argv.slice(i + 1);
      return { kind: 'kill-port', global, killPortArgs: rest };
    }

    if (arg === 'complete') {
      const shell = argv[i + 1];
      return { kind: 'complete', global, completeShell: shell };
    }

    if (arg === '__complete') {
      const sub = argv[i + 1];
      const partial = argv.slice(i + 2).join(' ');
      return { kind: '__complete', global, completeSub: sub, completePartial: partial };
    }

    if (!isNaN(Number(arg)) && Number(arg) > 0) {
      global.port = parseInt(arg, 10);
      i++;
      continue;
    }

    if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }

    console.error(`Unexpected argument: ${arg}`);
    process.exit(1);
  }

  return { kind: 'server', global };
}

// ── Main ─────────────────────────────────────────────────────────────────────

const parsed = parseCli(process.argv.slice(2));

if (parsed.kind === 'help') {
  printHelp();
  process.exit(0);
}

if (parsed.kind === 'version') {
  printVersion();
  process.exit(0);
}

if (parsed.kind === 'list') {
  cmdList(parsed.listWhat || 'tasks', !!parsed.listJson);
  process.exit(0);
}

if (parsed.kind === 'run') {
  await cmdRunTask(parsed.runQuery || '');
}

if (parsed.kind === 'kill-port') {
  await cmdKillPort(parsed.killPortArgs || []);
}

if (parsed.kind === 'shell') {
  const code = await cmdShellPassthrough(parsed.shellArgs || []);
  process.exit(code);
}

if (parsed.kind === 'complete') {
  cmdPrintCompletion(parsed.completeShell);
  process.exit(0);
}

if (parsed.kind === '__complete') {
  await cmdCompleteInternal(parsed.completeSub || '', parsed.completePartial || '');
  process.exit(0);
}

const args = parsed.global;

console.log(`\n  Rebebuca v${getVersion()}`);
console.log(`  Starting on port ${args.port}...\n`);

try {
  await createServer({
    port: args.port,
    host: args.host,
    enableMcp: args.enableMcp,
  });

  if (args.open) {
    const url = `http://localhost:${args.port}`;
    try {
      const { default: open } = await import('open');
      await open(url);
    } catch (_) {
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
