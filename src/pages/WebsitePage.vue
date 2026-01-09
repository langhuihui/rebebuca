<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 -->

<template>
  <div class="website-desktop">
    <n-config-provider
      :theme="darkTheme"
      :locale="locale"
      :date-locale="dateLocale"
    >
      <n-message-provider>
        <WebsiteContentInner
          :current-lang="currentLang"
          :current-version="currentVersion"
          :macos-url="macosUrl"
          :windows-url="windowsUrl"
          @toggle-lang="toggleLang"
        />
      </n-message-provider>
    </n-config-provider>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  reactive,
  defineComponent,
  h,
  nextTick,
} from "vue";
import {
  NConfigProvider,
  NMessageProvider,
  NButton,
  NIcon,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NTag,
  NSelect,
  NTooltip,
  NRadio,
  NRadioGroup,
  NSpace,
  NDivider,
  NSwitch,
  NTabs,
  NTabPane,
  NInputNumber,
  NDataTable,
  NAlert,
  NSpin,
  NCheckbox,
  NCheckboxGroup,
  NScrollbar,
  darkTheme,
  zhCN,
  dateZhCN,
  useMessage,
} from "naive-ui";
import {
  LogoApple,
  LogoWindows,
  CodeSlashOutline,
  ChevronDownOutline,
  ChevronForwardOutline,
  SyncOutline,
  FolderOpenOutline,
  AddOutline,
  GitNetworkOutline,
  StarOutline,
  FolderOutline,
  SparklesOutline,
  StopOutline,
  SettingsOutline,
} from "@vicons/ionicons5";
import { useI18n } from "vue-i18n";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const { locale: i18nLocale } = useI18n();

// Theme & Language
const currentLang = ref(localStorage.getItem("rebebuca-locale") || "zh-CN");
const locale = computed(() => (currentLang.value === "zh-CN" ? zhCN : null));
const dateLocale = computed(() =>
  currentLang.value === "zh-CN" ? dateZhCN : null
);

// Version & Download URLs
const currentVersion = ref("v0.2.2");
const macosUrl = ref("");
const windowsUrl = ref("");

const toggleLang = () => {
  const newLang = currentLang.value === "zh-CN" ? "en" : "zh-CN";
  currentLang.value = newLang;
  localStorage.setItem("rebebuca-locale", newLang);
  i18nLocale.value = newLang;
};

const fetchVersion = async () => {
  try {
    const res = await fetch("https://download.m7s.live/rb/latest.json");
    const data = await res.json();

    currentVersion.value = `v${data.version}`;

    // Generate download URLs
    const version = data.version;
    macosUrl.value = `https://download.m7s.live/rb/v${version}/macos/Rebebuca.app.tar.gz`;
    windowsUrl.value = `https://download.m7s.live/rb/v${version}/nsis/Rebebuca_${version}_x64-setup.exe`;
  } catch (e) {
    console.error("Failed to fetch version:", e);
  }
};

onMounted(() => {
  fetchVersion();
  i18nLocale.value = currentLang.value;
});

