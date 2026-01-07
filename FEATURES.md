# Rebebuca - 重新定义你的开发工作流

> 一款现代化的运行配置管理工具，让开发者告别繁琐的命令行操作

---

## 为什么选择 Rebebuca？

作为开发者，你是否经常遇到这些问题：

- 项目越来越多，记不住各种启动命令？
- 每次都要打开终端，cd 到项目目录，输入一长串命令？
- 想同时运行多个服务，却要开一堆终端窗口？
- 团队成员的开发环境配置不一致？

**Rebebuca** 就是为解决这些痛点而生。它不仅仅是一个命令运行器，更是你的开发效率利器。

---

## 核心亮点

### 一键启动，告别重复劳动

把你常用的命令保存为配置，下次只需点击一下就能运行。无论是 `npm run dev`、`docker-compose up` 还是复杂的构建脚本，都能一键搞定。

### 智能识别项目任务

- **自动扫描 package.json**: 项目里的 npm scripts 自动识别
- **兼容 VSCode Tasks**: 直接读取 .vscode/tasks.json，无缝迁移
- **文件夹监控**: 添加项目文件夹后自动发现所有可运行的任务

### 宏任务 - 组合的力量

开发时需要同时启动前端、后端、数据库？用宏任务一键全部启动！

- **串行执行**: 按顺序依次运行，适合有依赖关系的任务
- **并行执行**: 同时运行所有子任务，快速启动完整开发环境

```
示例：一键启动全栈开发环境
├── 启动 MongoDB (等待就绪)
├── 启动后端服务 (等待就绪)  
└── 启动前端开发服务器
```

### 实时终端输出

内置的终端视图让你实时看到命令输出，支持：

- 多标签页同时查看多个任务
- ANSI 颜色完美渲染
- 自动滚动到最新输出
- 一键清空、重启、停止

### 迷你模式 - 小巧不占地

开启迷你模式后，窗口只显示任务列表，占用最小的屏幕空间。适合放在桌面角落，随时待命。

---

## 系统托盘 - 后台常驻

Rebebuca 可以最小化到系统托盘，随时待命：

- **快速访问**: 托盘菜单直接显示收藏任务和最近运行的任务
- **运行状态**: 一眼看到哪些任务正在运行
- **快捷操作**: 右键即可启动、停止、重启任务

---

## AI 时代的开发助手

### AI 工具快速启动

集成主流 AI 编码工具的配置管理：

- Claude Code
- Cursor
- Windsurf
- Augment
- Cline
- 更多工具持续添加中...

一键配置 API 密钥，快速启动 AI 编码会话。

### 命令广场

内置常用命令模板，新手也能快速上手：

- 开发服务器启动命令
- 构建和部署脚本
- Docker 相关命令
- Git 工作流命令

---

## 端口管理

开发时端口被占用是常见的烦恼。Rebebuca 内置端口管理功能：

- 查看当前所有监听的端口
- 显示占用端口的进程信息
- 一键终止进程释放端口
- 再也不用手动 `lsof -i :3000` 了

---

## 终端选择自由

不喜欢内置终端？没问题！

- 支持选择系统安装的任何终端
- Windows: Windows Terminal、PowerShell、CMD
- macOS: Terminal.app、iTerm2、Hyper
- Linux: GNOME Terminal、Konsole、Alacritty

每个任务可以单独设置使用的终端，灵活配置。

---

## 跨平台体验一致

无论你用什么系统，体验都一样顺滑：

| 平台 | 支持版本 |
|------|---------|
| macOS | Intel 和 Apple Silicon 原生支持 |
| Windows | Windows 10/11 x64 |
| Linux | 主流发行版 (AppImage/deb) |

---

## 技术架构

Rebebuca 采用现代化技术栈，确保性能和体验：

- **Tauri 2.0**: 基于 Rust 的轻量级桌面框架，内存占用低
- **Vue 3 + TypeScript**: 现代前端技术，响应式 UI
- **Naive UI**: 精美的组件库，支持亮色/暗色主题

应用体积小巧：
- macOS: ~15MB
- Windows: ~8MB

---

## 开源免费

Rebebuca 采用 GPL-3.0 协议开源，完全免费使用。

- GitHub: [langhuihui/rebebuca](https://github.com/langhuihui/rebebuca)
- 官网: [rebebuca.com](https://rebebuca.com)

欢迎 Star、Fork、提交 Issue 和 PR！

---

## 快速开始

### 下载安装

访问 [官网下载页面](https://rebebuca.com) 或 [GitHub Releases](https://github.com/langhuihui/rebebuca/releases) 下载适合你系统的安装包。

### 三步上手

1. **添加项目文件夹** - 点击侧边栏的文件夹图标，选择你的项目目录
2. **自动发现任务** - Rebebuca 会自动扫描并列出所有可运行的任务
3. **点击运行** - 点击任务旁边的播放按钮，开始工作！

### 创建自定义任务

1. 点击 "+" 按钮新建任务
2. 输入名称和命令
3. 可选：设置工作目录、环境变量、Python 虚拟环境等
4. 保存，完成！

---

## 用户反馈

> "终于不用每次都打开终端敲命令了，效率提升太多！" - 前端开发者

> "宏任务功能太棒了，一键启动整个微服务集群。" - 后端工程师

> "托盘菜单的快捷操作很方便，常驻后台随时可用。" - 全栈开发者

---

## 未来规划

- 任务执行统计和分析
- 团队配置共享和同步
- 远程服务器任务管理
- 更多 AI 工具集成
- 插件系统

---

## 加入社区

- 提交 Bug 或功能建议: [GitHub Issues](https://github.com/langhuihui/rebebuca/issues)
- 参与开发: [贡献指南](https://github.com/langhuihui/rebebuca/blob/main/CONTRIBUTING.md)

**让 Rebebuca 成为你开发工作流中不可或缺的一部分！**

---

*立即下载，开启高效开发之旅*

[下载 Rebebuca](https://rebebuca.com) | [查看源码](https://github.com/langhuihui/rebebuca)
