/**
 * Port listener enrichment inspired by port-whisperer
 * https://github.com/larsencundric/port-whisperer
 *
 * Adds cwd, project, framework, docker mapping, uptime, memory, dev/orphan/zombie hints.
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const EXEC_SHORT_MS = 5000;
const EXEC_LONG_MS = 10000;

function formatMemory(rssKB) {
  if (rssKB > 1048576) return `${(rssKB / 1048576).toFixed(1)} GB`;
  if (rssKB > 1024) return `${(rssKB / 1024).toFixed(1)} MB`;
  return `${rssKB} KB`;
}

function detectFrameworkFromImage(image) {
  if (!image) return 'Docker';
  const img = image.toLowerCase();
  if (img.includes('postgres')) return 'PostgreSQL';
  if (img.includes('redis')) return 'Redis';
  if (img.includes('mysql') || img.includes('mariadb')) return 'MySQL';
  if (img.includes('mongo')) return 'MongoDB';
  if (img.includes('nginx')) return 'nginx';
  if (img.includes('localstack')) return 'LocalStack';
  if (img.includes('rabbitmq')) return 'RabbitMQ';
  if (img.includes('kafka')) return 'Kafka';
  if (img.includes('elasticsearch') || img.includes('opensearch')) return 'Elasticsearch';
  if (img.includes('minio')) return 'MinIO';
  return 'Docker';
}

function findProjectRoot(dir) {
  const markers = [
    'package.json',
    'Cargo.toml',
    'go.mod',
    'pyproject.toml',
    'Gemfile',
    'pom.xml',
    'build.gradle',
  ];
  let current = dir;
  let depth = 0;
  while (current !== '/' && current !== path.dirname(current) && depth < 15) {
    for (const marker of markers) {
      if (fs.existsSync(path.join(current, marker))) return current;
    }
    current = path.dirname(current);
    depth++;
  }
  return dir;
}

function detectFramework(projectRoot) {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps.next) return 'Next.js';
      if (allDeps.nuxt || allDeps.nuxt3) return 'Nuxt';
      if (allDeps['@sveltejs/kit']) return 'SvelteKit';
      if (allDeps.svelte) return 'Svelte';
      if (allDeps['@remix-run/react'] || allDeps.remix) return 'Remix';
      if (allDeps.astro) return 'Astro';
      if (allDeps.vite) return 'Vite';
      if (allDeps['@angular/core']) return 'Angular';
      if (allDeps.vue) return 'Vue';
      if (allDeps.react) return 'React';
      if (allDeps.express) return 'Express';
      if (allDeps.fastify) return 'Fastify';
      if (allDeps.hono) return 'Hono';
      if (allDeps.koa) return 'Koa';
      if (allDeps.nestjs || allDeps['@nestjs/core']) return 'NestJS';
      if (allDeps.gatsby) return 'Gatsby';
      if (allDeps['webpack-dev-server']) return 'Webpack';
      if (allDeps.esbuild) return 'esbuild';
      if (allDeps.parcel) return 'Parcel';
    } catch {
      /* ignore */
    }
  }
  if (fs.existsSync(path.join(projectRoot, 'vite.config.ts')) || fs.existsSync(path.join(projectRoot, 'vite.config.js')))
    return 'Vite';
  if (
    fs.existsSync(path.join(projectRoot, 'next.config.js')) ||
    fs.existsSync(path.join(projectRoot, 'next.config.mjs'))
  )
    return 'Next.js';
  if (fs.existsSync(path.join(projectRoot, 'angular.json'))) return 'Angular';
  if (fs.existsSync(path.join(projectRoot, 'Cargo.toml'))) return 'Rust';
  if (fs.existsSync(path.join(projectRoot, 'go.mod'))) return 'Go';
  if (fs.existsSync(path.join(projectRoot, 'manage.py'))) return 'Django';
  if (fs.existsSync(path.join(projectRoot, 'Gemfile'))) return 'Ruby';
  return null;
}

function detectFrameworkFromName(processName) {
  const name = (processName || '').toLowerCase();
  if (name === 'node') return 'Node.js';
  if (name === 'python' || name === 'python3') return 'Python';
  if (name === 'ruby') return 'Ruby';
  if (name === 'java') return 'Java';
  if (name === 'go') return 'Go';
  return null;
}