// Inner component that uses useMessage inside NMessageProvider
const WebsiteContentInner = defineComponent({
  name: "WebsiteContentInner",
  props: {
    currentLang: String,
    currentVersion: String,
    macosUrl: String,
    windowsUrl: String,
  },
  emits: ["toggle-lang"],
  setup(props, { emit }) {
    const { t } = useI18n();
    const message = useMessage();

    // Tab state
    interface TabItem {
      id: string;
      name: string;
      type: "features" | "tech" | "monibuca" | "jessibuca" | "ports" | "settings";
      isTerminal?: boolean;
      isRunning?: boolean;
      terminal?: Terminal;
      fitAddon?: FitAddon;
    }
    const tabs = ref<TabItem[]>([]);
    const activeTab = ref<string | null>(null);
    const terminalRefs = ref<Record<string, HTMLDivElement>>({});

    // Groups expand state
    const expandedGroups = reactive({
      favorites: true,
      folder: true,
      npm: true,
    });

    const toggleGroup = (group: keyof typeof expandedGroups) => {
      expandedGroups[group] = !expandedGroups[group];
    };

    // Demo Tasks
    interface DemoTask {
      id: string;
      name: string;
      icon: string;
      action?: string;
    }

    const favoriteTasks = computed(() => [
      {
        id: "info",
        name: t("website.tasks.viewFeatures"),
        icon: "✨",
        action: "features",
      },
      {
        id: "tech",
        name: t("website.tasks.viewTech"),
        icon: "⚙️",
        action: "tech",
      },
      { id: "monibuca", name: "Monibuca", icon: "🎬", action: "monibuca" },
      { id: "jessibuca", name: "Jessibuca", icon: "📺", action: "jessibuca" },
    ]);

    const npmTasks = ref<DemoTask[]>([
      { id: "npm-dev", name: "dev", icon: "▶️", action: "run" },
      { id: "npm-build", name: "build", icon: "📦", action: "run" },
      { id: "npm-preview", name: "preview", icon: "👁️", action: "run" },
      { id: "npm-lint", name: "lint", icon: "🔍", action: "run" },
      { id: "npm-tauri", name: "tauri dev", icon: "🦀", action: "run" },
    ]);

    // Running state
    const runningTaskId = ref<string | null>(null);

    // Dialog states
    const showTaskEditDialog = ref(false);
    const showAddFolderDialog = ref(false);
    const showAIDialog = ref(false);

    // Add Folder Dialog form
    const addFolderForm = reactive({
      sourceFolder: "",
      isImportMode: false,
      targetGroupId: "default",
      newGroupName: "",
    });

    // Task Edit Dialog form (matches real TaskEditDialog)
    const taskEditForm = reactive({
      name: "",
      command: "",
      cwd: "",
      envStr: "",
      useSystemTerminal: false,
      groupId: "default",
    });

    // AI Dialog form
    const aiForm = reactive({
      provider: "ollama" as string,
      apiKey: "",
      ollamaUrl: "http://localhost:11434",
      ollamaModel: "qwen2.5:3b",
      prompt: "",
      loading: false,
      result: null as any,
      error: "",
    });

    const aiProviderOptions = [
      { label: "Ollama (本地)", value: "ollama" },
      { label: "OpenAI (GPT-4)", value: "openai" },
      { label: "Anthropic (Claude)", value: "anthropic" },
      { label: "DeepSeek", value: "deepseek" },
    ];

    const ollamaModelOptions = [
      { label: "Qwen2.5 3B", value: "qwen2.5:3b" },
      { label: "Qwen2.5 Coder 3B", value: "qwen2.5-coder:3b" },
      { label: "Qwen2.5 7B", value: "qwen2.5:7b" },
      { label: "Llama3.2 3B", value: "llama3.2:3b" },
      { label: "Phi3 Mini", value: "phi3:mini" },
      { label: "Mistral 7B", value: "mistral:7b" },
    ];

    const groupOptions = [
      { label: t("task.defaultGroup"), value: "default" },
      { label: t("task.favorites"), value: "favorites" },
      { label: t("task.createNewGroup"), value: "__new__" },
    ];

    // Demo ports data (grouped by process)
    const demoPortProcesses = ref([
      {
        pid: 12345,
        name: "node",
        command: "node server.js",
        ports: [5173, 5174],
      },
      { pid: 12346, name: "tauri", command: "tauri dev", ports: [1420] },
      {
        pid: 12347,
        name: "nginx",
        command: "nginx -g daemon off",
        ports: [80, 443],
      },
      {
        pid: 12348,
        name: "python",
        command: "python -m http.server",
        ports: [8000],
      },
      {
        pid: 12349,
        name: "go",
        command: "go run main.go",
        ports: [8080, 8081],
      },
      {
        pid: 12350,
        name: "rust",
        command: "cargo run",
        ports: [3000],
      },
      {
        pid: 12351,
        name: "postgres",
        command: "postgres -D /var/lib/postgresql/data",
        ports: [5432],
      },
      {
        pid: 12352,
        name: "redis",
        command: "redis-server",
        ports: [6379],
      },
      {
        pid: 12353,
        name: "mongodb",
        command: "mongod --dbpath /data/db",
        ports: [27017],
      },
      {
        pid: 12354,
        name: "mysql",
        command: "mysqld",
        ports: [3306],
      },
      {
        pid: 12355,
        name: "docker",
        command: "dockerd",
        ports: [2375, 2376],
      },
      {
        pid: 12356,
        name: "vite",
        command: "vite",
        ports: [5173],
      },
    ]);
    const portFilter = ref("");
    
    const filteredPortProcesses = computed(() => {
      if (!portFilter.value) return demoPortProcesses.value;
      const filter = portFilter.value.trim().toLowerCase();
      return demoPortProcesses.value.filter(
        (p) =>
          p.ports.some((port) => String(port).includes(filter)) ||
        p.name.toLowerCase().includes(filter) ||
        String(p.pid).includes(filter)
      );
    });
    
    const handleKillProcess = (pid: number) => {
      message.success(t("website.demo.processKilled"));
      demoPortProcesses.value = demoPortProcesses.value.filter(
        (p) => p.pid !== pid
      );
    };
    
    const handleRefreshPorts = () => {
      message.info(t("website.demo.portsRefreshed"));
    };

    // Features content for terminal output
    const featuresContent = computed(() => [
      `$ rebebuca --features`,
      ``,
      `Rebebuca - ${t("website.hero.subtitle")}`,
      ``,
      `${t("website.features.quickLaunch.title")}`,
      `  ${t("website.features.quickLaunch.desc")}`,
      ``,
      `${t("website.features.realtime.title")}`,
      `  ${t("website.features.realtime.desc")}`,
      ``,
      `${t("website.features.config.title")}`,
      `  ${t("website.features.config.desc")}`,
      ``,
      `${t("website.features.ui.title")}`,
      `  ${t("website.features.ui.desc")}`,
      ``,
      `[Done] Process exited with code 0`,
    ]);

    const techContent = computed(() => [
      `$ rebebuca --tech-stack`,
      ``,
      `Tech Stack:`,
      ``,
      `  Frontend:`,
      `    - Vue 3.5 (Composition API)`,
      `    - TypeScript 5.6`,
      `    - Vite 6.0`,
      `    - Naive UI`,
      `    - Xterm.js`,
      ``,
      `  Backend:`,
      `    - Tauri 2.0 (Rust)`,
      `    - tokio (async runtime)`,
      `    - portable-pty`,
      ``,
      `  Features:`,
      `    - Multi-platform (macOS, Windows, Linux)`,
      `    - Native performance`,
      `    - Small bundle size (~15MB)`,
      `    - AI task generation (Ollama, OpenAI, Claude)`,
      ``,
      `[Done] Process exited with code 0`,
    ]);

    const monibucaContent = computed(() => [
      `$ open https://monibuca.com`,
      ``,
      `Monibuca - ${t("website.monibuca.title")}`,
      ``,
      `${t("website.monibuca.desc")}`,
      ``,
      `${t("website.monibuca.features")}:`,
      `  - ${t("website.monibuca.feature1")}`,
      `  - ${t("website.monibuca.feature2")}`,
      `  - ${t("website.monibuca.feature3")}`,
      `  - ${t("website.monibuca.feature4")}`,
      ``,
      `Website: https://monibuca.com`,
      `GitHub: https://github.com/langhuihui/monibuca`,
      ``,
      `[Done] Process exited with code 0`,
    ]);

    const jessibucaContent = computed(() => [
      `$ open https://jessibuca.com`,
      ``,
      `Jessibuca - ${t("website.jessibuca.title")}`,
      ``,
      `${t("website.jessibuca.desc")}`,
      ``,
      `${t("website.jessibuca.features")}:`,
      `  - ${t("website.jessibuca.feature1")}`,
      `  - ${t("website.jessibuca.feature2")}`,
      `  - ${t("website.jessibuca.feature3")}`,
      `  - ${t("website.jessibuca.feature4")}`,
      ``,
      `Website: https://jessibuca.com`,
      `GitHub: https://github.com/langhuihui/jessibuca`,
      ``,
      `[Done] Process exited with code 0`,
    ]);

    const handleAddFolder = () => {
      message.success(t("website.demo.folderAdded"));
      showAddFolderDialog.value = false;
      addFolderForm.sourceFolder = "";
      addFolderForm.isImportMode = false;
    };

    const handleAddTask = () => {
      message.success(t("website.demo.taskAdded"));
      showTaskEditDialog.value = false;
      taskEditForm.name = "";
      taskEditForm.command = "";
      taskEditForm.cwd = "";
      taskEditForm.envStr = "";
      taskEditForm.useSystemTerminal = false;
    };

    const handleAIGenerate = async () => {
      if (!aiForm.prompt) {
        message.warning(t("website.demo.aiPromptRequired"));
        return;
      }

      aiForm.loading = true;
      aiForm.error = "";
      aiForm.result = null;

      await new Promise((r) => setTimeout(r, 1500));
      
      aiForm.result = {
        name: "Generated Task",
        command: "node",
        args: ["server.js"],
        cwd: "./src",
      };

      aiForm.loading = false;
      message.success(t("website.demo.aiGenerated"));
    };

    const openTab = async (
      id: string,
      name: string,
      type: "features" | "tech" | "monibuca" | "jessibuca" | "ports" | "settings"
    ) => {
      const existingTab = tabs.value.find((t) => t.id === id);
      if (existingTab) {
        activeTab.value = id;
        return;
      }

      const newTab: TabItem = {
        id,
        name,
        type,
        isTerminal: type !== "ports" && type !== "settings",
        isRunning: type !== "ports" && type !== "settings",
      };
      tabs.value.push(newTab);
      activeTab.value = id;

      // Wait for DOM update and initialize terminal if needed
      await nextTick();
      if (newTab.isTerminal) {
        initializeTerminal(newTab);
      }
    };
    
    // Open ports management tab
    const openPortsTab = () => {
      openTab("ports", t("task.portManagement"), "ports");
    };
    
    // Open settings tab
    const openSettingsTab = () => {
      openTab("settings", t("settings.title"), "settings");
    };

    const closeTab = (id: string) => {
      const tab = tabs.value.find((t) => t.id === id);
      if (tab) {
        // Dispose terminal
        if (tab.terminal) {
          tab.terminal.dispose();
        }
      }

      const index = tabs.value.findIndex((t) => t.id === id);
      if (index !== -1) {
        tabs.value.splice(index, 1);
        if (activeTab.value === id) {
          activeTab.value =
            tabs.value.length > 0 ? tabs.value[tabs.value.length - 1].id : null;
        }
      }
    };

    const stopTab = (id: string) => {
      const tab = tabs.value.find((t) => t.id === id);
      if (tab) {
        tab.isRunning = false;
        if (tab.terminal) {
          tab.terminal.writeln(
            "\r\n\x1b[32m[Process completed with exit code 0]\x1b[0m"
          );
        }
      }
    };

    const initializeTerminal = (tab: TabItem) => {
      const container = terminalRefs.value[tab.id];
      if (!container) return;

      // Create terminal instance
      const terminal = new Terminal({
        theme: {
          background: "#0d0d0f",
          foreground: "#c0c0c0",
          cursor: "#00d084",
          cursorAccent: "#0d0d0f",
          selectionBackground: "rgba(0, 208, 132, 0.3)",
          black: "#000000",
          red: "#ff5555",
          green: "#50fa7b",
          yellow: "#f1fa8c",
          blue: "#bd93f9",
          magenta: "#ff79c6",
          cyan: "#8be9fd",
          white: "#bbbbbb",
          brightBlack: "#555555",
          brightRed: "#ff6e6e",
          brightGreen: "#69ff94",
          brightYellow: "#ffffa5",
          brightBlue: "#d6acff",
          brightMagenta: "#ff92df",
          brightCyan: "#a4ffff",
          brightWhite: "#ffffff",
        },
        fontFamily: '"SF Mono", Monaco, Menlo, "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        cursorStyle: "block",
        scrollback: 1000,
        allowTransparency: true,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      terminal.open(container);
      fitAddon.fit();

      tab.terminal = terminal;
      tab.fitAddon = fitAddon;

      // Type out content with animation
      if (tab.type === "features" || tab.type === "tech" || tab.type === "monibuca" || tab.type === "jessibuca") {
        typeTerminalContent(terminal, getTabContent(tab.type), () => {
          tab.isRunning = false;
        });
      }
    };

    const typeTerminalContent = async (
      terminal: Terminal,
      lines: string[],
      onComplete?: () => void
    ) => {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Command lines (starting with $) type faster
        if (line.startsWith("$")) {
          terminal.write("\x1b[36m"); // Cyan color
          await typeText(terminal, line, 30);
          terminal.write("\x1b[0m"); // Reset color
        }
        // Done messages in green
        else if (
          line.startsWith("[Done]") ||
          line.startsWith("[Process completed]")
        ) {
          terminal.write("\x1b[32m"); // Green color
          await typeText(terminal, line, 20);
          terminal.write("\x1b[0m"); // Reset color
        }
        // Normal lines
        else {
          await typeText(terminal, line, 15);
        }

        terminal.write("\r\n");

        // Small delay between lines
        await new Promise((r) => setTimeout(r, 50));
      }

      if (onComplete) {
        onComplete();
      }
    };

    const typeText = async (
      terminal: Terminal,
      text: string,
      speed: number
    ) => {
      for (const char of text) {
        terminal.write(char);
        await new Promise((r) => setTimeout(r, speed));
      }
    };

    // Get tab content dynamically based on type
    const getTabContent = (
      type: "features" | "tech" | "monibuca" | "jessibuca"
    ) => {
      switch (type) {
        case "features":
          return featuresContent.value;
        case "tech":
          return techContent.value;
        case "monibuca":
          return monibucaContent.value;
        case "jessibuca":
          return jessibucaContent.value;
      }
    };

    const runDemoTask = async (task: DemoTask) => {
      if (runningTaskId.value) {
        message.warning(t("website.demo.taskRunning"));
        return;
      }

      runningTaskId.value = task.id;

      // Simulate task preparation
      await new Promise((r) => setTimeout(r, 500));

      if (task.action === "features") {
        await openTab("features", t("website.tasks.viewFeatures"), "features");
      } else if (task.action === "tech") {
        await openTab("tech", t("website.tasks.viewTech"), "tech");
      } else if (task.action === "monibuca") {
        await openTab("monibuca", "Monibuca", "monibuca");
      } else if (task.action === "jessibuca") {
        await openTab("jessibuca", "Jessibuca", "jessibuca");
      } else if (task.action === "run") {
        // Simulate npm script running
        await new Promise((r) => setTimeout(r, 1000));
        message.success(`${task.name} ${t("website.demo.completed")}`);
      }

      runningTaskId.value = null;
    };

    // Render terminal container
    const renderTerminalContainer = (tabId: string) => {
      return h("div", {
        class: "terminal-container",
        ref: (el) => {
          if (el) {
            terminalRefs.value[tabId] = el as HTMLDivElement;
          }
        },
      });
    };
    
    // Render ports management content
    const renderPortsContent = () => {
      return h("div", { class: "ports-panel", style: "padding: 24px; height: 100%; display: flex; flex-direction: column;" }, [
        // Filter and Refresh
        h("div", { class: "port-filter" }, [
          h(NInput, {
            value: portFilter.value,
            "onUpdate:value": (v: string) => (portFilter.value = v),
            placeholder: t("task.portFilter"),
            clearable: true,
          }),
          h(
            NButton,
            { type: "primary", onClick: handleRefreshPorts },
            () => t("task.refreshPorts")
          ),
        ]),
        // Port List
        filteredPortProcesses.value.length > 0
          ? h("div", { class: "port-list" }, [
              h("div", { class: "port-header" }, [
                h("span", { class: "name-col" }, t("task.processName")),
                h("span", { class: "pid-col" }, t("task.pid")),
                h("span", { class: "port-col" }, t("task.port")),
                h("span", { class: "action-col" }),
              ]),
              ...filteredPortProcesses.value.map((proc) =>
                h("div", { key: proc.pid, class: "port-item" }, [
                  h("span", { class: "name-col", title: proc.command }, proc.name),
                  h("span", { class: "pid-col" }, proc.pid),
                  h(
                    "span",
                    { class: "port-col port-numbers" },
                    proc.ports.map((port) =>
                      h(
                        NTag,
                        { key: port, size: "small", type: "info", class: "port-tag" },
                        () => port
                      )
                    )
                  ),
                  h("span", { class: "action-col" }, [
                    h(
                      NButton,
                      {
                        size: "small",
                        type: "error",
                        quaternary: true,
                        onClick: () => handleKillProcess(proc.pid),
                      },
                      () => t("task.killProcess")
                    ),
                  ]),
                ])
              ),
            ])
          : h("div", { class: "no-ports" }, [
              h("p", null, t("task.noPortsFound")),
            ]),
      ]);
    };
    
    // Render settings content
    const renderSettingsContent = () => {
      // Demo settings data
      const demoSettings = reactive({
        language: currentLang.value === "zh-CN" ? "zh-CN" : "en",
        confirmBeforeClose: true,
        closeButtonBehavior: "exit" as "exit" | "hide",
        showTaskIcons: true,
        recentTasksCount: 5,
        preferredTerminal: "Terminal.app",
        preferredShell: "/bin/zsh",
        saveLogs: true,
        maxLogFiles: 100,
        commandIcons: {
          npm: "npm",
          "go build": "go",
          cargo: "rust",
          python: "python",
          "node": "nodejs",
          "yarn": "yarn",
          "pnpm": "pnpm",
          "docker": "docker",
          "docker-compose": "docker",
          "kubectl": "kubernetes",
          "terraform": "terraform",
          "ansible": "ansible",
          "make": "make",
          "cmake": "cmake",
          "gradle": "gradle",
          "maven": "maven",
          "gcc": "c",
          "g++": "cpp",
          "javac": "java",
          "tsc": "typescript",
          "eslint": "eslint",
          "prettier": "prettier",
          "jest": "jest",
          "vitest": "vitest",
        } as Record<string, string>,
      });
      
      // Demo data for other tabs
      const currentVersion = ref("0.3.1");
      const updateChecked = ref(false);
      const updateAvailable = ref(false);
      const checkingUpdate = ref(false);
      const releaseNotes = ref([
        {
          tag: "v0.3.1",
          date: "2025-01-07",
          body: "✨ 新增端口管理功能\n✨ 新增设置标签页\n✨ 增强终端交互体验\n🐛 修复多个已知问题\n🔧 性能优化",
        },
        {
          tag: "v0.3.0",
          date: "2025-01-01",
          body: "🎉 首个正式版本发布\n✨ 支持多平台（macOS、Windows、Linux）\n✨ 支持任务管理\n✨ 支持 AI 任务生成\n✨ 支持端口管理\n✨ 支持命令图标自定义",
        },
        {
          tag: "v0.2.2",
          date: "2024-12-25",
          body: "✨ 新增 AI 工具集成\n✨ 新增开发日志查看器\n✨ 改进设置界面\n🐛 修复终端输出问题\n🔧 优化内存使用",
        },
        {
          tag: "v0.2.1",
          date: "2024-12-15",
          body: "✨ 新增任务分组功能\n✨ 新增最近运行任务\n✨ 支持 VS Code 任务导入\n🐛 修复文件路径问题\n🔧 改进错误处理",
        },
        {
          tag: "v0.2.0",
          date: "2024-12-01",
          body: "✨ 新增多标签页支持\n✨ 新增历史记录功能\n✨ 新增任务搜索功能\n✨ 改进 UI 设计\n🐛 修复多个 bug",
        },
        {
          tag: "v0.1.0",
          date: "2024-11-15",
          body: "🎉 首个 Beta 版本\n✨ 基础任务管理功能\n✨ 终端集成\n✨ 配置文件支持\n✨ 明暗主题切换",
        },
      ]);
      const loadingReleaseNotes = ref(false);
      
      const consoleLogs = ref([
        { timestamp: Date.now() - 1000, level: "info", source: "App", message: "Application started" },
        { timestamp: Date.now() - 2000, level: "debug", source: "Store", message: "Settings loaded" },
        { timestamp: Date.now() - 3000, level: "warn", source: "Adapter", message: "Mock adapter initialized" },
        { timestamp: Date.now() - 4000, level: "info", source: "TaskManager", message: "Initialized task manager" },
        { timestamp: Date.now() - 5000, level: "debug", source: "Terminal", message: "Terminal service ready" },
        { timestamp: Date.now() - 6000, level: "info", source: "UI", message: "Theme applied: dark" },
        { timestamp: Date.now() - 7000, level: "debug", source: "I18n", message: "Locale set to: zh-CN" },
        { timestamp: Date.now() - 8000, level: "info", source: "PortManager", message: "Port manager initialized" },
        { timestamp: Date.now() - 9000, level: "warn", source: "Updater", message: "Update check skipped in demo mode" },
        { timestamp: Date.now() - 10000, level: "debug", source: "Storage", message: "Local storage initialized" },
        { timestamp: Date.now() - 11000, level: "info", source: "App", message: "All services initialized successfully" },
        { timestamp: Date.now() - 12000, level: "error", source: "Network", message: "Failed to fetch update info (demo mode)" },
        { timestamp: Date.now() - 13000, level: "debug", source: "Renderer", message: "Component tree rendered" },
        { timestamp: Date.now() - 14000, level: "info", source: "EventBus", message: "Event bus ready" },
        { timestamp: Date.now() - 15000, level: "debug", source: "Cache", message: "Cache cleared" },
        { timestamp: Date.now() - 16000, level: "warn", source: "Performance", message: "Large bundle detected, consider code splitting" },
        { timestamp: Date.now() - 17000, level: "info", source: "App", message: "Ready for user interaction" },
      ]);
      const selectedLevels = ref(["debug", "info", "warn", "error"]);
      const searchText = ref("");
      const autoScroll = ref(true);
      
      const languageOptions = computed(() => [
        { label: "中文", value: "zh-CN" },
        { label: "English", value: "en" },
      ]);
      
      const terminalOptions = computed(() => [
        { label: `Terminal.app (${t("settings.default")})`, value: "Terminal.app" },
        { label: "iTerm2", value: "iTerm2" },
        { label: "Alacritty", value: "Alacritty" },
      ]);
      
      const shellOptions = computed(() => [
        { label: `/bin/zsh (${t("settings.default")})`, value: "/bin/zsh" },
        { label: "/bin/bash", value: "/bin/bash" },
        { label: "/bin/fish", value: "/bin/fish" },
      ]);
      
      // Command icons table data
      const commandIconsTableData = computed(() =>
        Object.entries(demoSettings.commandIcons).map(([command, icon]) => ({
          command,
          icon,
        }))
      );
      
      const commandIconsColumns = [
        {
          title: t("settings.command"),
          key: "command",
        },
        {
          title: t("settings.icon"),
          key: "icon",
          render: (row: { icon: string }) => h("span", { class: "icon-name" }, row.icon),
        },
      ];
      
      const newCommand = ref("");
      const newIcon = ref("task");
      
      const filteredConsoleLogs = computed(() => {
        return consoleLogs.value.filter(
          (log) =>
            selectedLevels.value.includes(log.level) &&
            (searchText.value === "" || log.message.toLowerCase().includes(searchText.value.toLowerCase()))
        );
      });
      
      return h("div", { class: "settings-panel", style: "padding: 0; height: 100%;" }, [
        h(NTabs, { type: "line", animated: true, style: "height: 100%; display: flex; flex-direction: column;" }, {
          default: () => [
            // General Tab
            h(NTabPane, { name: "general", tab: t("settings.general") }, {
              default: () =>
                h(NForm, { labelPlacement: "left", labelWidth: "auto", class: "compact-settings-form" }, {
                  default: () => [
                    h(NFormItem, { label: t("settings.language") }, {
                      default: () =>
                        h(NRadioGroup, {
                          value: demoSettings.language,
                          "onUpdate:value": (v: string) => {
                            demoSettings.language = v;
                            message.info(t("website.demo.settingsSaved"));
                          },
                        }, {
                          default: () =>
                            languageOptions.value.map((opt) =>
                              h(NRadio, { key: opt.value, value: opt.value }, () => opt.label)
                            ),
                        }),
                    }),
                    h(NFormItem, { label: t("settings.confirmBeforeClose") }, {
                      default: () =>
                        h(NSwitch, {
                          value: demoSettings.confirmBeforeClose,
                          "onUpdate:value": (v: boolean) => {
                            demoSettings.confirmBeforeClose = v;
                            message.info(t("website.demo.settingsSaved"));
                          },
                        }),
                    }),
                    h(NFormItem, { label: t("settings.closeButtonBehavior") }, {
                      default: () =>
                        h(NRadioGroup, {
                          value: demoSettings.closeButtonBehavior,
                          "onUpdate:value": (v: "exit" | "hide") => {
                            demoSettings.closeButtonBehavior = v;
                            message.info(t("website.demo.settingsSaved"));
                          },
                        }, {
                          default: () => [
                            h(NRadio, { value: "exit" }, () => t("settings.closeButtonExit")),
                            h(NRadio, { value: "hide" }, () => t("settings.closeButtonHide")),
                          ],
                        }),
                    }),
                    h(NFormItem, { label: t("settings.showTaskIcons") }, {
                      default: () =>
                        h(NSwitch, {
                          value: demoSettings.showTaskIcons,
                          "onUpdate:value": (v: boolean) => {
                            demoSettings.showTaskIcons = v;
                            message.info(t("website.demo.settingsSaved"));
                          },
                        }),
                    }),
                    h(NFormItem, { label: t("settings.recentTasksCount") }, {
                      default: () =>
                        h("div", { style: "display: flex; align-items: center; gap: 8px;" }, [
                          h(NInputNumber, {
                            value: demoSettings.recentTasksCount,
                            "onUpdate:value": (v: number | null) => {
                              if (v !== null) {
                                demoSettings.recentTasksCount = v;
                                message.info(t("website.demo.settingsSaved"));
                              }
                            },
                            min: 0,
                            max: 20,
                            style: "width: 120px;",
                          }),
                          h("span", { class: "setting-hint" }, t("settings.recentTasksCountHint")),
                        ]),
                    }),
                    h(NFormItem, { label: t("settings.preferredTerminal") }, {
                      default: () =>
                        h("div", { style: "display: flex; flex-direction: column; gap: 4px;" }, [
                          h(NSelect, {
                            value: demoSettings.preferredTerminal,
                            "onUpdate:value": (v: string) => {
                              demoSettings.preferredTerminal = v;
                              message.info(t("website.demo.settingsSaved"));
                            },
                            options: terminalOptions.value,
                            placeholder: t("settings.preferredTerminalPlaceholder"),
                            clearable: true,
                            style: "width: 250px;",
                          }),
                          h("span", { class: "setting-hint" }, t("settings.preferredTerminalHint")),
                        ]),
                    }),
                    h(NFormItem, { label: t("settings.preferredShell") }, {
                      default: () =>
                        h("div", { style: "display: flex; flex-direction: column; gap: 4px;" }, [
                          h(NSelect, {
                            value: demoSettings.preferredShell,
                            "onUpdate:value": (v: string) => {
                              demoSettings.preferredShell = v;
                              message.info(t("website.demo.settingsSaved"));
                            },
                            options: shellOptions.value,
                            placeholder: t("settings.preferredShellPlaceholder"),
                            clearable: true,
                            style: "width: 250px;",
                          }),
                          h("span", { class: "setting-hint" }, t("settings.preferredShellHint")),
                        ]),
                    }),
                  ],
                }),
            }),
            // Logs Tab
            h(NTabPane, { name: "logs", tab: t("settings.logs") }, {
              default: () =>
                h(NForm, { labelPlacement: "left", labelWidth: "auto", class: "compact-settings-form" }, {
                  default: () => [
                    h(NFormItem, { label: t("settings.saveLogs") }, {
                      default: () =>
                        h(NSwitch, {
                          value: demoSettings.saveLogs,
                          "onUpdate:value": (v: boolean) => {
                            demoSettings.saveLogs = v;
                            message.info(t("website.demo.settingsSaved"));
                          },
                        }),
                    }),
                    h(NFormItem, { label: t("settings.maxLogFiles") }, {
                      default: () =>
                        h(NInputNumber, {
                          value: demoSettings.maxLogFiles,
                          "onUpdate:value": (v: number | null) => {
                            if (v !== null) {
                              demoSettings.maxLogFiles = v;
                              message.info(t("website.demo.settingsSaved"));
                            }
                          },
                          min: 10,
                          max: 1000,
                          style: "width: 120px;",
                        }),
                    }),
                    h(NFormItem, { label: t("history.openLogsFolder") }, {
                      default: () =>
                        h(NButton, {
                          size: "small",
                          onClick: () => {
                            message.info(t("website.demo.folderHint"));
                          },
                        }, {
                          icon: () => h(NIcon, null, () => h(FolderOpenOutline)),
                          default: () => t("history.openLogsFolder"),
                        }),
                    }),
                  ],
                }),
            }),
            // Icons Tab
            h(NTabPane, { name: "icons", tab: t("settings.commandIcons") }, {
              default: () =>
                h("div", { class: "command-icon-settings" }, [
                  h(NDataTable, {
                    columns: commandIconsColumns,
                    data: commandIconsTableData.value,
                    size: "small",
                    bordered: false,
                    maxHeight: 280,
                  }),
                  h("div", { class: "add-mapping", style: "display: flex; gap: 8px; margin-top: 12px; align-items: center;" }, [
                    h(NInput, {
                      value: newCommand.value,
                      "onUpdate:value": (v: string) => (newCommand.value = v),
                      placeholder: t("settings.commandPlaceholder"),
                      size: "small",
                      style: "flex: 1;",
                    }),
                    h(NButton, {
                      size: "small",
                      type: "primary",
                      disabled: !newCommand.value.trim(),
                      onClick: () => {
                        if (newCommand.value.trim()) {
                          demoSettings.commandIcons[newCommand.value] = newIcon.value;
                          newCommand.value = "";
                          message.success(t("website.demo.settingsSaved"));
                        }
                      },
                    }, () => t("common.add")),
                  ]),
                  h("div", { class: "help-text", style: "margin-top: 12px; font-size: 12px; color: rgba(255,255,255,0.5);" }, t("settings.commandIconHelp")),
                ]),
            }),
            // Update Tab
            h(NTabPane, { name: "update", tab: t("settings.update") }, {
              default: () =>
                h("div", { class: "update-section" }, [
                  h(NSpace, { vertical: true, size: "large" }, {
                    default: () => [
                      h(NSpace, { align: "center" }, {
                        default: () => [
                          h("span", null, `${t("settings.currentVersion")}: ${currentVersion.value}`),
                          h(NButton, {
                            size: "small",
                            loading: checkingUpdate.value,
                            onClick: async () => {
                              checkingUpdate.value = true;
                              await new Promise((r) => setTimeout(r, 1500));
                              checkingUpdate.value = false;
                              updateChecked.value = true;
                              updateAvailable.value = false;
                              message.info(t("settings.noUpdate"));
                            },
                          }, () => t("settings.checkUpdate")),
                        ],
                      }),
                      updateAvailable.value
                        ? h(NAlert, { type: "success" }, {
                          header: () => `${t("settings.updateAvailable")}: v0.3.2`,
                          default: () => [
                            h("div", { class: "update-notes" }, "新版本包含重要更新和bug修复"),
                            h(NSpace, { style: "margin-top: 12px;" }, {
                              default: () => [
                                h(NButton, { type: "primary", size: "small" }, () => t("settings.downloadAndInstall")),
                              ],
                            }),
                          ],
                        })
                        : updateChecked.value && !updateAvailable.value
                        ? h(NAlert, { type: "info" }, () => t("settings.noUpdate"))
                        : null,
                      h(NDivider, { titlePlacement: "left" }, () => t("settings.releaseNotes")),
                      h("div", { class: "release-notes-section" }, [
                        h(NSpin, { show: loadingReleaseNotes.value }, {
                          default: () =>
                            releaseNotes.value.length > 0
                              ? h("div", { class: "release-notes-content" }, [
                                  ...releaseNotes.value.map((release) =>
                                    h("div", { key: release.tag, class: "release-item" }, [
                                      h("div", { class: "release-header" }, [
                                        h("span", { class: "release-tag" }, release.tag),
                                        h("span", { class: "release-date" }, release.date),
                                      ]),
                                      h("div", { class: "release-body" }, release.body),
                                    ])
                                  ),
                                ])
                              : h("div", { class: "no-release-notes" }, [
                                  h(NButton, {
                                    size: "small",
                                    onClick: () => {
                                      loadingReleaseNotes.value = true;
                                      setTimeout(() => {
                                        loadingReleaseNotes.value = false;
                                      }, 1000);
                                    },
                                  }, () => t("settings.loadReleaseNotes")),
                                ]),
                        }),
                      ]),
                    ],
                  }),
                ]),
            }),
            // DevLog Tab
            h(NTabPane, { name: "devlog", tab: t("settings.devLog") }, {
              default: () =>
                h("div", { class: "dev-log-viewer" }, [
                  h(NTabs, { type: "line", animated: true, style: "height: 100%; display: flex; flex-direction: column;" }, {
                    default: () => [
                      h(NTabPane, { name: "console", tab: t("devLog.consoleLogs") }, {
                        default: () =>
                          h("div", null, [
                            h("div", { class: "log-toolbar", style: "display: flex; justify-content: space-between; margin-bottom: 12px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;" }, [
                              h(NSpace, null, {
                                default: () => [
                                  h(NCheckboxGroup, { value: selectedLevels.value, "onUpdate:value": (v: (string | number)[]) => (selectedLevels.value = v as string[]), size: "small" }, {
                                    default: () => [
                                      h(NCheckbox, { value: "debug" }, () => "Debug"),
                                      h(NCheckbox, { value: "info" }, () => "Info"),
                                      h(NCheckbox, { value: "warn" }, () => "Warn"),
                                      h(NCheckbox, { value: "error" }, () => "Error"),
                                    ],
                                  }),
                                  h(NInput, {
                                    value: searchText.value,
                                    "onUpdate:value": (v: string) => (searchText.value = v),
                                    placeholder: t("devLog.search"),
                                    size: "small",
                                    clearable: true,
                                    style: "width: 200px;",
                                  }),
                                ],
                              }),
                              h(NSpace, null, {
                                default: () => [
                                  h(NButton, { size: "small", onClick: () => message.info(t("devLog.refresh")) }, () => t("devLog.refresh")),
                                  h(NButton, { size: "small", onClick: () => message.info(t("devLog.export")) }, () => t("devLog.export")),
                                  h(NButton, { size: "small", type: "error", onClick: () => { consoleLogs.value = []; message.info(t("devLog.clear")); } }, () => t("devLog.clear")),
                                  h(NButton, { size: "small", type: autoScroll.value ? "primary" : "default", onClick: () => (autoScroll.value = !autoScroll.value) }, () => autoScroll.value ? t("devLog.autoScrollOn") : t("devLog.autoScrollOff")),
                                ],
                              }),
                            ]),
                            h(NScrollbar, { style: "max-height: 400px;" }, {
                              default: () =>
                                h("div", { class: "log-entries" }, [
                                  ...filteredConsoleLogs.value.map((entry, index) =>
                                    h("div", { key: index, class: `log-entry log-${entry.level}` }, [
                                      h("span", { class: "log-time" }, new Date(entry.timestamp).toLocaleTimeString()),
                                      h("span", { class: `log-level level-${entry.level}` }, entry.level.toUpperCase()),
                                      h("span", { class: "log-source" }, entry.source),
                                      h("span", { class: "log-message" }, entry.message),
                                    ])
                                  ),
                                  filteredConsoleLogs.value.length === 0
                                    ? h("div", { class: "no-logs" }, t("devLog.noLogs"))
                                    : null,
                                ]),
                            }),
                          ]),
                      }),
                      h(NTabPane, { name: "tauri", tab: t("devLog.tauriLogs") }, {
                        default: () =>
                          h("div", null, [
                            h("div", { class: "log-toolbar", style: "display: flex; justify-content: space-between; margin-bottom: 12px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;" }, [
                              h(NSpace, null, {
                                default: () => [
                                  h(NSelect, {
                                    placeholder: t("devLog.selectLogFile"),
                                    size: "small",
                                    style: "width: 300px;",
                                    options: [
                                      { label: "tauri.log", value: "tauri.log" },
                                      { label: "app.log", value: "app.log" },
                                    ],
                                  }),
                                ],
                              }),
                              h(NSpace, null, {
                                default: () => [
                                  h(NButton, { size: "small", onClick: () => message.info(t("devLog.refresh")) }, () => t("devLog.refresh")),
                                  h(NButton, { size: "small", onClick: () => message.info(t("website.demo.folderHint")) }, () => t("devLog.openFolder")),
                                ],
                              }),
                            ]),
                            h(NScrollbar, { style: "max-height: 400px;" }, {
                              default: () =>
                                h("pre", { class: "log-content", style: "font-family: monospace; font-size: 12px; padding: 8px; color: rgba(255,255,255,0.7);" }, t("devLog.selectFileToView")),
                            }),
                          ]),
                      }),
                    ],
                  }),
                ]),
            }),
            // AITools Tab
            h(NTabPane, { name: "aitools", tab: t("settings.aiTools") }, {
              default: () => {
                // Demo AI tools data
                const activeToolTab = ref("claude-code");
                const toolVersions = ref({
                  "claude-code": "1.2.3",
                  "codex": null,
                  "gemini-cli": "2.1.0",
                  "opencode": null,
                  "codebuddy": "0.9.5",
                  "qoder-cli": null,
                  "copilot-cli": "1.0.0",
                  "droid": null,
                  "augment-cli": "0.8.2",
                });
                const toolConfigs = ref({
                  "claude-code": { provider: "ollama", apiKey: "", customEndpoint: "" },
                  "codex": { provider: "original", apiKey: "", customEndpoint: "" },
                  "gemini-cli": { provider: "openai", apiKey: "sk-***", customEndpoint: "" },
                  "opencode": { provider: "original", apiKey: "", customEndpoint: "" },
                  "codebuddy": { provider: "custom", apiKey: "", customEndpoint: "https://api.codebuddy.ai" },
                  "qoder-cli": { provider: "original", apiKey: "", customEndpoint: "" },
                  "copilot-cli": { provider: "original", apiKey: "", customEndpoint: "" },
                  "droid": { provider: "original", apiKey: "", customEndpoint: "" },
                  "augment-cli": { provider: "anthropic", apiKey: "sk-ant-***", customEndpoint: "" },
                });
                
                const aiTools = [
                  { id: "claude-code", name: "Claude Code", website: "https://github.com/anthropics/claude-code" },
                  { id: "codex", name: "OpenAI Codex", website: "https://github.com/openai/codex" },
                  { id: "gemini-cli", name: "Google Gemini CLI", website: "https://github.com/google-gemini/gemini-cli" },
                  { id: "opencode", name: "OpenCode", website: "https://github.com/opencode-ai/opencode" },
                  { id: "codebuddy", name: "CodeBuddy", website: "https://github.com/codebuddy-ai/codebuddy" },
                  { id: "qoder-cli", name: "Qoder CLI", website: "https://qoder.com/cli" },
                  { id: "copilot-cli", name: "GitHub Copilot CLI", website: "https://github.com/github/copilot-cli" },
                  { id: "droid", name: "Droid", website: "https://github.com/droid-ai/droid" },
                  { id: "augment-cli", name: "Augment CLI", website: "https://github.com/augment-ai/augment-cli" },
                ];
                
                const providerOptions = [
                  { label: "原厂模式", value: "original" },
                  { label: "Ollama", value: "ollama" },
                  { label: "OpenAI", value: "openai" },
                  { label: "Anthropic", value: "anthropic" },
                  { label: "GLM (智谱AI)", value: "glm" },
                  { label: "Kimi (月之暗面)", value: "kimi" },
                  { label: "Doubao (豆包)", value: "doubao" },
                  { label: "MiniMax", value: "minimax" },
                  { label: "DeepSeek", value: "deepseek" },
                  { label: "自定义", value: "custom" },
                ];
                
                const currentTool = computed(() => aiTools.find(t => t.id === activeToolTab.value)!);
                const currentConfig = computed(() => toolConfigs.value[activeToolTab.value as keyof typeof toolConfigs.value]);
                const currentVersion = computed(() => toolVersions.value[activeToolTab.value as keyof typeof toolVersions.value]);
                
                return h("div", { class: "ai-tools-panel" }, [
                  h("div", { class: "ai-tools-layout", style: "display: flex; gap: 16px; height: 100%;" }, [
                    h("div", { class: "tools-sidebar", style: "width: 180px; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 16px; overflow-y: auto;" }, [
                      ...aiTools.map((tool) =>
                        h("div", {
                          key: tool.id,
                          class: "tool-tab-item",
                          style: {
                            padding: "10px 12px",
                            cursor: "pointer",
                            borderRadius: "4px",
                            marginBottom: "4px",
                            background: activeToolTab.value === tool.id ? "rgba(36,200,219,0.2)" : "transparent",
                            color: activeToolTab.value === tool.id ? "#24c8db" : "rgba(255,255,255,0.7)",
                            transition: "all 0.2s",
                          },
                          onClick: () => (activeToolTab.value = tool.id),
                        }, [
                          h("div", { style: "display: flex; align-items: center; gap: 8px; font-weight: 500; margin-bottom: 4px;" }, [
                            (() => {
                              const logoUrls: Record<string, string | undefined> = {
                                "claude-code": "/ai-tools-logos/claude-code.svg",
                                "codex": "/ai-tools-logos/codex.png",
                                "gemini-cli": "/ai-tools-logos/gemini-cli.webp",
                                "opencode": "/ai-tools-logos/opencode.jpg",
                                "codebuddy": "/ai-tools-logos/codebuddy.jpeg",
                                "qoder-cli": "/ai-tools-logos/qoder.png",
                                "copilot-cli": "/ai-tools-logos/copilot-cli.png",
                                "droid": "/ai-tools-logos/droid.ico",
                                "augment-cli": "/ai-tools-logos/augment-cli.ico",
                                "cursor-cli": "/ai-tools-logos/cursor-cli.ico",
                                "crush": "/ai-tools-logos/crush.svg",
                              };
                              const logoUrl = logoUrls[tool.id];
                              if (logoUrl) {
                                return h("img", {
                                  src: logoUrl,
                                  alt: tool.name,
                                  style: "width: 16px; height: 16px; object-fit: contain; flex-shrink: 0;",
                                  onError: (e: Event) => {
                                    const img = e.target as HTMLImageElement;
                                    if (img) img.style.display = "none";
                                  },
                                });
                              }
                              return null;
                            })(),
                            h("span", tool.name),
                          ]),
                          h("div", { style: "font-size: 11px; opacity: 0.6;" }, toolVersions.value[tool.id as keyof typeof toolVersions.value] ? `v${toolVersions.value[tool.id as keyof typeof toolVersions.value]}` : t("aiTools.notInstalled")),
                        ])
                      ),
                    ]),
                    h("div", { class: "tools-content", style: "flex: 1; overflow-y: auto; padding-right: 8px;" }, [
                      h("div", { class: "tool-panel" }, [
                        h("div", { class: "tool-status", style: "display: flex; align-items: center; gap: 8px; margin-bottom: 12px;" }, [
                          currentVersion.value
                            ? h(NTag, { type: "success", size: "small" }, () => `v${currentVersion.value}`)
                            : h(NTag, { type: "warning", size: "small" }, () => t("aiTools.notInstalled")),
                          h(NButton, {
                            text: true,
                            size: "tiny",
                            onClick: () => message.info(t("aiTools.recheckInstall")),
                          }, {
                            icon: () => h(NIcon, { size: 14 }, () => h(SyncOutline)),
                          }),
                        ]),
                        h("div", { class: "tool-info", style: "margin-bottom: 16px;" }, [
                          h("span", {
                            class: "website-link",
                            style: "color: #24c8db; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px;",
                            onClick: () => message.info(t("website.demo.folderHint")),
                          }, [
                            h(NIcon, { size: 12 }, () => h(AddOutline)),
                            currentTool.value.website,
                          ]),
                        ]),
                        h(NDivider, { style: "margin: 16px 0 12px 0;" }, () => t("aiTools.configuration")),
                        h(NSpace, { vertical: true, size: 12 }, {
                          default: () => [
                            h(NFormItem, { label: t("aiTools.provider"), labelPlacement: "left", labelWidth: 100 }, {
                              default: () =>
                                h(NSelect, {
                                  value: currentConfig.value.provider,
                                  "onUpdate:value": (v: string) => {
                                    currentConfig.value.provider = v;
                                    message.info(t("website.demo.settingsSaved"));
                                  },
                                  options: providerOptions,
                                  size: "small",
                                  style: "width: 200px;",
                                }),
                            }),
                            currentConfig.value.provider !== "original" && h(NFormItem, { label: t("aiTools.apiKey"), labelPlacement: "left", labelWidth: 100 }, {
                              default: () =>
                                h(NInputGroup, null, {
                                  default: () => [
                                    h(NInput, {
                                      value: currentConfig.value.apiKey,
                                      "onUpdate:value": (v: string) => {
                                        currentConfig.value.apiKey = v;
                                      },
                                      type: "password",
                                      showPasswordOn: "click",
                                      placeholder: t("aiTools.apiKeyPlaceholder"),
                                      size: "small",
                                      style: "width: 200px;",
                                    }),
                                    h(NButton, {
                                      size: "small",
                                      onClick: () => message.info(t("website.demo.folderHint")),
                                    }, () => t("aiTools.getKey")),
                                  ],
                                }),
                            }),
                            currentConfig.value.provider === "custom" && h(NFormItem, { label: t("aiTools.customEndpoint"), labelPlacement: "left", labelWidth: 100 }, {
                              default: () =>
                                h(NInput, {
                                  value: currentConfig.value.customEndpoint,
                                  "onUpdate:value": (v: string) => {
                                    currentConfig.value.customEndpoint = v;
                                    message.info(t("website.demo.settingsSaved"));
                                  },
                                  placeholder: t("aiTools.customEndpointPlaceholder"),
                                  size: "small",
                                  style: "width: 250px;",
                                }),
                            }),
                            currentConfig.value.provider !== "original" && h(NAlert, {
                              type: "default",
                              bordered: false,
                              size: "small",
                            }, () => t("aiTools.keySyncNotice")),
                          ],
                        }),
                        !currentVersion.value && h("div", { class: "install-section", style: "margin-top: 24px;" }, [
                          h(NDivider, { style: "margin: 16px 0 12px 0;" }, () => t("aiTools.installOptions")),
                          h("div", { class: "install-command", style: "background: rgba(255,255,255,0.05); padding: 12px; border-radius: 4px; font-family: monospace; font-size: 12px; margin-bottom: 8px;" }, [
                            h("div", { style: "color: rgba(255,255,255,0.6); margin-bottom: 4px;" }, "NPM:"),
                            h("div", { style: "color: rgba(255,255,255,0.9);" }, `npm install -g @${currentTool.value.id.replace("-", "/")}`),
                          ]),
                          h(NButton, {
                            size: "small",
                            type: "primary",
                            onClick: () => message.info(t("website.demo.folderHint")),
                          }, () => t("aiTools.install")),
                        ]),
                      ]),
                    ]),
                  ]),
                ]);
              },
            }),
          ],
        }),
      ]);
    };

    return () =>
      h("div", { class: "website-app" }, [
      // Navbar
        h("header", { class: "website-navbar" }, [
          h("div", { class: "navbar-left" }, [
            h("img", {
              src: "/text.svg",
              alt: "Rebebuca",
              class: "navbar-text",
            }),
            h("span", { class: "navbar-version" }, props.currentVersion),
          ]),
          h("div", { class: "navbar-center" }, [
            h("span", { class: "navbar-title" }, t("website.hero.title")),
          ]),
          h("div", { class: "navbar-right" }, [
            h(
              NButton,
              {
                quaternary: true,
                size: "small",
                onClick: () => emit("toggle-lang"),
              },
              () => (props.currentLang === "zh-CN" ? "EN" : "中")
            ),
          ]),
      ]),
      
      // Main Content
        h("div", { class: "website-main" }, [
        // Sidebar
          h("aside", { class: "website-sidebar" }, [
            h("div", { class: "sidebar-header" }, [
              h("img", {
                src: "/logo-dark.svg",
                alt: "Rebebuca",
                class: "sidebar-logo",
              }),
              h("div", { class: "header-buttons" }, [
                h(
                  NTooltip,
                  { trigger: "hover" },
                  {
                    trigger: () =>
                      h(
                        NButton,
                        {
                          size: "small",
                          quaternary: true,
                          onClick: () => (showAddFolderDialog.value = true),
                        },
                        {
                          icon: () =>
                            h(NIcon, null, () => h(FolderOpenOutline)),
                        }
                      ),
                    default: () => t("task.addFolder"),
                  }
                ),
                h(
                  NTooltip,
                  { trigger: "hover" },
                  {
                    trigger: () =>
                      h(
                        NButton,
                        {
                          size: "small",
                          quaternary: true,
                          onClick: () => (showTaskEditDialog.value = true),
                        },
                        { icon: () => h(NIcon, null, () => h(AddOutline)) }
                      ),
                    default: () => t("task.addTask"),
                  }
                ),
                h(
                  NTooltip,
                  { trigger: "hover" },
                  {
                    trigger: () =>
                      h(
                        NButton,
                        {
                          size: "small",
                          quaternary: true,
                          onClick: () => (showAIDialog.value = true),
                        },
                        { icon: () => h(NIcon, null, () => h(SparklesOutline)) }
                      ),
                    default: () => t("task.aiGenerate"),
                  }
                ),
                h(
                  NTooltip,
                  { trigger: "hover" },
                  {
                    trigger: () =>
                      h(
                        NButton,
                        {
                          size: "small",
                          quaternary: true,
                          onClick: openPortsTab,
                        },
                        {
                          icon: () =>
                            h(NIcon, null, () => h(GitNetworkOutline)),
                        }
                      ),
                    default: () => t("task.portManagement"),
                  }
                ),
                h(NTooltip, { trigger: "hover" }, {
                  trigger: () =>
                    h(
                      NButton,
                      {
                        size: "small",
                        quaternary: true,
                        onClick: openSettingsTab,
                      },
                      {
                        icon: () =>
                          h(NIcon, null, () => h(SettingsOutline)),
                      }
                    ),
                  default: () => t("settings.title"),
                }),
              ]),
            ]),
            h("div", { class: "task-list" }, [
              // Favorites Section
              h("div", { class: "task-group" }, [
                h(
                  "div",
                  {
                    class: "group-header",
                    onClick: () => toggleGroup("favorites"),
                  },
                  [
                    h(NIcon, { class: "group-icon" }, () =>
                      expandedGroups.favorites
                        ? h(ChevronDownOutline)
                        : h(ChevronForwardOutline)
                    ),
                    h(NIcon, { class: "group-type-icon star" }, () =>
                      h(StarOutline)
                    ),
                    h("span", { class: "group-name" }, t("task.favorites")),
                    h(
                      "span",
                      { class: "group-count" },
                      favoriteTasks.value.length
                    ),
                  ]
                ),
                expandedGroups.favorites &&
                  h(
                    "div",
                    { class: "group-tasks" },
                    favoriteTasks.value.map((task) =>
                      h(
                        "div",
                        {
                  key: task.id,
                          class: [
                            "task-item",
                            { running: runningTaskId.value === task.id },
                          ],
                          onClick: () => runDemoTask(task),
                        },
                        [
                          h("span", { class: "task-icon" }, task.icon),
                          h("span", { class: "task-name" }, task.name),
                          runningTaskId.value === task.id &&
                            h(NIcon, { class: "task-spinner" }, () =>
                              h(SyncOutline)
                            ),
                        ]
                      )
                    )
                  ),
            ]),
            // Folder Section
              h("div", { class: "task-group" }, [
                h(
                  "div",
                  {
                    class: "group-header",
                    onClick: () => toggleGroup("folder"),
                  },
                  [
                    h(NIcon, { class: "group-icon" }, () =>
                      expandedGroups.folder
                        ? h(ChevronDownOutline)
                        : h(ChevronForwardOutline)
                    ),
                    h(NIcon, { class: "group-type-icon folder" }, () =>
                      h(FolderOutline)
                    ),
                    h("span", { class: "group-name" }, "~/projects/rebebuca"),
                  ]
                ),
                expandedGroups.folder &&
                  h("div", { class: "group-tasks" }, [
                    h(
                      "div",
                      {
                        class: "source-header",
                        onClick: () => toggleGroup("npm"),
                      },
                      [
                        h(NIcon, { class: "group-icon" }, () =>
                          expandedGroups.npm
                            ? h(ChevronDownOutline)
                            : h(ChevronForwardOutline)
                        ),
                        h("span", { class: "source-icon" }, "📦"),
                        h("span", { class: "source-name" }, "package.json"),
                        h(
                          "span",
                          { class: "group-count" },
                          npmTasks.value.length
                        ),
                      ]
                    ),
                    expandedGroups.npm &&
                      h(
                        "div",
                        { class: "source-tasks" },
                        npmTasks.value.map((task) =>
                          h(
                            "div",
                            {
                    key: task.id,
                              class: [
                                "task-item",
                                "source-task",
                                { running: runningTaskId.value === task.id },
                              ],
                              onClick: () => runDemoTask(task),
                            },
                            [
                              h("span", { class: "task-icon" }, task.icon),
                              h("span", { class: "task-name" }, task.name),
                              runningTaskId.value === task.id &&
                                h(NIcon, { class: "task-spinner" }, () =>
                                  h(SyncOutline)
                                ),
                            ]
                          )
                        )
                      ),
                  ]),
              ]),
            ]),
        ]),
        
        // Main Content Area
          h("main", { class: "website-content" }, [
          // Tabs bar
            tabs.value.length > 0 &&
              h(
                "div",
                { class: "tabs-bar" },
                tabs.value.map((tab) =>
                  h(
                    "div",
                    {
              key: tab.id,
                      class: [
                        "tab-item",
                        {
                          active: activeTab.value === tab.id,
                          running: tab.isRunning,
                        },
                      ],
                      onClick: () => (activeTab.value = tab.id),
                    },
                    [
                      tab.isRunning &&
                        h(NIcon, { class: "tab-spinner", size: 12 }, () =>
                          h(SyncOutline)
                        ),
                      h("span", { class: "tab-name" }, tab.name),
                      tab.isRunning &&
                        h(
                          "span",
                          {
                            class: "tab-stop",
                            onClick: (e: Event) => {
                              e.stopPropagation();
                              stopTab(tab.id);
                            },
                            title: "Stop",
                          },
                          h(NIcon, { size: 14 }, () => h(StopOutline))
                        ),
                      h(
                        "span",
                        {
                          class: "tab-close",
                          onClick: (e: Event) => {
                            e.stopPropagation();
                            closeTab(tab.id);
                          },
                          title: "Close",
                        },
                        "×"
                      ),
                    ]
                  )
                )
          ),
          
          // Tab content or Welcome screen
            activeTab.value && tabs.value.find((t) => t.id === activeTab.value)
              ? (() => {
                  const currentTab = tabs.value.find((t) => t.id === activeTab.value)!;
                  if (currentTab.type === "ports") {
                    return h("div", { class: "tab-content ports-content" }, [
                      renderPortsContent(),
                    ]);
                  } else if (currentTab.type === "settings") {
                    return h("div", { class: "tab-content settings-content" }, [
                      renderSettingsContent(),
                    ]);
                  } else {
                    return h("div", { class: "tab-content" }, [
                      renderTerminalContainer(activeTab.value),
                    ]);
                  }
                })()
              : h("div", { class: "welcome-container" }, [
                  h("div", { class: "welcome-content" }, [
                    h("img", {
                      src: "/logo-dark.svg",
                      alt: "Rebebuca",
                      class: "welcome-logo",
                    }),
                    h(
                      "h1",
                      { class: "welcome-title" },
                      t("website.hero.title")
                    ),
                    h(
                      "p",
                      { class: "welcome-subtitle" },
                      t("website.hero.subtitle")
                    ),
                  
                  // Download Section
                    h("div", { class: "download-section" }, [
                      h(
                        "h2",
                        { class: "download-title" },
                        t("website.download.title")
                      ),
                      h("div", { class: "download-buttons" }, [
                        h(
                          "a",
                          {
                            href: props.macosUrl || "#",
                            target: "_blank",
                            class: "download-btn macos",
                          },
                          [
                        h(NIcon, { size: 32 }, () => h(LogoApple)),
                            h("div", { class: "download-info" }, [
                              h(
                                "span",
                                { class: "download-platform" },
                                "macOS"
                              ),
                              h(
                                "span",
                                { class: "download-arch" },
                                "Apple Silicon / Intel"
                              ),
                            ]),
                          ]
                        ),
                        h(
                          "a",
                          {
                            href: props.windowsUrl || "#",
                            target: "_blank",
                            class: "download-btn windows",
                          },
                          [
                        h(NIcon, { size: 32 }, () => h(LogoWindows)),
                            h("div", { class: "download-info" }, [
                              h(
                                "span",
                                { class: "download-platform" },
                                "Windows"
                              ),
                              h("span", { class: "download-arch" }, "x64"),
                            ]),
                          ]
                        ),
                        h(
                          "a",
                          {
                            href: "#",
                            target: "_blank",
                            class: "download-btn linux",
                          },
                          [
                            h("svg", {
                              class: "linux-icon",
                              viewBox: "0 0 24 24",
                              fill: "currentColor",
                              innerHTML:
                                '<path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139z"/>',
                            }),
                            h("div", { class: "download-info" }, [
                              h(
                                "span",
                                { class: "download-platform" },
                                "Linux"
                              ),
                              h(
                                "span",
                                { class: "download-arch" },
                                "AppImage / deb"
                              ),
                            ]),
                          ]
                        ),
                      ]),
                      h("p", { class: "download-hint" }, [
                        t("website.download.note"),
                      ]),
                      h("div", { class: "security-warning" }, [
                        h(
                          "p",
                          null,
                          "⚠️ " + t("website.download.securityWarning")
                        ),
                        h("ul", null, [
                          h(
                            "li",
                            null,
                            "Windows: " + t("website.download.windowsWarning")
                          ),
                          h(
                            "li",
                            null,
                            "macOS: " + t("website.download.macosWarning")
                          ),
                        ]),
                      ]),
                    ]),
                  ]),
                ]),
          ]),
      ]),
      
      // Status Bar
        h("footer", { class: "website-statusbar" }, [
          h("div", { class: "statusbar-left" }, [
            h("span", { class: "status-item" }, [
            h(NIcon, null, () => h(CodeSlashOutline)),
              "Vue 3 + TypeScript + Tauri",
            ]),
          ]),
          h("div", { class: "statusbar-center" }, [
            h(
              "span",
              { class: "status-item demo-notice" },
              t("website.status.demoNotice")
            ),
          ]),
          h("div", { class: "statusbar-right" }, [
            h("span", { class: "status-item" }, "GPL-3.0"),
          ]),
      ]),
      
      // Add Folder Dialog
        h(
          NModal,
          {
        show: showAddFolderDialog.value, 
            "onUpdate:show": (v: boolean) => (showAddFolderDialog.value = v),
            preset: "dialog",
            title: t("task.addFolder"),
            style: "width: 520px;",
            positiveText: addFolderForm.isImportMode
              ? t("task.scanTasks")
              : t("common.confirm"),
            negativeText: t("common.cancel"),
            onPositiveClick: handleAddFolder,
          },
          {
            default: () =>
              h(NForm, { labelPlacement: "top" }, () => [
                h(NFormItem, { label: t("task.selectFolder") }, () =>
            h(NInputGroup, null, () => [
                    h(NInput, {
                      value: addFolderForm.sourceFolder,
                      "onUpdate:value": (v: string) =>
                        (addFolderForm.sourceFolder = v),
                      placeholder: t("task.selectSourceFolder"),
                      clearable: true,
                    }),
                    h(
                      NButton,
                      {
                        onClick: () => {
                          addFolderForm.sourceFolder = "/Users/demo/projects";
                          message.info(t("website.demo.folderHint"));
                        },
                      },
                      () => t("task.browse")
                    ),
                  ])
                ),
                h(NFormItem, { label: t("task.addFolderMode") }, () =>
                  h(
                    NRadioGroup,
                    {
                      value: addFolderForm.isImportMode,
                      "onUpdate:value": (v: boolean) =>
                        (addFolderForm.isImportMode = v),
                    },
                    () =>
              h(NSpace, { vertical: true }, () => [
                h(NRadio, { value: false }, () => 
                          h("div", { class: "mode-option" }, [
                            h(
                              "span",
                              { class: "mode-title" },
                              t("task.modeOpen")
                            ),
                            h(
                              "span",
                              { class: "mode-desc" },
                              t("task.modeOpenDesc")
                            ),
                  ])
                ),
                h(NRadio, { value: true }, () =>
                          h("div", { class: "mode-option" }, [
                            h(
                              "span",
                              { class: "mode-title" },
                              t("task.modeImport")
                            ),
                            h(
                              "span",
                              { class: "mode-desc" },
                              t("task.modeImportDesc")
                            ),
                          ])
                        ),
              ])
            )
          ),
                addFolderForm.isImportMode &&
                  h(NFormItem, { label: t("task.targetGroup") }, () =>
                    h(NSelect, {
                      value: addFolderForm.targetGroupId,
                      "onUpdate:value": (v: string) =>
                        (addFolderForm.targetGroupId = v),
                      options: groupOptions,
                    })
                  ),
                addFolderForm.isImportMode &&
                  addFolderForm.targetGroupId === "__new__" &&
                  h(NFormItem, { label: t("task.newGroupName") }, () =>
                    h(NInput, {
                      value: addFolderForm.newGroupName,
                      "onUpdate:value": (v: string) =>
                        (addFolderForm.newGroupName = v),
                      placeholder: t("task.newGroupPlaceholder"),
                    })
                  ),
              ]),
          }
        ),
      
      // Task Edit Dialog (matches real TaskEditDialog)
        h(
          NModal,
          {
        show: showTaskEditDialog.value, 
            "onUpdate:show": (v: boolean) => (showTaskEditDialog.value = v),
            preset: "dialog",
            title: t("task.addTask"),
            style: "width: 500px;",
            positiveText: t("common.save"),
            negativeText: t("common.cancel"),
            onPositiveClick: handleAddTask,
          },
          {
            default: () =>
              h(NForm, { labelPlacement: "left", labelWidth: "auto" }, () => [
                h(NFormItem, { label: t("task.name") }, () =>
                  h(NInput, {
                    value: taskEditForm.name,
                    "onUpdate:value": (v: string) => (taskEditForm.name = v),
                    placeholder: t("task.namePlaceholder"),
                  })
                ),
                h(NFormItem, { label: t("task.command") }, () =>
            h(NInput, { 
              value: taskEditForm.command, 
                    "onUpdate:value": (v: string) => (taskEditForm.command = v),
                    type: "textarea",
                    placeholder: t("task.commandPlaceholder"),
                    autosize: { minRows: 1, maxRows: 5 },
                  })
                ),
                h(NFormItem, { label: t("task.cwd") }, () =>
            h(NInputGroup, null, () => [
                    h(NInput, {
                      value: taskEditForm.cwd,
                      "onUpdate:value": (v: string) => (taskEditForm.cwd = v),
                      placeholder: t("task.cwdPlaceholder"),
                    }),
                    h(
                      NButton,
                      {
                        onClick: () => {
                          taskEditForm.cwd = "/Users/demo/projects";
                          message.info(t("website.demo.folderHint"));
                        },
                      },
                      () => t("task.browse")
                    ),
                  ])
                ),
                h(NFormItem, { label: t("task.env") }, () =>
            h(NInput, { 
              value: taskEditForm.envStr, 
                    "onUpdate:value": (v: string) => (taskEditForm.envStr = v),
                    type: "textarea",
                    placeholder: t("task.envPlaceholder"),
                    autosize: { minRows: 2, maxRows: 10 },
                  })
                ),
                h(NFormItem, { label: t("task.useSystemTerminal") }, () =>
                  h(NSwitch, {
                    value: taskEditForm.useSystemTerminal,
                    "onUpdate:value": (v: boolean) =>
                      (taskEditForm.useSystemTerminal = v),
                  })
                ),
                h(NFormItem, { label: t("task.group") }, () =>
                  h(NSelect, {
                    value: taskEditForm.groupId,
                    "onUpdate:value": (v: string) => (taskEditForm.groupId = v),
                    options: groupOptions,
                  })
                ),
              ]),
          }
        ),
      
      // AI Generate Dialog
        h(
          NModal,
          {
        show: showAIDialog.value, 
            "onUpdate:show": (v: boolean) => (showAIDialog.value = v),
            preset: "dialog",
            title: t("task.aiGenerate"),
            style: "width: 600px;",
            showIcon: false,
          },
          {
            default: () =>
              h("div", { class: "ai-dialog-content" }, [
                h(NFormItem, { label: t("task.aiProvider") }, () =>
                  h(NSelect, {
                    value: aiForm.provider,
                    "onUpdate:value": (v: string) => (aiForm.provider = v),
                    options: aiProviderOptions,
                  })
                ),
                aiForm.provider === "ollama" && [
                  h(NFormItem, { label: t("task.ollamaUrl") }, () =>
                    h(NInput, {
                      value: aiForm.ollamaUrl,
                      "onUpdate:value": (v: string) => (aiForm.ollamaUrl = v),
                      placeholder: "http://localhost:11434",
                    })
                  ),
                  h(NFormItem, { label: t("task.ollamaModel") }, () =>
                    h(NSelect, {
                      value: aiForm.ollamaModel,
                      "onUpdate:value": (v: string) => (aiForm.ollamaModel = v),
                      options: ollamaModelOptions,
                      filterable: true,
                      tag: true,
                    })
                  ),
                ],
                aiForm.provider !== "ollama" &&
                  h(NFormItem, { label: t("task.aiApiKey") }, () =>
                    h(NInput, {
                      value: aiForm.apiKey,
                      "onUpdate:value": (v: string) => (aiForm.apiKey = v),
                      type: "password",
                      showPasswordOn: "click",
                      placeholder: t("task.aiApiKeyPlaceholder"),
                    })
                  ),
                h(NFormItem, { label: t("task.aiPrompt") }, () =>
                  h(NInput, {
                    value: aiForm.prompt,
                    "onUpdate:value": (v: string) => (aiForm.prompt = v),
                    type: "textarea",
                    placeholder: t("task.aiPromptPlaceholder"),
                    autosize: { minRows: 3, maxRows: 6 },
                  })
                ),
                h("div", { class: "ai-actions" }, [
                  h(
                    NButton,
                    {
                      type: "primary",
                      loading: aiForm.loading,
                      disabled:
                        (aiForm.provider !== "ollama" && !aiForm.apiKey) ||
                        !aiForm.prompt,
                      onClick: handleAIGenerate,
                    },
                    () => t("task.aiGenerateBtn")
                  ),
                ]),
                aiForm.result &&
                  h("div", { class: "ai-result" }, [
                    h(NDivider, null, () => t("task.aiResult")),
                    h("div", { class: "generated-task" }, [
                      h("div", { class: "result-item" }, [
                        h(
                          "span",
                          { class: "result-label" },
                          `${t("task.name")}:`
                        ),
                        h(
                          "span",
                          { class: "result-value" },
                          aiForm.result.name
                        ),
                      ]),
                      h("div", { class: "result-item" }, [
                        h(
                          "span",
                          { class: "result-label" },
                          `${t("task.command")}:`
                        ),
                        h(
                          "span",
                          { class: "result-value monospace" },
                          aiForm.result.command
                        ),
                      ]),
                      aiForm.result.args?.length &&
                        h("div", { class: "result-item" }, [
                          h(
                            "span",
                            { class: "result-label" },
                            `${t("task.args")}:`
                          ),
                          h(
                            "span",
                            { class: "result-value monospace" },
                            aiForm.result.args.join(" ")
                          ),
                        ]),
                      aiForm.result.cwd &&
                        h("div", { class: "result-item" }, [
                          h(
                            "span",
                            { class: "result-label" },
                            `${t("task.cwd")}:`
                          ),
                          h(
                            "span",
                            { class: "result-value monospace" },
                            aiForm.result.cwd
                          ),
                        ]),
                    ]),
                    h("div", { class: "ai-result-actions" }, [
                      h(
                        NButton,
                        {
                          onClick: () => {
                            message.success(t("website.demo.taskAdded"));
                            showAIDialog.value = false;
                          },
                        },
                        () => t("task.addToTasks")
                      ),
                      h(
                        NButton,
                        {
                          tertiary: true,
                          onClick: () => {
                            showTaskEditDialog.value = true;
                            showAIDialog.value = false;
                          },
                        },
                        () => t("task.editAndAdd")
                      ),
                    ]),
                  ]),
              ]),
          }
        ),

      ]);
  },
});
</script>

<style scoped>
.website-desktop {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: linear-gradient(
    135deg,
    #0f0c29 0%, 
    #302b63 40%, 
    #24243e 70%,
    #0f0c29 100%
  );
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
  position: relative;
  overflow: hidden;
}

.website-desktop::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(
      ellipse at 20% 20%,
      rgba(120, 100, 255, 0.15) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 80% 80%,
      rgba(36, 200, 219, 0.12) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 50% 50%,
      rgba(189, 52, 254, 0.08) 0%,
      transparent 60%
    );
  pointer-events: none;
}

