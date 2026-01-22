---
name: remote-agent-test
description: 用于本地测试 remote-agent-server 功能的 skill。当需要测试 remote-agent-server 服务是否正常工作时使用此 skill。该 skill 会自动编译服务端代码、启动服务器、通过 agent-browser 访问测试页面，并在端口被占用时自动杀掉进程重试。
---

# Remote Agent Test

## Overview

本 skill 用于测试 Rebebuca 项目的 remote-agent-server 功能。它会自动处理编译、启动服务和使用 agent-browser 进行 UI 测试的完整流程。

## Workflow

### 1. 检查并释放端口

在启动服务器前，首先检查端口 8765 是否被占用：

```bash
# 检查端口占用
lsof -i :8765

# 如果端口被占用，杀掉占用进程
lsof -ti :8765 | xargs kill -9 2>/dev/null || true
```

### 2. 编译服务端代码

执行前端构建命令，构建 server 模式的前端代码：

```bash
cd /Users/dexter/project/rebebuca
pnpm build:server
```

此命令会：
- 设置 `VITE_BACKEND=server` 环境变量
- 运行 `vue-tsc --noEmit` 进行类型检查
- 运行 `vite build` 构建前端代码

### 3. 启动 Remote Agent Server

在一个新终端中启动服务器：

```bash
cd /Users/dexter/project/rebebuca
pnpm server:dev
```

此命令会：
- 进入 `remote-agent-server` 目录
- 运行 `cargo run -- --port 8765` 启动服务器
- 服务器会在 http://localhost:8765/ 提供服务

**注意**：服务器启动需要一些时间（编译 Rust 代码），等待看到 "Starting HTTP server on http://0.0.0.0:8765" 日志后再进行下一步。

### 4. 使用 agent-browser 测试

使用 agent-browser 命令行工具访问 http://localhost:8765/ 进行测试：

1. 首先导航到测试页面：
```bash
agent-browser open http://localhost:8765/
```

2. 获取页面快照检查状态：
```bash
agent-browser snapshot -i
```

3. 常见测试场景：
   - 检查页面是否正常渲染
   - 检查 WebSocket 连接是否建立
   - 测试终端功能
   - 测试文件系统功能

4. 交互示例：
```bash
# 点击元素
agent-browser click @e1

# 填写输入框
agent-browser fill @e2 "test content"

# 等待页面加载
agent-browser wait --load networkidle
```

### 5. 清理

测试完成后：

1. 关闭 agent-browser 浏览器：
```bash
agent-browser close
```

2. 停止服务器：
   - 在运行服务器的终端按 Ctrl+C 停止服务
   - 或使用 `lsof -ti :8765 | xargs kill -9` 强制停止

## 故障排除

### 端口被占用

如果端口 8765 被占用：

```bash
# 查看占用进程
lsof -i :8765

# 强制杀掉进程
lsof -ti :8765 | xargs kill -9
```

### 编译失败

如果 `pnpm build:server` 失败：
- 检查 TypeScript 类型错误
- 运行 `vue-tsc --noEmit` 查看详细错误

如果 Rust 编译失败：
- 检查 `remote-agent-server/src/` 下的代码
- 运行 `cd remote-agent-server && cargo check` 查看详细错误

### 服务器启动失败

如果服务器启动失败：
- 检查端口是否已释放
- 检查 Rust 代码是否有运行时错误
- 查看终端输出的错误日志

### agent-browser 无法连接

如果 agent-browser 无法访问页面：
- 确认服务器已完全启动（看到 "Starting HTTP server" 日志）
- 检查防火墙设置
- 尝试在浏览器中手动访问 http://localhost:8765/
- 使用 `agent-browser open http://localhost:8765/ --headed` 显示浏览器窗口进行调试