function detectFrameworkFromCommand(command, processName) {
  if (!command) return detectFrameworkFromName(processName);
  const cmd = command.toLowerCase();
  if (cmd.includes('next')) return 'Next.js';
  if (cmd.includes('vite')) return 'Vite';
  if (cmd.includes('nuxt')) return 'Nuxt';
  if (cmd.includes('angular') || cmd.includes('ng serve')) return 'Angular';
  if (cmd.includes('webpack')) return 'Webpack';
  if (cmd.includes('remix')) return 'Remix';
  if (cmd.includes('astro')) return 'Astro';
  if (cmd.includes('gatsby')) return 'Gatsby';
  if (cmd.includes('flask')) return 'Flask';
  if (cmd.includes('django') || cmd.includes('manage.py')) return 'Django';
  if (cmd.includes('uvicorn')) return 'FastAPI';
  if (cmd.includes('rails')) return 'Rails';
  if (cmd.includes('cargo') || cmd.includes('rustc')) return 'Rust';
  return detectFrameworkFromName(processName);
}

/** Whether the listener looks like a dev/runtime service vs typical desktop/system noise (port-whisperer-style). */
export function isDevProcess(processName, command) {
  const name = (processName || '').toLowerCase();
  const cmd = (command || '').toLowerCase();

  const systemApps = [
    'spotify',
    'raycast',
    'tableplus',
    'postman',
    'linear',
    'cursor',
    'controlce',
    'rapportd',
    'superhuma',
    'setappage',
    'slack',
    'discord',
    'firefox',
    'chrome',
    'google',
    'safari',
    'figma',
    'notion',
    'zoom',
    'teams',
    'code',
    'iterm2',
    'warp',
    'arc',
    'loginwindow',
    'windowserver',
    'systemuise',
    'kernel_task',
    'launchd',
    'mdworker',
    'mds_stores',
    'cfprefsd',
    'coreaudio',
    'corebrightne',
    'airportd',
    'bluetoothd',
    'sharingd',
    'usernoted',
    'notificationc',
    'cloudd',
    'systemd',
    'snapd',
    'networkmanager',
    'gdm',
    'sshd',
    'cron',
    'dbus-daemon',
    'polkitd',
    'rsyslogd',
    'thermald',
    'accounts-daemon',
    'svchost',
    'csrss',
    'lsass',
    'services',
    'explorer',
    'dwm',
    'searchindexer',
    'taskhostw',
    'runtimebroker',
    'shellexperiencehost',
  ];
  for (const app of systemApps) {
    if (name.startsWith(app)) return false;
  }

  const devNames = new Set([
    'node',
    'python',
    'python3',
    'ruby',
    'java',
    'go',
    'cargo',
    'deno',
    'bun',
    'php',
    'uvicorn',
    'gunicorn',
    'flask',
    'rails',
    'npm',
    'npx',
    'yarn',
    'pnpm',
    'tsc',
    'tsx',
    'esbuild',
    'rollup',
    'turbo',
    'nx',
    'jest',
    'vitest',
    'mocha',
    'pytest',
    'cypress',
    'playwright',
    'rustc',
    'dotnet',
    'gradle',
    'mvn',
    'mix',
    'elixir',
  ]);
  if (devNames.has(name)) return true;
  if (name.startsWith('com.docke') || name === 'docker' || name === 'docker-sandbox') return true;

  const cmdIndicators = [
    /\bnode\b/,
    /\bnext[\s-]/,
    /\bvite\b/,
    /\bnuxt\b/,
    /\bwebpack\b/,
    /\bremix\b/,
    /\bastro\b/,
    /\bgulp\b/,
    /\bng serve\b/,
    /\bgatsb/,
    /\bflask\b/,
    /\bdjango\b|manage\.py/,
    /\buvicorn\b/,
    /\brails\b/,
    /\bcargo\b/,
  ];
  for (const re of cmdIndicators) {
    if (re.test(cmd)) return true;
  }
  return false;
}