@keyframes gradientShift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
</style>

<style>
.website-app {
  display: flex;
  flex-direction: column;
  width: 1100px;
  height: 750px;
  max-width: calc(100vw - 80px);
  max-height: calc(100vh - 80px);
  background: #18181c;
  border-radius: 12px;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  overflow: hidden;
  position: relative;
  z-index: 1;
}

/* Navbar */
.website-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 12px;
  background: #252529;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px 12px 0 0;
}

.website-navbar::before {
  content: "";
  display: flex;
  width: 52px;
  height: 12px;
  background: radial-gradient(circle at 6px 6px, #ff5f56 5px, transparent 5px),
    radial-gradient(circle at 26px 6px, #ffbd2e 5px, transparent 5px),
    radial-gradient(circle at 46px 6px, #27c93f 5px, transparent 5px);
  margin-right: 12px;
}

.navbar-left,
.navbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.navbar-logo {
  width: 20px;
  height: 20px;
  transition: transform 0.3s ease;
}

.navbar-logo:hover {
  transform: rotate(360deg);
}

.navbar-text {
  height: 14px;
  filter: brightness(0) invert(1);
  transition: filter 0.3s ease;
}

.navbar-left:hover .navbar-text {
  filter: brightness(0) invert(1) drop-shadow(0 0 8px rgba(36, 200, 219, 0.6));
}

.navbar-version {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.navbar-version:hover {
  background: rgba(36, 200, 219, 0.2);
  color: #24c8db;
}

.navbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.navbar-title {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

/* Main Content */
.website-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  background: #18181c;
}

/* Sidebar */
.website-sidebar {
  width: 260px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  background: #1e1e22;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  gap: 8px;
}

.sidebar-logo {
  width: 24px;
  height: 24px;
  transition: transform 0.3s ease;
  filter: drop-shadow(0 0 8px rgba(36, 200, 219, 0.3));
}

.sidebar-logo:hover {
  transform: scale(1.1) rotate(5deg);
  filter: drop-shadow(0 0 12px rgba(36, 200, 219, 0.6));
}

.header-buttons {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.task-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.task-group {
  margin-bottom: 4px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 4px;
  margin: 2px 8px;
}

.group-header:hover {
  background: rgba(255, 255, 255, 0.08);
}

.group-header:active {
  background: rgba(255, 255, 255, 0.12);
}

.group-icon {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.group-type-icon {
  font-size: 14px;
}

.group-type-icon.recent {
  color: #36cfc9;
}

.group-type-icon.star {
  color: #f5a623;
}

.group-type-icon.folder {
  color: #7c4dff;
}

.group-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.group-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 6px;
  border-radius: 10px;
}

.group-tasks {
  padding: 2px 0;
}

.source-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 6px 28px;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 4px;
  margin: 2px 8px;
}

.source-header:hover {
  background: rgba(255, 255, 255, 0.08);
}

.source-header:active {
  background: rgba(255, 255, 255, 0.12);
}

.source-icon {
  font-size: 14px;
}

.source-name {
  flex: 1;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.source-tasks {
  padding: 2px 0;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 28px;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  color: inherit;
  position: relative;
  border-radius: 4px;
  margin: 2px 8px;
}

.task-item.source-task {
  padding-left: 44px;
}

.task-item:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateX(2px);
}

.task-item:active {
  transform: translateX(1px);
}

.task-item.running {
  background: rgba(36, 200, 219, 0.15);
  border-left: 2px solid #24c8db;
  padding-left: 26px;
}

.task-item.running.source-task {
  padding-left: 42px;
}

.task-icon {
  font-size: 14px;
}

.task-name {
  flex: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.task-spinner {
  font-size: 14px;
  color: #24c8db;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.task-item.running::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #24c8db;
  animation: pulse 1.5s ease-in-out infinite;
}

/* Content Area */
.website-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Tabs */
.tabs-bar {
  display: flex;
  background: #252529;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 36px;
  overflow-x: auto;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.2s;
  position: relative;
  white-space: nowrap;
}

.tab-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.tab-item.active {
  background: #18181c;
  color: #fff;
  box-shadow: 0 -2px 8px rgba(36, 200, 219, 0.2);
  position: relative;
}

.tab-item.active::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #24c8db, #41d1ff);
}

.tab-item.running {
  color: #24c8db;
}

.tab-item.running.active {
  color: #fff;
}

.tab-spinner {
  animation: spin 1s linear infinite;
  color: #24c8db;
}

.tab-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-stop {
  display: flex;
  align-items: center;
  opacity: 0.6;
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  transition: all 0.2s;
}

.tab-stop:hover {
  opacity: 1;
  background: rgba(255, 100, 100, 0.2);
  color: #ff6464;
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  width: 18px;
  height: 18px;
  opacity: 0.5;
  cursor: pointer;
  line-height: 1;
  border-radius: 3px;
  transition: all 0.2s;
}

.tab-close:hover {
  opacity: 1;
  background: rgba(255, 100, 100, 0.2);
  color: #ff6464;
}

.tab-content {
  flex: 1;
  overflow: hidden;
  background: #0d0d0f;
  display: flex;
  flex-direction: column;
}

.terminal-container {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 8px;
}

/* Welcome Content */
.welcome-container {
  flex: 1;
  overflow-y: auto;
  padding: 48px 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-content {
  max-width: 600px;
  text-align: center;
}

.welcome-logo {
  width: 80px;
  height: 80px;
  margin-bottom: 20px;
  filter: drop-shadow(0 0 24px rgba(36, 200, 219, 0.4));
}

.welcome-title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #24c8db, #41d1ff, #bd34fe);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome-subtitle {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 40px;
  line-height: 1.6;
}

/* Download Section */
.download-section {
  margin-top: 24px;
}

.download-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #fff;
}

.download-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.download-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: #fff;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 180px;
  position: relative;
  overflow: hidden;
}

.download-btn::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(36, 200, 219, 0.2),
    transparent
  );
  transition: left 0.5s;
}

