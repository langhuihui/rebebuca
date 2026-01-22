---
name: tauri-debug
description: 用于调试 Tauri 程序的 skill。当需要测试 Rebebuca 应用功能时使用此 skill。该 skill 会启动 tauri:dev 开发服务器，等待 MCP 服务就绪后，通过 rebebuca-debug MCP 工具获取前端日志、Tauri 日志、DOM 树、任务列表，并可以执行特定任务进行测试。
---

# Tauri Debug

## Overview

本 skill 用于调试 Rebebuca Tauri 应用程序。它通过启动 `tauri:dev` 开发模式，然后利用内置的 `rebebuca-debug` MCP 服务器来获取应用程序的调试信息和执行任务。

## Important Note

**MCP 服务依赖关系**：`rebebuca-debug` MCP 服务是在 Tauri 应用程序内部启动的，因此必须先成功启动 `tauri:dev`，等待应用程序完全加载后，MCP 工具才可用。

## Workflow

### 1. 检查 Tauri 开发服务器状态

首先检查 Tauri 应用是否已经在运行（通过检查 MCP 服务器端口）：

```bash
# 检查 MCP 服务器端口 3001 是否已在监听
lsof -i :3001 | grep LISTEN
```

如果端口已在监听，说明 Tauri 应用已经运行，可以直接使用 MCP 工具。

### 2. 启动 Tauri 开发服务器

如果应用未运行，在一个新终端中启动：

```bash
cd /Users/dexter/project/rebebuca
pnpm tauri:dev
```

此命令会：
- 启动 Vite 开发服务器（前端）
- 编译并启动 Tauri Rust 后端
- 在应用启动后自动启动内置的 MCP HTTP 服务器（端口 3001）

**等待标志**：当看到应用窗口打开且能正常显示界面时，MCP 服务已就绪。

### 3. 验证 MCP 服务就绪

在使用 MCP 工具前，验证服务是否可用：

```bash
curl -s http://127.0.0.1:3001/health
```

成功响应示例：
```json
{"status":"ok","server":"rebebuca-debug","version":"1.0.0","tools":6,"resources":3}
```

### 4. 使用 MCP 工具进行调试

当 MCP 服务就绪后，使用 `mcp_get_tool_description` 和 `mcp_call_tool` 调用 `rebebuca-debug` 服务器的工具：

#### 可用工具列表

| 工具名称 | 描述 | 参数 |
|---------|------|------|
| `get_frontend_logs` | 获取前端控制台日志 | 无 |
| `get_tauri_logs` | 获取 Tauri 后端日志 | 无 |
| `get_dom_tree` | 获取当前 DOM 树结构 | `maxDepth`(可选), `maxChildren`(可选) |
| `get_all_debug_info` | 一次性获取所有调试信息 | `maxDepth`(可选), `maxChildren`(可选) |
| `list_tasks` | 获取所有可用任务列表 | `source`(可选): 过滤任务来源 |
| `execute_task` | 执行指定任务 | `taskId`(必需), `cwd`(可选) |

#### 工具使用示例

**获取前端日志**：
```
mcp_call_tool:
  serverName: rebebuca-debug
  toolName: get_frontend_logs
  arguments: {}
```

**获取 Tauri 后端日志**：
```
mcp_call_tool:
  serverName: rebebuca-debug
  toolName: get_tauri_logs
  arguments: {}
```

**获取 DOM 树**：
```
mcp_call_tool:
  serverName: rebebuca-debug
  toolName: get_dom_tree
  arguments: {"maxDepth": 5, "maxChildren": 20}
```

**获取所有调试信息**：
```
mcp_call_tool:
  serverName: rebebuca-debug
  toolName: get_all_debug_info
  arguments: {}
```

**列出所有任务**：
```
mcp_call_tool:
  serverName: rebebuca-debug
  toolName: list_tasks
  arguments: {}
```

**按来源过滤任务**：
```
mcp_call_tool:
  serverName: rebebuca-debug
  toolName: list_tasks
  arguments: {"source": "npm"}
```

**执行特定任务**：
```
mcp_call_tool:
  serverName: rebebuca-debug
  toolName: execute_task
  arguments: {"taskId": "task-xxx-xxx"}
```

### 5. 常见调试场景

#### 检查应用错误
1. 调用 `get_all_debug_info` 获取全部调试信息
2. 检查 `frontend_logs` 中的 `error` 和 `warn` 级别日志
3. 检查 `tauri_logs` 中的错误信息

#### 分析 UI 结构
1. 调用 `get_dom_tree` 获取 DOM 结构
2. 使用 `maxDepth` 和 `maxChildren` 参数控制返回深度

#### 测试任务执行
1. 调用 `list_tasks` 查看可用任务
2. 找到目标任务的 `taskId`
3. 调用 `execute_task` 执行任务
4. 观察前端日志和 Tauri 日志查看执行结果

### 6. 清理

调试完成后：

1. 关闭 Tauri 应用窗口，或在终端按 Ctrl+C 停止 `tauri:dev`
2. 如需强制停止，执行：
   ```bash
   lsof -ti :3001 | xargs kill -9 2>/dev/null || true
   ```

## MCP 服务器配置

MCP 服务器配置位于项目根目录的 `mcp-server-config.json`：

```json
{
  "mcpServers": {
    "rebebuca-debug": {
      "url": "http://127.0.0.1:3001/mcp/sse",
      "description": "Rebebuca Debug MCP Server - provides access to frontend logs, Tauri logs, DOM tree, task list, and task execution"
    }
  }
}
```

## 故障排除

### MCP 服务无法连接

1. 确认 Tauri 应用已启动且窗口可见
2. 检查端口 3001 是否在监听：`lsof -i :3001`
3. 尝试访问健康检查端点：`curl http://127.0.0.1:3001/health`

### 获取不到日志

1. 确保前端页面已完全加载
2. 日志是从应用启动时开始收集的，如需测试特定功能，先执行操作再获取日志

### 任务执行失败

1. 确认 `taskId` 正确（通过 `list_tasks` 获取）
2. 检查任务的工作目录是否正确
3. 查看 Tauri 日志获取详细错误信息