async function batchDockerInfo() {
  const map = new Map();
  try {
    const { stdout } = await execFileAsync(
      'docker',
      ['ps', '--format', '{{.Ports}}\t{{.Names}}\t{{.Image}}'],
      { timeout: EXEC_SHORT_MS, maxBuffer: 1024 * 1024 },
    );
    for (const line of stdout.trim().split('\n')) {
      if (!line.trim()) continue;
      const [portsStr, name, image] = line.split('\t');
      if (!portsStr || !name) continue;
      const portMatches = portsStr.matchAll(/(?:\d+\.\d+\.\d+\.\d+|::):(\d+)->/g);
      const seen = new Set();
      for (const m of portMatches) {
        const port = parseInt(m[1], 10);
        if (!seen.has(port)) {
          seen.add(port);
          map.set(port, { name, image });
        }
      }
    }
  } catch {
    /* docker not running / not installed */
  }
  return map;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** pid ppid stat rss etime command — etime is locale-independent (unlike lstart). */
const PS_LINE = /^(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(\S+)\s+(.*)$/;

async function batchProcessInfoDarwin(pids) {
  const map = new Map();
  for (const group of chunk(pids, 64)) {
    if (group.length === 0) continue;
    try {
      const pidList = group.join(',');
      const { stdout } = await execFileAsync(
        'ps',
        ['-ww', '-p', pidList, '-o', 'pid=,ppid=,stat=,rss=,etime=,command='],
        { timeout: EXEC_SHORT_MS, maxBuffer: 10 * 1024 * 1024 },
      );
      for (const line of stdout.trim().split('\n')) {
        if (!line.trim()) continue;
        const m = line.trim().match(PS_LINE);
        if (!m) continue;
        map.set(parseInt(m[1], 10), {
          ppid: parseInt(m[2], 10),
          stat: m[3],
          rss: parseInt(m[4], 10),
          etime: m[5],
          command: m[6],
        });
      }
    } catch {
      /* ignore chunk */
    }
  }
  return map;
}

async function batchCwdDarwin(pids) {
  const map = new Map();
  for (const group of chunk(pids, 48)) {
    if (group.length === 0) continue;
    try {
      const pidList = group.join(',');
      const { stdout } = await execFileAsync('lsof', ['-a', '-d', 'cwd', '-p', pidList], {
        timeout: EXEC_LONG_MS,
        maxBuffer: 10 * 1024 * 1024,
      });
      const lines = stdout.trim().split('\n').slice(1);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 9) continue;
        const pid = parseInt(parts[1], 10);
        const cwdPath = parts.slice(8).join(' ');
        if (cwdPath && cwdPath.startsWith('/')) map.set(pid, cwdPath);
      }
    } catch {
      /* ignore */
    }
  }
  return map;
}

function getProcessNameFromProc(pid) {
  try {
    const commPath = `/proc/${pid}/comm`;
    if (fs.existsSync(commPath)) return fs.readFileSync(commPath, 'utf8').trim();
  } catch {
    /* ignore */
  }
  return 'unknown';
}

async function batchProcessInfoLinux(pids) {
  const map = new Map();
  for (const group of chunk(pids, 64)) {
    if (group.length === 0) continue;
    try {
      const pidList = group.join(',');
      const { stdout } = await execFileAsync(
        'ps',
        ['-ww', '-p', pidList, '-o', 'pid=,ppid=,stat=,rss=,etime=,command='],
        { timeout: EXEC_SHORT_MS, maxBuffer: 10 * 1024 * 1024 },
      );
      for (const line of stdout.trim().split('\n')) {
        if (!line.trim()) continue;
        const m = line.trim().match(PS_LINE);
        if (!m) continue;
        map.set(parseInt(m[1], 10), {
          ppid: parseInt(m[2], 10),
          stat: m[3],
          rss: parseInt(m[4], 10),
          etime: m[5],
          command: m[6],
        });
      }
    } catch {
      /* ignore */
    }
  }
  for (const pid of pids) {
    if (map.has(pid)) continue;
    try {
      const procDir = `/proc/${pid}`;
      if (!fs.existsSync(procDir)) continue;
      const statContent = fs.readFileSync(`${procDir}/stat`, 'utf8');
      const lastParen = statContent.lastIndexOf(')');
      const afterComm = statContent.slice(lastParen + 2).split(' ');
      const stat = afterComm[0] || '?';
      const ppid = parseInt(afterComm[1], 10) || 0;
      let rss = 0;
      try {
        const statmContent = fs.readFileSync(`${procDir}/statm`, 'utf8');
        rss = (parseInt(statmContent.split(' ')[1], 10) || 0) * 4;
      } catch {
        /* ignore */
      }
      let command = '';
      try {
        command = fs
          .readFileSync(`${procDir}/cmdline`, 'utf8')
          .split('\0')
          .filter(Boolean)
          .join(' ');
      } catch {
        /* ignore */
      }
      map.set(pid, {
        ppid,
        stat,
        rss,
        etime: '',
        command: command || getProcessNameFromProc(pid),
      });
    } catch {
      /* ignore */
    }
  }
  return map;
}

