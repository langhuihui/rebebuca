# Rebebuca

<div align="center">
  <img src="public/logo-dark.svg" alt="Rebebuca Logo" width="120" height="120">
  
  <h3>Run Configuration Management Tool</h3>
  
  <p>Launch instantly with a single command — no installation required, just Node.js 18+</p>

  [![npm](https://img.shields.io/npm/v/rebebuca?style=flat-square&logo=npm)](https://www.npmjs.com/package/rebebuca)
  [![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
  [![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?style=flat-square&logo=vue.js)](https://vuejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
  [![License](https://img.shields.io/badge/License-GPL--3.0-green.svg?style=flat-square)](LICENSE)

  **[Official Website](https://rebebuca.com)** | [中文文档](README_CN.md) | English
</div>

---

## 🚀 Quick Start

```bash
npx rebebuca
```

That's it! Rebebuca starts a local web server and opens your browser automatically.

### Options

```bash
npx rebebuca --port 8080          # Custom port (default: 3000)
npx rebebuca 8080                 # Shorthand for --port 8080
npx rebebuca --host 0.0.0.0       # Expose on all network interfaces
npx rebebuca --no-open            # Don't open browser automatically
npx rebebuca --no-mcp             # Disable MCP routes on the same port
npx rebebuca --help               # Show all options
```

### Headless CLI (no web server)

Useful for scripts, terminals, and AI agents that prefer a plain CLI over MCP.

```bash
# List CLI flags / subcommands, saved user tasks, or both (--json for machine-readable)
npx rebebuca list options
npx rebebuca list tasks
npx rebebuca list all --json

# Run a saved user task by exact id or fuzzy match on name (see note below)
npx rebebuca run <id-or-name>

# Run an arbitrary shell command (login shell), without starting Rebebuca
npx rebebuca -- pnpm test

# Install tab completion (fuzzy task suggestions for: rebebuca run <tab>)
eval "$(npx rebebuca complete zsh)"
source <(npx rebebuca complete bash)
```

**Task source for `list` / `run`:** tasks are read from `userGroups` in `~/.rebebuca/store.json` (user-defined groups in the app). Folder-scanned tasks (VS Code / npm scripts, etc.) are not included until they exist in that store.

**Restrictions:** `run` does not execute SSH-only tasks, “system terminal” tasks, or other modes that require the full UI.

> **Requirements:** Node.js 18 or higher

---

## ✨ Features

- 🚀 **Quick Launch** - Create and run configurations with one click, no need to memorize complex commands
- ⚡ **Real-time Output** - View command execution results in real-time with multi-tab support
- 📝 **Configuration Management** - Support for advanced options like working directory and environment variables
- 🕒 **History Tracking** - Automatically save run history for easy re-execution
- 🎨 **Modern UI** - Beautiful dark theme interface built with Naive UI
- 💾 **Persistent Storage** - Configurations and history data are automatically saved and persist across restarts
- 🖥️ **Cross-platform** - Supports Windows, macOS, and Linux
- 🌐 **Web-based** - Runs entirely in your browser via a local Node.js HTTP server
- ⌨️ **CLI** - `list`, `run`, `-- <cmd>`, and shell completion for automation and AI workflows

## 📸 Preview

<div align="center">
  <img src="public-website/snap1.png" alt="Application Screenshot - Light Theme" width="800">
  <br><br>
  <img src="public-website/snap1_dark.png" alt="Application Screenshot - Dark Theme" width="800">
</div>

## 🛠️ Tech Stack

### Frontend
- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Type-safe JavaScript superset
- **Naive UI** - Modern Vue 3 component library
- **Pinia** - Lightweight state management library for Vue
- **Vite** - Next generation frontend build tool

### Backend (Node.js)
- **Node.js** - HTTP + WebSocket server (replaces Rust/Tauri)
- **node-pty** - Native PTY terminal emulation
- **ws** - High-performance WebSocket library

## 📦 Development Setup

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **pnpm**

### Development Server

1. **Install dependencies**
```bash
npm install
```

2. **Start development server** (mock backend)
```bash
npm run dev:web
```

3. **Start with Node.js backend** (full server mode)
```bash
npm run dev:server
```

4. **Build the npm-publishable bundle**
```bash
npm run build:server-app
```

## ⌨️ Web UI

### Running configurations

- Click the **play button** ▶️ next to a configuration in the left sidebar
- The command runs in a new tab with live output
- Multiple configurations can run at once

### Managing tabs

- **Restart** — run the same configuration again
- **Stop** — terminate the process
- **Clear** — clear console output
- **Scroll to Bottom** — jump to the latest output
- **Edit** — change the configuration for the current tab

### Run history

- The side panel shows recent runs
- Use **rerun** to execute a past command again
- History can be cleared

## 📁 Project Structure

```
rebebuca/
├── app/                      # Nuxt 3 app (UI)
│   └── pages/
├── src/                      # Shared Vue/TS (used by app)
│   ├── components/          # Vue components
│   └── stores/              # Pinia state management
├── node-server/              # Node.js HTTP + WebSocket server
│   ├── server.js
│   ├── cli-subcommands.js    # Headless CLI (list / run / completion)
│   └── handlers/
├── bin/rebebuca.js          # CLI entry (npx rebebuca)
├── dist/server/             # Built static UI (from Nuxt generate)
├── public/                  # Static assets
└── package.json             # Project dependencies
```

## 🔨 Building

### Development
```bash
# Frontend dev (Vite) + backend runs separately
pnpm dev:server
```

### Production build (for npm / npx rebebuca)
```bash
pnpm run build:server-app
```
This runs Nuxt static build and outputs to `dist/server`. The Node server serves from that directory.

### Release & publish to npm

Push a version tag to trigger GitHub Actions to build and publish:

```bash
./scripts/release.sh 0.5.6   # bumps version, commits, creates v0.5.6, pushes
```
CI runs `build:server-app` then `pnpm publish`. Ensure `NPM_TOKEN` is set in repo secrets.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Development Guidelines

### Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) 
- Extensions:
  - [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
  - [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin)

### Code Standards

- Use TypeScript strict mode
- Follow Vue 3 Composition API best practices
- Use `<script setup>` syntax sugar
- Keep code clean and maintainable

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Vue.js](https://vuejs.org/) - Progressive JavaScript framework
- [Nuxt](https://nuxt.com/) - Vue-based static/build setup
- [Naive UI](https://www.naiveui.com/) - Beautiful Vue 3 component library
- [Vite](https://vitejs.dev/) - Fast frontend build tool

---

<div align="center">
  <p>Made with ❤️</p>
  <p>If this project helps you, please give it a ⭐️</p>
</div>

