<!--
 * Rebebuca marketing landing — product value first; CLI docs collapsed below.
 -->
<template>
  <div
    class="landing"
    :class="{ 'landing--light': !isDark }"
    :lang="lang === 'zh' ? 'zh-CN' : 'en'"
  >
    <div class="bg" aria-hidden="true" />
    <header class="top">
      <img :src="logoSrc" alt="" class="logo" width="36" height="36" />
      <span class="brand">Rebebuca</span>
      <div class="spacer" />
      <button
        type="button"
        class="icon-btn"
        :title="themeToggleLabel"
        :aria-label="themeToggleLabel"
        @click="toggleTheme"
      >
        <svg
          v-if="isDark"
          class="theme-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
        <svg
          v-else
          class="theme-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      </button>
      <button type="button" class="lang" @click="toggleLang">
        {{ lang === "zh" ? "EN" : "中文" }}
      </button>
      <a
        class="top-link"
        href="https://github.com/langhuihui/rebebuca"
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub
      </a>
      <a
        class="top-link"
        href="https://discord.gg/cNp7NYfH"
        target="_blank"
        rel="noopener noreferrer"
      >
        Discord
      </a>
      <a
        class="top-link"
        href="https://x.com/m7server"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="X (Twitter)"
      >
        X
      </a>
    </header>

    <main class="hero">
      <p class="eyebrow">{{ t.eyebrow }}</p>
      <h1 class="title">{{ t.title }}</h1>
      <p class="lead">{{ t.lead }}</p>

      <section class="value" :aria-label="t.valueAria">
        <ul class="value-grid">
          <li
            v-for="(item, idx) in t.valueProps"
            :key="'value-' + idx"
            class="value-card"
          >
            <h2 class="value-title">{{ item.title }}</h2>
            <p class="value-desc">{{ item.desc }}</p>
          </li>
        </ul>
      </section>

      <p class="try-label">{{ t.tryLabel }}</p>

      <div class="cmd-row">
        <code class="cmd" tabindex="0">{{ installCmd }}</code>
        <button type="button" class="copy" @click="copyCmd">
          {{ copied ? t.copied : t.copy }}
        </button>
      </div>
      <p class="hint">{{ t.hint }}</p>

      <p class="meta">{{ t.meta }}</p>

      <figure class="snap" aria-labelledby="snap-cap-heading">
        <img
          :src="snapSrc"
          :alt="t.snapAlt"
          class="snap-img"
          width="960"
          loading="lazy"
          decoding="async"
        />
        <figcaption class="snap-cap">
          <p id="snap-cap-heading" class="snap-cap-title">{{ t.snapCaption }}</p>
          <ul class="snap-legend">
            <li
              v-for="(item, idx) in t.snapRegions"
              :key="'snap-' + idx"
              class="snap-legend-item"
              :class="'snap-legend-item--' + item.tone"
            >
              <span class="snap-legend-label">{{ item.label }}</span>
              <span class="snap-legend-desc">{{ item.desc }}</span>
            </li>
          </ul>
        </figcaption>
      </figure>

      <details class="docs-fold">
        <summary class="docs-fold-summary">{{ t.cliFoldSummary }}</summary>
        <div class="docs-fold-panel cli-docs">
          <h2 class="cli-title">{{ t.cliTitle }}</h2>
          <p class="cli-intro">{{ t.cliIntro }}</p>
          <p class="cli-env">{{ t.cliEnvNote }}</p>
          <h3 class="cli-subheading">{{ t.cliOptionsHeading }}</h3>
          <ul class="cli-list">
            <li
              v-for="(row, idx) in t.cliOptions"
              :key="'cli-opt-' + idx"
              class="cli-item"
            >
              <code class="cli-flag">{{ row[0] }}</code>
              <span class="cli-desc">{{ row[1] }}</span>
            </li>
          </ul>
          <h3 class="cli-subheading">{{ t.cliCommandsHeading }}</h3>
          <ul class="cli-list">
            <li
              v-for="(row, idx) in t.cliCommands"
              :key="'cli-cmd-' + idx"
              class="cli-item"
            >
              <code class="cli-flag cli-flag--wide">{{ row[0] }}</code>
              <span class="cli-desc">{{ row[1] }}</span>
            </li>
          </ul>
          <p class="cli-help">{{ t.cliHelpHint }}</p>
        </div>
      </details>

      <details class="docs-fold docs-fold--secondary">
        <summary class="docs-fold-summary">{{ t.portHunterFoldSummary }}</summary>
        <div class="docs-fold-panel cli-docs ph-docs">
          <h2 class="cli-title">{{ t.portHunterTitle }}</h2>
          <p class="cli-intro">{{ t.portHunterIntro }}</p>
          <div class="cmd-row ph-cmd-row">
            <code class="cmd" tabindex="0">{{ portHunterInstallCmd }}</code>
            <button type="button" class="copy" @click="copyPortHunterCmd">
              {{ phCopied ? t.copied : t.copy }}
            </button>
          </div>
          <ul class="ph-list">
            <li v-for="(line, idx) in t.portHunterBullets" :key="'ph-' + idx">
              {{ line }}
            </li>
          </ul>
          <p class="cli-help ph-repo">{{ t.portHunterRepo }}</p>
        </div>
      </details>
    </main>

    <div v-if="lang === 'zh'" class="qq-card">
      <p class="qq-title">{{ t.qqGroup }}</p>
      <img
        src="/qrcode.jpg"
        alt="QQ 群二维码"
        class="qq-img"
        width="160"
        height="160"
        loading="lazy"
      />
    </div>

    <footer class="foot">
      <div class="foot-row foot-row--friends">
        <span class="foot-friends-label">{{ t.bukaFriends }}</span>
        <a
          class="foot-friend-link"
          href="https://monibuca.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            class="friend-logo"
            :src="monibucaLogoSrc"
            alt=""
            width="18"
            height="18"
            decoding="async"
          />
          <span>monibuca.com</span>
        </a>
        <span class="dot">·</span>
        <a
          class="foot-friend-link"
          href="https://jessibuca.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            class="friend-logo"
            :src="jessibucaLogoSrc"
            alt=""
            width="18"
            height="18"
            decoding="async"
          />
          <span>jessibuca.com</span>
        </a>
      </div>
      <div class="foot-row">
        <span>GPL-3.0</span>
        <span class="dot">·</span>
        <a href="https://rebebuca.com/">rebebuca.com</a>
      </div>
      <div v-if="lang === 'zh'" class="foot-row foot-row--beian">
        <span class="foot-beian-copy">{{ t.beianCopyright }}</span>
        <span class="dot">·</span>
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
        >苏ICP备20230258075号-1</a>
        <span class="dot">·</span>
        <a
          href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=32011302321580"
          target="_blank"
          rel="noopener noreferrer"
        >苏公网安备 32011302321580号</a>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