.download-btn:hover::before {
  left: 100%;
}

.download-btn:hover {
  background: rgba(36, 200, 219, 0.15);
  border-color: rgba(36, 200, 219, 0.6);
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(36, 200, 219, 0.3);
}

.download-btn:active {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(36, 200, 219, 0.2);
}

.download-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.download-platform {
  font-size: 16px;
  font-weight: 600;
}

.download-arch {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.linux-icon {
  width: 32px;
  height: 32px;
}

.download-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
}

.security-warning {
  margin-top: 24px;
  padding: 16px;
  background: rgba(255, 200, 0, 0.08);
  border: 1px solid rgba(255, 200, 0, 0.2);
  border-radius: 8px;
  font-size: 12px;
  color: rgba(255, 220, 100, 0.9);
}

.security-warning p {
  margin: 0 0 8px 0;
  font-weight: 500;
}

.security-warning ul {
  margin: 0;
  padding-left: 20px;
  list-style: disc;
}

.security-warning li {
  margin: 4px 0;
  line-height: 1.5;
}

/* Status Bar */
.website-statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  padding: 0 12px;
  background: #252529;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0 0 12px 12px;
  font-size: 11px;
}

.statusbar-left,
.statusbar-center,
.statusbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.4);
  text-decoration: none;
}

