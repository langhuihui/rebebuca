# Rebebuca - 让命令行操作变得简单优雅

> 一款现代化的跨平台任务运行管理工具，告别繁琐的命令行输入

![Rebebuca](https://img.shields.io/badge/version-0.1.7-green) ![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue) ![License](https://img.shields.io/badge/license-GPL--3.0-orange)

## 你是否也有这样的困扰？

作为开发者，我们每天都在与命令行打交道：

- 启动开发服务器：`npm run dev`、`pnpm start`、`cargo run`...
- 运行测试：`npm test`、`go test ./...`、`pytest`...
- 构建部署：`npm run build`、`docker compose up`...
- 还有各种带着一长串参数的复杂命令

**这些命令你能全部记住吗？** 每次都要翻找历史记录，或者打开文档查阅？

**Rebebuca** 就是为解决这个痛点而生的。

---

## 什么是 Rebebuca？

**Rebebuca**（读作 /ˌrebəˈbuːkə/）是一款**轻量级、跨平台的任务运行管理工具**。它让你可以：

- 一键保存常用命令配置
- 可视化管理所有任务
- 实时查看终端输出
- 自动发现项目中的任务
- 用 AI 生成命令配置

简单来说，**Rebebuca 就是你的命令行管家**。

---

## 核心特性

### 1. 智能任务发现

Rebebuca 能够自动扫描并导入你项目中已有的任务配置：

- **VSCode tasks.json** - 直接复用你在 VS Code 中配置的任务
- **npm/pnpm scripts** - 自动读取 package.json 中的脚本命令
- **自定义任务** - 灵活添加任何你需要的命令

无需重复配置，**开箱即用**。

### 2. 现代化终端体验

内置完整功能的终端模拟器（基于 xterm.js）：

- 真实 PTY 支持，与系统终端体验一致
- 多标签页设计，同时运行多个任务
- 支持 URL 点击跳转
- 拖拽文件自动输入路径
- 10,000 行滚动缓冲区

### 3. AI 智能助手

集成多个 AI 服务，用自然语言描述你的需求，自动生成命令配置：

- **Ollama** - 本地部署，隐私安全
- **OpenAI** - GPT-4 强大能力
- **Anthropic** - Claude 系列模型
- **DeepSeek** - 国产优质模型

只需说：*"帮我创建一个运行 Go 测试并显示覆盖率的任务"*，AI 就能为你生成完整配置。

### 4. 端口管理器

再也不用 `lsof -i :3000` 了！内置端口管理功能：

- 一目了然查看所有监听端口
- 显示进程名称和 PID
- 一键终止进程
- 支持搜索过滤

### 5. 收藏与最近运行

- **收藏夹** - 星标常用任务，支持拖拽排序
- **最近运行** - 自动记录使用历史，支持按时间/频率排序
- **执行日志** - 完整保存每次运行的输出

### 6. 深浅主题

精心设计的 UI，支持三种主题模式：

- **深色主题** - 专业护眼，程序员首选
- **浅色主题** - 清新明亮，白天使用
- **跟随系统** - 自动切换，省心省力

---

## 为什么选择 Rebebuca？

### vs VS Code 内置任务

| 特性 | Rebebuca | VS Code |
|------|----------|---------|
| 独立运行 | ✅ 无需 IDE | ❌ 需要打开 VS Code |
| 启动速度 | ✅ 秒开 | ❌ 需要加载整个 IDE |
| 资源占用 | ✅ ~50MB 内存 | ❌ 数百 MB 起步 |
| 端口管理 | ✅ 内置 | ❌ 无 |
| AI 生成 | ✅ 内置 | ❌ 需要插件 |

### vs 传统终端

| 特性 | Rebebuca | 终端 |
|------|----------|------|
| 命令管理 | ✅ 可视化界面 | ❌ 手动记忆/脚本 |
| 历史追溯 | ✅ 完整日志 | ❌ 有限历史 |
| 多项目切换 | ✅ 一键切换 | ❌ cd 来 cd 去 |
| 任务发现 | ✅ 自动扫描 | ❌ 手动查看 |

### 技术优势

- **Tauri + Rust** - 安装包仅 ~10MB，比 Electron 应用小 10 倍以上
- **真正跨平台** - macOS（支持 Intel 和 Apple Silicon）、Windows、Linux
- **开源免费** - GPL-3.0 协议，社区驱动

---

## 使用场景

### 前端开发者

```
📁 我的项目
├── 🟢 dev - pnpm dev
├── 🔵 build - pnpm build  
├── 🟡 test - vitest run
└── 🟣 lint - eslint --fix .
```

一键切换不同项目，秒速启动开发环境。

### 后端开发者

```
📁 后端服务
├── 🟢 start - go run main.go
├── 🔵 test - go test -v ./...
├── 🟡 docker - docker compose up -d
└── 🟣 migrate - goose up
```

告别复杂的启动脚本，所有命令一目了然。

### DevOps 工程师

```
📁 运维任务
├── 🟢 deploy - ./deploy.sh production
├── 🔵 logs - kubectl logs -f pod/xxx
├── 🟡 backup - ./backup-db.sh
└── 🟣 monitor - htop
```

常用运维命令集中管理，提升工作效率。

---

## 快速开始

### 安装

从 [GitHub Releases](https://github.com/langhuihui/rebebuca/releases) 下载适合你系统的安装包：

- **macOS**: `.dmg` (Universal Binary，同时支持 Intel 和 Apple Silicon)
- **Windows**: `.exe` 或 `.msi`
- **Linux**: `.AppImage` 或 `.deb`

### 添加第一个任务

1. 点击侧边栏的 **+** 按钮
2. 填写任务名称和命令
3. 点击保存
4. 双击运行！

或者，直接添加一个项目文件夹，Rebebuca 会自动扫描其中的 `tasks.json` 和 `package.json`。

---

## 路线图

我们正在积极开发以下功能：

- [ ] 任务依赖关系（Task A 完成后自动运行 Task B）
- [ ] 远程服务器支持（SSH 连接）
- [ ] 任务模板市场
- [ ] 团队协作功能
- [ ] 插件系统

---

## 参与贡献

Rebebuca 是一个开源项目，我们欢迎任何形式的贡献：

- 🐛 [报告 Bug](https://github.com/langhuihui/rebebuca/issues)
- 💡 [提出建议](https://github.com/langhuihui/rebebuca/issues)
- 🔧 [提交 PR](https://github.com/langhuihui/rebebuca/pulls)
- ⭐ [给个 Star](https://github.com/langhuihui/rebebuca)

---

## 下载体验

**立即下载，让命令行操作变得简单优雅！**

👉 [GitHub Releases](https://github.com/langhuihui/rebebuca/releases/latest)

---

*Rebebuca - Run Everything, Better.*