const THEME_STORAGE_KEY = "rebebuca-landing-is-dark";

function readStoredTheme(): { override: boolean; dark: boolean } {
  if (typeof window === "undefined") {
    return { override: false, dark: true };
  }
  try {
    const s = localStorage.getItem(THEME_STORAGE_KEY);
    if (s === "1") return { override: true, dark: true };
    if (s === "0") return { override: true, dark: false };
    return {
      override: false,
      dark: window.matchMedia("(prefers-color-scheme: dark)").matches,
    };
  } catch {
    return { override: false, dark: true };
  }
}

type Lang = "en" | "zh";

const lang = ref<Lang>(
  typeof navigator !== "undefined" && /^zh/i.test(navigator.language)
    ? "zh"
    : "en"
);

const strings = {
  en: {
    eyebrow: "Developer task runner",
    title: "Save dev commands. Run them in the browser.",
    lead:
      "Rebebuca is a local web app for everyday shell work—npm scripts, builds, dev servers, tests. Organize tasks in a sidebar, run them in multi-tab terminals, and review history. Start with one command, no global install.",
    valueAria: "What Rebebuca does",
    valueProps: [
      {
        title: "Task library",
        desc: "Save name, command, working directory, and env vars—run any task with one click.",
      },
      {
        title: "Browser terminals",
        desc: "Multi-tab output in the UI; a local Node backend runs commands on your machine.",
      },
      {
        title: "Auto-discover",
        desc: "Import npm scripts, VS Code tasks, and more instead of retyping commands.",
      },
      {
        title: "SSH & MCP",
        desc: "Run on remote hosts over SSH; optional MCP endpoint for Cursor and other agents.",
      },
    ],
    tryLabel: "Try it now",
    copy: "Copy",
    copied: "Copied",
    hint: "Requires Node.js 18+. Default port 3000; use --port to change.",
    meta: "After paste: the UI opens in your browser automatically.",
    qqGroup: "",
    themeToggle: "Switch to light theme",
    themeToggleLight: "Switch to dark theme",
    snapCaption: "Main workspace after launch",
    snapAlt:
      "Rebebuca UI: task sidebar on the left, multi-tab terminals in the center, run history on the right",
    snapRegions: [
      {
        tone: "left",
        label: "Left — Tasks",
        desc: "Saved commands plus auto-discovered npm and VS Code tasks.",
      },
      {
        tone: "center",
        label: "Center — Terminals",
        desc: "Multi-tab live output; each run gets its own tab.",
      },
      {
        tone: "right",
        label: "Right — History",
        desc: "Past runs—re-launch or review output.",
      },
    ],
    cliFoldSummary: "CLI flags & subcommands (power users)",
    bukaFriends: "Buka series",
    beianCopyright: "",
    cliTitle: "Command-line options",
    cliIntro:
      "These flags apply when you start the web UI and backend. Subcommands run without starting the server.",
    cliEnvNote:
      "Environment: REBEBUCA_NO_MCP=1 or true also disables MCP (same as --no-mcp).",
    cliOptionsHeading: "Startup flags",
    cliCommandsHeading: "Subcommands",
    cliOptions: [
      [
        "--port <n>, -p",
        "HTTP port for the UI and MCP (default 3000). A bare positive number is shorthand for --port.",
      ],
      ["--host <addr>", "Bind address (default 127.0.0.1)."],
      ["--no-open", "Do not open the browser automatically."],
      [
        "--no-mcp",
        "Do not expose MCP routes (/health, /mcp/*) on the same port.",
      ],
      ["-h, --help", "Print help."],
      ["-v, --version", "Print version."],
    ],
    cliCommands: [
      [
        "list [tasks|options|all] [--json]",
        "Print tasks or options from the local store (~/.rebebuca/store.json).",
      ],
      [
        "run <id-or-name>",
        "Run a saved user task from the terminal (fuzzy match on name).",
      ],
      [
        "kill-port [--force|-f] <port>…",
        "SIGTERM processes listening on the ports; --force uses SIGKILL.",
      ],
      ["-- <command> [args…]", "Run a shell command without starting Rebebuca."],
      [
        "complete bash|zsh",
        "Print a tab-completion script (e.g. eval \"$(npx rebebuca complete zsh)\").",
      ],
    ],
    cliHelpHint: "Tip: run npx rebebuca --help in your terminal for the full, up-to-date usage text.",
    portHunterFoldSummary: "Related: Port Hunter CLI (find & kill port listeners)",
    portHunterTitle: "Port Hunter CLI",
    portHunterIntro:
      "A terminal tool to list TCP listeners, inspect commands and resource usage, and stop processes with two-step confirmation—bundled in the same repository as Rebebuca.",
    portHunterBullets: [
      "Shows port, PID, project folder, uptime, memory, CPU (macOS), and command line.",
      "Interactive TUI: fuzzy filter (/), refresh, kill with confirmation.",
      "Use port-hunter --once for a one-shot table in the terminal.",
    ],
    portHunterRepo:
      "Package directory: port-hunter-cli — source on GitHub with Rebebuca.",
  },
  zh: {
    eyebrow: "开发者任务运行台",
    title: "常用命令，在浏览器里一键运行",
    lead:
      "Rebebuca 是本地 Web 开发运行工具：把 npm scripts、构建、本地服务、测试等存成任务，在侧边栏管理、多标签终端里执行，并保留运行历史。一条 npx 命令即可使用，无需全局安装。",
    valueAria: "Rebebuca 能做什么",
    valueProps: [
      {
        title: "任务库",
        desc: "保存名称、命令、工作目录与环境变量，点一下即可运行。",
      },
      {
        title: "浏览器终端",
        desc: "在网页多标签里查看实时输出，由本机 Node 后端执行命令。",
      },
      {
        title: "自动发现",
        desc: "识别 npm scripts、VS Code tasks 等，少记命令、少手工录入。",
      },
      {
        title: "SSH 与 MCP",
        desc: "支持 SSH 远程执行；可选 MCP 端点，供 Cursor 等 AI 工具调用任务。",
      },
    ],
    tryLabel: "立即试用",
    copy: "复制",
    copied: "已复制",
    hint: "需要 Node.js 18+。默认端口 3000，可用 --port 指定。",
    meta: "执行后会在本机启动服务并自动打开浏览器界面。",
    qqGroup: "加入 QQ 群",
    themeToggle: "切换到浅色主题",
    themeToggleLight: "切换到深色主题",
    snapCaption: "启动后的主工作区",
    snapAlt:
      "Rebebuca 界面：左侧任务列表、中间多标签终端、右侧运行历史",
    snapRegions: [
      {
        tone: "left",
        label: "左侧 · 任务",
        desc: "已保存的命令与自动发现的 npm、VS Code 任务。",
      },
      {
        tone: "center",
        label: "中间 · 终端",
        desc: "多标签实时输出，每次运行独占一个标签页。",
      },
      {
        tone: "right",
        label: "右侧 · 历史",
        desc: "过往运行记录，可再次执行或查看输出。",
      },
    ],
    cliFoldSummary: "命令行参数与子命令（进阶）",
    bukaFriends: "不卡系列",
    beianCopyright:
      "©2025 Rebebuca All Rights Reserved 南京莫妮不卡科技有限公司",
    cliTitle: "命令行参数",
    cliIntro:
      "下列选项在启动 Web 界面与本地后端时生效；子命令不会启动 HTTP 服务。",
    cliEnvNote:
      "环境变量 REBEBUCA_NO_MCP=1（或 true）与 --no-mcp 效果相同。",
    cliOptionsHeading: "启动选项",
    cliCommandsHeading: "子命令",
    cliOptions: [
      [
        "--port <n>、-p",
        "Web 与 MCP 使用的 HTTP 端口（默认 3000）。单独写一个正整数等价于 --port。",
      ],
      ["--host <addr>", "监听地址（默认 127.0.0.1）。"],
      ["--no-open", "启动后不自动打开浏览器。"],
      ["--no-mcp", "不在同一端口提供 MCP 相关路由（/health、/mcp/*）。"],
      ["-h、--help", "显示帮助。"],
      ["-v、--version", "显示版本号。"],
    ],
    cliCommands: [
      [
        "list [tasks|options|all] [--json]",
        "列出本地存储中的任务或选项（~/.rebebuca/store.json）。",
      ],
      ["run <id-or-name>", "在终端运行已保存的用户任务（支持名称模糊匹配）。"],
      [
        "kill-port [--force|-f] <port>…",
        "向占用端口的进程发 SIGTERM；--force 使用 SIGKILL。",
      ],
      ["-- <command> [args…]", "直接执行一条 shell 命令，不启动 Rebebuca 服务。"],
      [
        "complete bash|zsh",
        "输出补全脚本（例如 eval \"$(npx rebebuca complete zsh)\"）。",
      ],
    ],
    cliHelpHint: "提示：在终端执行 npx rebebuca --help 可查看与当前版本一致的完整说明。",
    portHunterFoldSummary: "相关工具：Port Hunter CLI（终端查杀占用端口）",
    portHunterTitle: "Port Hunter CLI（端口猎人）",
    portHunterIntro:
      "在终端查看本机 TCP 监听、进程命令行与资源占用，并在双重确认后结束进程；与 Rebebuca 同属一个开源仓库。",
    portHunterBullets: [
      "展示端口、PID、项目目录、运行时长、内存、CPU（macOS）与命令行等信息。",
      "交互界面支持模糊筛选（/）、刷新、两步确认结束监听进程。",
      "执行 port-hunter --once 可一次性输出表格。",
    ],
    portHunterRepo: "npm 包目录：port-hunter-cli，源码与 Rebebuca 同在 GitHub 仓库。",
  },
} as const;

