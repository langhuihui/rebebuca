# Rebebuca：一条命令的运行配置管理工具

> 用 **Node.js** 交付的 Rebebuca：浏览器里完成配置、终端、历史与远程执行。  
> 启动只需一行：

```bash
npx rebebuca
```

---

## 它是什么

Rebebuca 帮你**少记命令、少切窗口**：把常用命令存成配置，一键在标签页里跑，输出实时查看，并支持 SSH、任务发现、宏编排等。

- **前端**：Vue 3、Naive UI，适配现代浏览器。  
- **后端**：Node.js（HTTP + WebSocket、`node-pty` 等），通过 `npx` 分发。  
- **数据**：配置与状态在本地（如 `~/.rebebuca/store.json`），不依赖安装包版本对齐。

---

## 能力概览

- 左侧运行配置、中间多标签终端、右侧运行历史  
- 环境变量、工作目录、并行/串行、运行历史与日志  
- SSH 远程执行  
- 任务自动发现（npm scripts、VS Code tasks等）  
- MCP 端点（可用 `--no-mcp` 关闭）

---

## 快速开始

**启动**

```bash
npx rebebuca
```

浏览器会打开默认端口（可用 `--port` 指定）。

**新建配置**：左侧新建 → 填写名称、命令、目录 → 保存 →点击运行。

---

## MCP（可选）

启动后可将 Rebebuca 的 MCP 端点加入 Cursor 等工具，便于 AI 列出或触发任务（参见仓库内 `mcp-config-example.json`）。

---

## 链接

**官网**：[rebebuca.com](https://rebebuca.com)  
**GitHub**：[github.com/langhuihui/rebebuca](https://github.com/langhuihui/rebebuca)  
**许可证**：GPL-3.0
