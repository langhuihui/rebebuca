# Rebebuca AI 协作功能架构

## 概述

Rebebuca 的 AI 协作功能采用**多层架构**设计，实现了直接与 LLM API 通信，绕过 CLI 工具，获得更好的控制和结构化数据。

## 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 UI (Vue 3 + Pinia)                 │
│  AICollabPanelNative.vue / DualAgentPanel.vue              │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                  AI 服务层 (TypeScript)                     │
│  src/services/ai/ - 直接调用 LLM API，绕过 CLI              │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│               Tauri 后端 (Rust) + MCP 服务器                 │
│  mcp_http_server.rs - 提供调试工具和资源订阅                 │
└─────────────────────────────────────────────────────────────┘
```

## 目录结构

```
/Users/dexter/project/rebebuca/
├── src/services/ai/              # 核心 AI 服务层 (TypeScript)
│   ├── index.ts                  # 统一导出
│   ├── types.ts                  # 类型定义
│   ├── agents/                   # 双 Agent 系统
│   │   ├── BaseAgent.ts          # Agent 基类
│   │   ├── SupervisorAgent.ts    # 监工 Agent
│   │   ├── WorkerAgent.ts        # 工人 Agent
│   │   ├── DualAgentOrchestrator.ts  # 双 Agent 编排器
│   │   ├── prompts.ts            # 系统提示词
│   │   └── types.ts              # Agent 类型定义
│   ├── provider/                 # 多模型提供商支持
│   │   ├── index.ts              # 统一 Provider 接口
│   │   └── models.ts             # 模型配置
│   ├── tools/                    # 工具系统
│   │   ├── bash.ts, read.ts, write.ts, edit.ts, glob.ts, grep.ts, debug.ts
│   ├── session/                  # 会话管理
│   ├── stream/                   # 流式响应处理
│   ├── permission/               # 权限管理
│   └── utils/                    # 工具函数
│
├── src/stores/                   # Pinia 状态管理
│   ├── aiCollabNative.ts         # Native AI 协作 Store
│   ├── aiTools.ts                # AI 工具管理 Store
│   ├── dualAgent.ts              # 双 Agent Store
│   └── supervisorAI.ts           # 监工 AI Store
│
├── src/components/               # Vue UI 组件
│   ├── AICollabPanelNative.vue   # Native AI 协作面板
│   ├── DualAgentPanel.vue        # 双 Agent 对话面板
│   └── settings/
│       ├── AIToolsPanel.vue      # AI 工具设置面板
│       └── MCPPanel.vue          # MCP 配置面板
│
├── src-tauri/src/                # Rust 后端 (Tauri)
│   ├── mcp_http_server.rs        # MCP HTTP/SSE 服务器实现
│   └── mcp_server.rs             # MCP 服务管理 (已废弃)
│
├── remote-agent/                 # 远程 Agent (Rust 独立可执行文件)
│   └── src/main.rs               # 通过 stdin/stdout 执行命令
│
├── remote-agent-server/          # 远程 Agent 服务器 (Rust)
│   └── src/
│       ├── main.rs               # WebSocket API 服务器
│       ├── adapters/             # 终端/文件系统/存储适配器
│       ├── handlers/             # HTTP/WebSocket 处理器
│       └── auth/                 # 认证中间件
│
├── common/                       # 共享 Rust 库
│   └── src/types.rs              # AgentMessage 等共享类型
│
└── server/                       # Web 服务端 (Next.js)
    └── app/api/                  # API 路由