const initialTheme = readStoredTheme();
const userThemeOverride = ref(initialTheme.override);
const isDark = ref(initialTheme.dark);

const t = computed(() => strings[lang.value]);

const themeToggleLabel = computed(() =>
  isDark.value ? strings[lang.value].themeToggle : strings[lang.value].themeToggleLight
);

const installCmd = "npx rebebuca";

const portHunterInstallCmd = "npx port-hunter-cli";

const snapSrc = computed(() => {
  const zh = lang.value === "zh";
  const d = isDark.value;
  if (zh && d) return "/snap1_cn_dark.png";
  if (zh) return "/snap1_cn.png";
  if (d) return "/snap1_dark.png";
  return "/snap1.png";
});

const logoSrc = computed(() =>
  isDark.value ? "/logo-dark.svg" : "/logo.svg"
);

/** Icon marks: colored on light UI, white + accent on dark UI (from product LOGO set). */
const monibucaLogoSrc = computed(() =>
  isDark.value ? "/buka/monibuca-dark.svg" : "/buka/monibuca.svg"
);

const jessibucaLogoSrc = computed(() =>
  isDark.value ? "/buka/jessibuca-dark.svg" : "/buka/jessibuca.svg"
);

const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const phCopied = ref(false);
let phCopyTimer: ReturnType<typeof setTimeout> | null = null;