.status-item.demo-notice {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

.status-item.clickable {
  cursor: pointer;
  transition: all 0.2s;
  padding: 2px 6px;
  border-radius: 4px;
}

.status-item.clickable:hover {
  color: #24c8db;
  background: rgba(36, 200, 219, 0.1);
}

.status-item.clickable:active {
  transform: scale(0.95);
}

/* Dialog styles */
.ai-dialog-content {
  padding: 8px 0;
}

.ai-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.ai-result {
  margin-top: 8px;
}

.generated-task {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px;
}

.result-item {
  display: flex;
  margin-bottom: 8px;
}

.result-item:last-child {
  margin-bottom: 0;
}

.result-label {
  width: 80px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.result-value {
  flex: 1;
  font-size: 13px;
}

.result-value.monospace {
  font-family: monospace;
}

.ai-result-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: flex-end;
}

.ports-content,
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: #0d0d0f;
}

.ports-panel,
.settings-panel {
  width: 100%;
  height: 100%;
  padding: 0;
}

.port-filter {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.port-filter .n-input {
  flex: 1;
}

.port-list {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.port-header {
  display: flex;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  font-weight: 600;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.port-item {
  display: flex;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  align-items: center;
}

.port-item:last-child {
  border-bottom: none;
}

.port-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.port-col {
  width: 250px;
  flex-shrink: 0;
}

.port-numbers {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.port-tag {
  font-family: "Courier New", Courier, monospace;
  font-weight: 600;
}

.pid-col {
  width: 80px;
  flex-shrink: 0;
  font-family: "Courier New", Courier, monospace;
  color: rgba(255, 255, 255, 0.6);
}

.name-col {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.8);
}

.action-col {
  width: 100px;
  flex-shrink: 0;
  text-align: right;
}

.no-ports {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: rgba(255, 255, 255, 0.4);
}

/* Settings Panel Styles */
.settings-panel {
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.settings-panel :deep(.n-tabs) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-panel :deep(.n-tabs-nav) {
  flex-shrink: 0;
  padding: 0 16px;
}

.settings-panel :deep(.n-tab-pane) {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  min-height: 0;
}

.settings-panel .n-form-item {
  margin-bottom: 20px;
}

.settings-panel .n-form-item-label {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.setting-hint {
  margin-left: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.compact-settings-form {
  padding: 8px 0;
}

.compact-settings-form .n-form-item {
  margin-bottom: 8px;
}

.command-icon-settings {
  padding: 8px 0;
}

.add-mapping {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  align-items: center;
}

.update-section {
  padding: 12px 0;
}

.update-notes {
  margin-top: 8px;
  white-space: pre-wrap;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.release-notes-section {
  min-height: 100px;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 12px;
}

.release-notes-content {
  padding: 4px 0;
}

.release-item {
  padding: 12px;
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.release-item:last-child {
  margin-bottom: 0;
}

.release-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.release-tag {
  font-weight: 600;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

.release-date {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.release-body {
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.7);
  white-space: pre-wrap;
  word-break: break-word;
}

.no-release-notes {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80px;
}

.dev-log-viewer {
  padding: 8px 0;
}

.log-toolbar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.log-entries {
  padding: 4px 0;
}

.log-entry {
  display: flex;
  gap: 12px;
  padding: 4px 8px;
  font-size: 12px;
  font-family: monospace;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: rgba(255, 255, 255, 0.4);
  min-width: 80px;
}

.log-level {
  min-width: 50px;
  font-weight: 600;
}

.level-debug {
  color: rgba(255, 255, 255, 0.5);
}

.level-info {
  color: #24c8db;
}

.level-warn {
  color: #f5a623;
}

.level-error {
  color: #ff6464;
}

.log-source {
  color: rgba(255, 255, 255, 0.6);
  min-width: 80px;
}

.log-message {
  color: rgba(255, 255, 255, 0.8);
  flex: 1;
}

.log-content {
  font-family: monospace;
  font-size: 12px;
  padding: 8px;
  color: rgba(255, 255, 255, 0.7);
  white-space: pre-wrap;
  word-break: break-word;
}

.no-logs {
  padding: 24px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
}

.ai-tools-panel {
  padding: 8px 0;
}

.ai-tools-layout {
  display: flex;
  gap: 16px;
}

.tools-sidebar {
  width: 150px;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  padding-right: 16px;
}

.tool-tab-item {
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 4px;
  transition: all 0.2s;
  color: rgba(255, 255, 255, 0.8);
}

.tool-tab-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.tool-tab-item.active {
  background: rgba(36, 200, 219, 0.2);
  color: #24c8db;
}

.tools-content {
  flex: 1;
}

.tool-panel {
  padding: 8px 0;
}

.tool-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.tool-info {
  margin-bottom: 16px;
}

.website-link {
  color: #24c8db;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
}

.website-link:hover {
  text-decoration: underline;
}

.icon-name {
  font-family: monospace;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

/* Mode options in Add Folder dialog */
.mode-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mode-title {
  font-weight: 500;
  font-size: 14px;
}

.mode-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.4;
}

/* Scrollbar styling */
.task-list::-webkit-scrollbar,
.tab-content::-webkit-scrollbar,
.welcome-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.task-list::-webkit-scrollbar-track,
.tab-content::-webkit-scrollbar-track,
.welcome-container::-webkit-scrollbar-track {
  background: transparent;
}

.task-list::-webkit-scrollbar-thumb,
.tab-content::-webkit-scrollbar-thumb,
.welcome-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.task-list::-webkit-scrollbar-thumb:hover,
.tab-content::-webkit-scrollbar-thumb:hover,
.welcome-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Smooth transitions */
.tab-content,
.welcome-container {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive */
@media (max-width: 1024px) {
  .website-desktop {
    padding: 20px;
  }
  
  .website-app {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    border-radius: 0;
  }
  
  .website-navbar {
    border-radius: 0;
  }
  
  .website-navbar::before {
    display: none;
  }
  
  .website-statusbar {
    border-radius: 0;
  }
}

@media (max-width: 768px) {
  .website-sidebar {
    display: none;
  }
  
  .download-buttons {
    flex-direction: column;
    align-items: center;
  }
}
</style>