```

## 多模型提供商支持

| 提供商 | 模型示例 | 特点 |
|--------|----------|------|
| **Anthropic** | Claude Sonnet 4, Claude 3.5 Sonnet/Haiku | 主力模型 |
| **OpenAI** | GPT-4o, o1, o1-mini | 强大的推理能力 |
| **Google** | Gemini 2.0 Flash, Gemini 1.5 Pro | 超长上下文 (2M tokens) |
| **DeepSeek** | deepseek-chat, deepseek-reasoner | 国产模型 |
| **智谱 GLM** | GLM-4 Plus, GLM-4 | 国产模型 |
| **Moonshot Kimi** | moonshot-v1-128k | 长上下文国产模型 |
| **OpenCode Zen** | gpt-5-nano, big-pickle | 免费网关 |
| **Custom** | 自定义 | OpenAI 兼容 API |

## 工具系统

**内置工具** (`src/services/ai/tools/`):

| 工具 | 功能 |
|------|------|
| `read` | 读取文件内容（支持分页） |
| `write` | 创建或覆盖文件 |
| `edit` | 编辑文件（模糊匹配） |
| `bash` | 执行 shell 命令 |
| `glob` | 文件模式搜索 |
| `grep` | 内容搜索 |
| `debug` | 调试工具 |

## 双 Agent 协作架构 (Supervisor-Worker)

```
┌─────────────────────────────────────────────────────────────┐
│                  DualAgentOrchestrator                      │
│  (协调监工和工人之间的交互，管理任务循环)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
┌────────▼────────┐            ┌─────────▼─────────┐
│ SupervisorAgent │◄──────────►│   WorkerAgent     │
│   (监工)        │   对话     │    (工人)         │
├─────────────────┤            ├───────────────────┤
│ • 分解任务      │            │ • 执行具体操作    │
│ • 下达指令      │            │ • 使用工具        │
│ • 评估结果      │            │ • 汇报结果        │
│ • 决策终止      │            │                   │
└─────────────────┘            └─────────┬─────────┘
                                         │
                               ┌─────────▼─────────┐
                               │   Tool System     │
                               │ (read/write/bash) │
                               └───────────────────┘
```

### 工作流程

1. 用户设定任务目标 (`TaskGoal`) 和完成标准 (`acceptanceCriteria`)
2. Supervisor 分析任务，分解为可执行步骤
3. Supervisor 给 Worker 下达具体指令
4. Worker 使用工具执行操作，返回执行报告
5. Supervisor 评估结果，决定继续/重试/完成/放弃
6. 循环直到任务完成或达到最大轮次

## MCP (Model Context Protocol) 实现

### MCP HTTP 服务器 (`src-tauri/src/mcp_http_server.rs`)

**功能**: 在 Tauri 应用内运行的 MCP 服务器，支持 HTTP + SSE

**提供的工具**:
- `get_frontend_logs`: 获取前端控制台日志
- `get_dom_tree`: 获取 DOM 树结构
- `get_task_list`: 获取任务列表
- `execute_task`: 执行指定任务

**资源订阅**:
- `log://rebebuca/frontend`: 前端日志资源
- `debug://rebebuca/dom`: DOM 树资源

### MCP 配置 (`mcp-server-config.json`)

```json
{
  "mcpServers": {
    "rebebuca-debug": {
      "url": "http://127.0.0.1:3001/mcp/sse",
      "description": "Rebebuca Debug MCP Server"
    }
  }
}
```

## Remote Agent 系统

### Remote Agent (`remote-agent/`)

**用途**: 轻量级 Rust 可执行文件，通过 SSH 部署到远程服务器执行命令

**通信协议** (`AgentMessage`):
- `Execute`: 执行命令请求
- `Output`: 命令输出 (stdout/stderr)
- `ProcessStarted`: 进程启动通知
- `ProcessFinished`: 进程结束通知
- `Ping/Pong`: 心跳检测
- `GetVersion/Version`: 版本查询

### Remote Agent Server (`remote-agent-server/`)

**用途**: WebSocket API 服务器，为 Web 前端提供远程终端和文件管理功能

**适配器**:
- `TerminalAdapter`: 终端管理
- `FileSystemAdapter`: 文件系统操作
- `SystemAdapter`: 系统信息
- `StorageAdapter`: 数据存储

## 前端 UI 组件

| 组件 | 功能 |
|------|------|
| `AICollabPanelNative.vue` | Native AI 协作面板，显示对话、工具调用、流式响应 |
| `DualAgentPanel.vue` | 双 Agent 对话面板，显示 Supervisor-Worker 交互 |
| `AIToolsPanel.vue` | AI 工具设置（安装、版本检查、配置） |
| `MCPPanel.vue` | MCP 服务器配置面板 |
| `DualAgentCreateDialog.vue` | 创建双 Agent 任务的对话框 |

## 设计目标

- 绕过 CLI 工具，直接与 AI 模型 API 通信
- 解决终端 IO 解析复杂和延迟问题
- 获取结构化数据（token 使用量、工具调用详情）
- 精细控制 system prompt、工具集、模型参数

## 关键配置文件

| 文件 | 用途 |
|------|------|
| `mcp-server-config.json` | MCP 服务器配置 |
| `mcp-config-example.json` | MCP 配置示例 |
| `remote-agent-server/config.example.toml` | Remote Server 配置示例 |