let mqlCleanup: (() => void) | null = null;

onMounted(() => {
  if (typeof window === "undefined") return;
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (!userThemeOverride.value) {
      isDark.value = mql.matches;
    }
  };
  mql.addEventListener("change", onChange);
  mqlCleanup = () => mql.removeEventListener("change", onChange);
});

onUnmounted(() => {
  mqlCleanup?.();
  if (copyTimer) clearTimeout(copyTimer);
  if (phCopyTimer) clearTimeout(phCopyTimer);
});

function toggleTheme() {
  userThemeOverride.value = true;
  isDark.value = !isDark.value;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? "1" : "0");
  } catch {
    /* private mode */
  }
}

function toggleLang() {
  lang.value = lang.value === "zh" ? "en" : "zh";
}

async function copyCmd() {
  try {
    await navigator.clipboard.writeText(installCmd);
    copied.value = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied.value = false;
      copyTimer = null;
    }, 2000);
  } catch {
    copied.value = false;
  }
}

async function copyPortHunterCmd() {
  try {
    await navigator.clipboard.writeText(portHunterInstallCmd);
    phCopied.value = true;
    if (phCopyTimer) clearTimeout(phCopyTimer);
    phCopyTimer = setTimeout(() => {
      phCopied.value = false;
      phCopyTimer = null;
    }, 2000);
  } catch {
    phCopied.value = false;
  }
}
</script>

