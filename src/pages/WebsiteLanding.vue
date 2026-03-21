<!--
 * Rebebuca marketing landing — minimal, focused on one-command launch.
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

      <div class="cmd-row">
        <code class="cmd" tabindex="0">{{ installCmd }}</code>
        <button type="button" class="copy" @click="copyCmd">
          {{ copied ? t.copied : t.copy }}
        </button>
      </div>
      <p class="hint">{{ t.hint }}</p>

      <p class="meta">{{ t.meta }}</p>

      <figure class="snap">
        <img
          :src="snapSrc"
          :alt="t.snapAlt"
          class="snap-img"
          width="960"
          loading="lazy"
          decoding="async"
        />
      </figure>
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
      <span>GPL-3.0</span>
      <span class="dot">·</span>
      <a href="https://rebebuca.com/">rebebuca.com</a>
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
    eyebrow: "Run configuration",
    title: "One command to run everything",
    lead:
      "Save shell tasks, open a terminal in the browser, and launch with one click—no global install.",
    copy: "Copy",
    copied: "Copied",
    hint: "Requires Node.js 18+. Default port 3000; use --port to change.",
    meta: "After paste: the UI opens in your browser automatically.",
    qqGroup: "",
    themeToggle: "Switch to light theme",
    themeToggleLight: "Switch to dark theme",
    snapAlt: "Rebebuca interface screenshot",
  },
  zh: {
    eyebrow: "运行配置管理",
    title: "一条命令，一键运行",
    lead:
      "把常用命令存成配置，在浏览器里开终端、点一下即跑——无需全局安装。",
    copy: "复制",
    copied: "已复制",
    hint: "需要 Node.js 18+。默认端口 3000，可用 --port 指定。",
    meta: "执行后会在本机启动服务并自动打开浏览器界面。",
    qqGroup: "加入 QQ 群",
    themeToggle: "切换到浅色主题",
    themeToggleLight: "切换到深色主题",
    snapAlt: "Rebebuca 界面截图",
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

const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

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
  margin: 0 0 2rem;
  max-width: 34rem;
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
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
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

.landing--light .cmd {
  background: #fff;
  border-color: #e2e8f0;
  color: #334155;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.landing--light .hint {
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

.landing--light .foot {
  color: #94a3b8;
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