function batchCwdLinux(pids) {
  const map = new Map();
  for (const pid of pids) {
    try {
      const cwdLink = `/proc/${pid}/cwd`;
      if (fs.existsSync(cwdLink)) {
        const cwd = fs.readlinkSync(cwdLink);
        if (cwd && cwd.startsWith('/')) map.set(pid, cwd);
      }
    } catch {
      /* ignore */
    }
  }
  return map;
}

async function batchProcessInfoWindows(pids) {
  const map = new Map();
  if (pids.length === 0) return map;
  for (const group of chunk(pids, 40)) {
    const idList = group.join(',');
    const psScript = `$ids = @(${idList}); Get-CimInstance Win32_Process | Where-Object { $ids -contains $_.ProcessId } | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress`;
    try {
      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-Command', psScript],
        { timeout: EXEC_LONG_MS, maxBuffer: 10 * 1024 * 1024, windowsHide: true },
      );
      const text = stdout.trim();
      if (!text) continue;
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      for (const row of rows) {
        if (!row || row.ProcessId == null) continue;
        const pid = parseInt(row.ProcessId, 10);
        const cmd = row.CommandLine || '';
        map.set(pid, {
          ppid: row.ParentProcessId != null ? parseInt(row.ParentProcessId, 10) : 0,
          stat: '',
          rss: 0,
          etime: '',
          command: cmd,
        });
      }
    } catch {
      /* ignore chunk */
    }
  }
  return map;
}

/**
 * @param {Array<{ port: number, pid: number, process: string, protocol?: string }>} entries
 * @returns {Promise<object[]>}
 */
export async function enrichListeningPorts(entries) {
  const platform = os.platform();
  const uniquePids = [...new Set(entries.map((e) => e.pid).filter((p) => p > 0))];

  let psMap = new Map();
  let cwdMap = new Map();

  if (platform === 'darwin') {
    psMap = await batchProcessInfoDarwin(uniquePids);
    cwdMap = await batchCwdDarwin(uniquePids);
  } else if (platform !== 'win32') {
    psMap = await batchProcessInfoLinux(uniquePids);
    cwdMap = batchCwdLinux(uniquePids);
  } else psMap = await batchProcessInfoWindows(uniquePids);

  /** Map published host ports to container names/images when Docker is available */
  const dockerMap = await batchDockerInfo();

  return entries.map(({ port, pid, process: processName, protocol = 'tcp' }) => {
    const ps = psMap.get(pid);
    const cwdRaw = cwdMap.get(pid);
    const command = ps ? ps.command : '';
    const displayName = processName || path.basename((command || '').split(/\s+/)[0] || '') || 'unknown';

    const row = {
      port,
      pid,
      process: displayName,
      protocol,
      command: command || undefined,
      cwd: undefined,
      project: undefined,
      framework: null,
      uptime: null,
      status: 'healthy',
      memory: null,
      dockerContainer: undefined,
      dockerImage: undefined,
    };

    if (ps) {
      if (ps.stat && ps.stat.includes('Z')) row.status = 'zombie';
      else if (ps.ppid === 1 && isDevProcess(displayName, command)) row.status = 'orphaned';
      if (ps.rss > 0) row.memory = formatMemory(ps.rss);
      if (ps.etime && ps.etime !== '-') row.uptime = ps.etime.trim();
      row.framework = detectFrameworkFromCommand(command, displayName) || row.framework;
    }

    const docker = dockerMap.get(port);
    if (docker) {
      row.dockerContainer = docker.name;
      row.dockerImage = docker.image;
      row.framework = detectFrameworkFromImage(docker.image);
      row.process = 'docker';
      row.project = docker.name;
    } else if (cwdRaw) {
      const projectRoot = findProjectRoot(cwdRaw);
      row.cwd = projectRoot;
      row.project = path.basename(projectRoot);
      row.framework = row.framework || detectFramework(projectRoot);
    }

    if (!row.framework) row.framework = detectFrameworkFromName(displayName);

    return row;
  });
}