<style scoped>
.landing {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: #e8eaef;
  color-scheme: dark;
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    "Helvetica Neue",
    Arial,
    sans-serif;
  -webkit-font-smoothing: antialiased;
}

.bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background: #07080c;
  background-image:
    radial-gradient(ellipse 120% 80% at 50% -20%, rgba(99, 102, 241, 0.22), transparent 55%),
    radial-gradient(ellipse 70% 50% at 100% 50%, rgba(56, 189, 248, 0.08), transparent 50%),
    radial-gradient(ellipse 60% 40% at 0% 80%, rgba(167, 139, 250, 0.06), transparent 45%);
}

.top,
.hero,
.foot {
  position: relative;
  z-index: 1;
}

.top {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 1.25rem 1.5rem;
  max-width: 56rem;
  margin: 0 auto;
  width: 100%;
}

.logo {
  border-radius: 9px;
  opacity: 0.95;
}

.brand {
  font-weight: 600;
  font-size: 1.05rem;
  letter-spacing: -0.02em;
  color: #f4f4f5;
}

.spacer {
  flex: 1;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.icon-btn:hover {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.06);
}

.theme-icon {
  display: block;
  flex-shrink: 0;
}

.lang,
.top-link {
  font-size: 0.8125rem;
  color: #94a3b8;
  text-decoration: none;
  padding: 0.35rem 0.65rem;
  border-radius: 6px;
  transition: color 0.15s ease, background 0.15s ease;
}

.lang {
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
}

.lang:hover,
.top-link:hover {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.06);
}

.hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 2rem 1.5rem 4rem;
  max-width: min(52rem, 100%);
  margin: 0 auto;
  width: 100%;
}

.eyebrow {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #818cf8;
  margin-bottom: 1rem;
}

.title {
  font-size: clamp(2rem, 6vw, 2.75rem);
  font-weight: 650;
  line-height: 1.12;
  letter-spacing: -0.03em;
  color: #fafafa;
  margin: 0 0 1rem;
}

.lead {
  font-size: 1.0625rem;
  line-height: 1.6;
  color: #a1a8b8;
  margin: 0 0 1.75rem;
  max-width: 36rem;
}

.value {
  margin: 0 0 1.75rem;
  max-width: 40rem;
  width: 100%;
}

.value-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.value-card {
  padding: 0.85rem 1rem;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(15, 17, 24, 0.55);
}

.value-title {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #e2e8f0;
  margin: 0 0 0.35rem;
}

.value-desc {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #8b93a5;
  margin: 0;
}

.try-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #818cf8;
  margin: 0 0 0.65rem;
}

.cmd-row {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0.65rem;
  margin-bottom: 0.75rem;
}

.cmd {
  flex: 1 1 12rem;
  font-family: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
  font-size: 0.95rem;
  padding: 0.85rem 1.1rem;
  background: rgba(15, 17, 24, 0.85);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 10px;
  color: #e2e8f0;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25) inset;
}

.copy {
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.85rem 1.35rem;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
  color: #0f172a;
  background: linear-gradient(165deg, #e0e7ff 0%, #c7d2fe 45%, #a5b4fc 100%);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.35) inset;
  transition: transform 0.12s ease, filter 0.12s ease;
}

.copy:hover {
  filter: brightness(1.05);
}

.copy:active {
  transform: scale(0.98);
}

.hint {
  font-size: 0.8125rem;
  color: #64748b;
  margin: 0 0 1.5rem;
  line-height: 1.5;
}

.meta {
  font-size: 0.875rem;
  color: #787f90;
  margin: 0;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  max-width: 32rem;
}

.cli-docs {
  margin: 0;
  max-width: 38rem;
  width: 100%;
}

.docs-fold {
  margin: 1.5rem 0 0;
  max-width: 40rem;
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(15, 17, 24, 0.45);
  overflow: hidden;
}

.docs-fold--secondary {
  margin-top: 0.75rem;
  border-color: rgba(148, 163, 184, 0.1);
  background: rgba(15, 17, 24, 0.28);
}

.docs-fold-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #c7d2fe;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.docs-fold-summary::-webkit-details-marker {
  display: none;
}

.docs-fold-summary::after {
  content: "";
  flex-shrink: 0;
  width: 0.45rem;
  height: 0.45rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(-45deg);
  opacity: 0.65;
  transition: transform 0.15s ease;
}

.docs-fold[open] > .docs-fold-summary::after {
  transform: rotate(45deg);
  margin-top: -0.15rem;
}

.docs-fold-panel {
  padding: 0 1rem 1.1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.docs-fold--secondary .docs-fold-summary {
  font-size: 0.8125rem;
  color: #94a3b8;
}

.cli-title {
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #f1f5f9;
  margin: 0 0 0.5rem;
}

.cli-intro,
.cli-env,
.cli-help {
  font-size: 0.8125rem;
  line-height: 1.55;
  color: #8b93a5;
  margin: 0 0 0.65rem;
}

.cli-env {
  margin-bottom: 1.25rem;
  color: #6f7a8f;
}

.ph-docs {
  margin-top: 0;
}

.ph-cmd-row {
  margin-bottom: 0.75rem;
}

.ph-list {
  margin: 0.65rem 0 0;
  padding-left: 1.25rem;
  font-size: 0.8125rem;
  line-height: 1.55;
  color: #8b93a5;
}

.ph-list li {
  margin-bottom: 0.45rem;
}

.ph-list li:last-child {
  margin-bottom: 0;
}

.ph-repo {
  margin-top: 1rem;
}

.cli-subheading {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #818cf8;
  margin: 1.35rem 0 0.65rem;
}

.cli-subheading:first-of-type {
  margin-top: 0;
}

.cli-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.cli-item {
  display: grid;
  grid-template-columns: minmax(7.5rem, max-content) 1fr;
  gap: 0.5rem 1rem;
  align-items: baseline;
}

.cli-flag {
  font-family: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(129, 140, 248, 0.22);
  color: #c7d2fe;
  white-space: nowrap;
}

.cli-flag--wide {
  white-space: normal;
  word-break: break-word;
}

.cli-desc {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #94a3b8;
}

.cli-help {
  margin-top: 1.35rem;
  margin-bottom: 0;
}

@media (max-width: 640px) {
  .value-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .cli-item {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }

  .cli-flag {
    white-space: normal;
    word-break: break-word;
    width: fit-content;
    max-width: 100%;
  }
}

.snap {
  margin: 2.25rem 0 0;
  padding: 0;
  max-width: 100%;
}

.snap-img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.15),
    0 24px 48px rgba(0, 0, 0, 0.4);
}

.snap-cap {
  margin: 1rem 0 0;
}

.snap-cap-title {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #818cf8;
  margin: 0 0 0.75rem;
}

.snap-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
}

.snap-legend-item {
  padding: 0.65rem 0.75rem 0.65rem 0.85rem;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(15, 17, 24, 0.5);
  border-left-width: 3px;
}

.snap-legend-item--left {
  border-left-color: #818cf8;
}

.snap-legend-item--center {
  border-left-color: #38bdf8;
}

.snap-legend-item--right {
  border-left-color: #a78bfa;
}

.snap-legend-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 0.25rem;
}

.snap-legend-desc {
  display: block;
  font-size: 0.75rem;
  line-height: 1.45;
  color: #8b93a5;
}

@media (max-width: 720px) {
  .snap-legend {
    grid-template-columns: 1fr;
  }
}

.qq-card {
  position: fixed;
  z-index: 30;
  bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
  right: calc(1rem + env(safe-area-inset-right, 0px));
  padding: 0.75rem 0.85rem;
  width: min(148px, calc(100vw - 2rem));
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(12, 14, 20, 0.92);
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
}

.qq-title {
  font-size: 0.6875rem;
  font-weight: 500;
  color: #a1a8b8;
  margin: 0 0 0.5rem;
  text-align: center;
  line-height: 1.35;
}

.qq-img {
  display: block;
  width: 100%;
  max-width: 120px;
  height: auto;
  margin: 0 auto;
  border-radius: 8px;
  background: #fff;
  padding: 5px;
  box-sizing: border-box;
}

.foot {
  padding: 1.25rem 1.5rem 1.75rem;
  font-size: 0.75rem;
  color: #525a6b;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.foot-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.foot-friends-label {
  color: #6b7288;
  margin-right: 0.125rem;
}

.foot-friend-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.friend-logo {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
  object-fit: contain;
  vertical-align: middle;
}

.foot-row--beian {
  max-width: 36rem;
  text-align: center;
  line-height: 1.5;
}

.foot-beian-copy {
  color: #6b7288;
}

.foot a {
  color: #6b7288;
  text-decoration: none;
}

.foot a:hover {
  color: #94a3b8;
}

.dot {
  opacity: 0.5;
}

/* —— Light theme (matches light UI screenshots) —— */
.landing--light {
  color: #1e293b;
  color-scheme: light;
}

.landing--light .bg {
  background: #f1f5f9;
  background-image:
    radial-gradient(ellipse 120% 80% at 50% -25%, rgba(99, 102, 241, 0.12), transparent 55%),
    radial-gradient(ellipse 70% 50% at 100% 40%, rgba(56, 189, 248, 0.06), transparent 50%),
    radial-gradient(ellipse 55% 45% at 0% 85%, rgba(167, 139, 250, 0.05), transparent 45%);
}

.landing--light .brand {
  color: #0f172a;
}

.landing--light .icon-btn {
  color: #64748b;
}

.landing--light .icon-btn:hover {
  color: #0f172a;
  background: rgba(15, 23, 42, 0.06);
}

.landing--light .lang,
.landing--light .top-link {
  color: #64748b;
}

.landing--light .lang:hover,
.landing--light .top-link:hover {
  color: #0f172a;
  background: rgba(15, 23, 42, 0.06);
}

.landing--light .eyebrow {
  color: #4f46e5;
}

.landing--light .title {
  color: #0f172a;
}

.landing--light .lead {
  color: #475569;
}

.landing--light .value-card {
  background: #fff;
  border-color: #e2e8f0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.landing--light .value-title {
  color: #0f172a;
}

.landing--light .value-desc {
  color: #64748b;
}

.landing--light .try-label {
  color: #4f46e5;
}

.landing--light .cmd {
  background: #fff;
  border-color: #e2e8f0;
  color: #334155;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.landing--light .hint {
  color: #64748b;
}

.landing--light .cli-title {
  color: #0f172a;
}

.landing--light .cli-intro,
.landing--light .cli-env,
.landing--light .cli-help {
  color: #64748b;
}

.landing--light .cli-env {
  color: #64748b;
}

.landing--light .cli-subheading {
  color: #4f46e5;
}

.landing--light .cli-flag {
  background: rgba(79, 70, 229, 0.08);
  border-color: rgba(79, 70, 229, 0.2);
  color: #4338ca;
}

.landing--light .cli-desc {
  color: #475569;
}

.landing--light .ph-list {
  color: #64748b;
}

.landing--light .meta {
  color: #64748b;
  border-top-color: rgba(148, 163, 184, 0.25);
}

.landing--light .snap-img {
  border-color: #e2e8f0;
  box-shadow:
    0 4px 6px rgba(15, 23, 42, 0.06),
    0 20px 40px rgba(15, 23, 42, 0.1);
}

.landing--light .snap-cap-title {
  color: #4f46e5;
}

.landing--light .snap-legend-item {
  background: #fff;
  border-color: #e2e8f0;
}

.landing--light .snap-legend-label {
  color: #0f172a;
}

.landing--light .snap-legend-desc {
  color: #64748b;
}

.landing--light .docs-fold {
  background: #fff;
  border-color: #e2e8f0;
}

.landing--light .docs-fold--secondary {
  background: #f8fafc;
}

.landing--light .docs-fold-summary {
  color: #4338ca;
}

.landing--light .docs-fold--secondary .docs-fold-summary {
  color: #64748b;
}

.landing--light .docs-fold-panel {
  border-top-color: #e2e8f0;
}

.landing--light .foot {
  color: #94a3b8;
}

.landing--light .foot-friends-label {
  color: #64748b;
}

.landing--light .foot-beian-copy {
  color: #64748b;
}

.landing--light .foot a {
  color: #64748b;
}

.landing--light .foot a:hover {
  color: #334155;
}

.landing--light .qq-card {
  background: rgba(255, 255, 255, 0.94);
  border-color: #e2e8f0;
  box-shadow: 0 8px 32px rgba(15, 23, 42, 0.12);
}

.landing--light .qq-title {
  color: #475569;
}

@media (prefers-reduced-motion: reduce) {
  .copy {
    transition: none;
  }
}
</style>
