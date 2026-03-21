# Rebebuca AI 协作功能架构

## 概述

Rebebuca 的 AI 协作功能采用**多层架构**设计，实现了直接与 LLM API 通信，绕过 CLI 工具，获得更好的控制和结构化数据。

## 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 UI (Vue 3 + Pinia / Nuxt)           │
│  AICollabPanelNative.vue / DualAgentPanel.vue              │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                  AI 服务层 (TypeScript)                     │
│  src/services/ai/ - 直接调用 LLM API，绕过 CLI              │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│               Node 后端 (node-server) + WebSocket API        │
│  静态资源 + /ws，本地或远程部署同一套 node-server            │
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
├── app/                          # Nuxt 3 应用 (静态构建输出到 dist/server)
│   └── pages/                    # 页面路由
│
├── node-server/                  # Node 后端 (本地/远程通用)
│   ├── server.js                 # HTTP + WebSocket API
│   └── handlers/                 # 终端 (node-pty)、文件系统、存储、SSH (ssh2) 等
│       └── ssh.js                # WebSocket `ssh.*`：远程执行命令，流式输出走 terminal 事件
│
└── server/                       # Web 服务端 (Next.js，独立项目)
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

MCP 相关配置与工具仍通过 `mcp-server-config.json` 等配置，与前端/Node 后端协作。

## 远程与本地运行

- **本地**: `npx rebebuca` 启动 node-server，提供静态 UI 与 WebSocket API。
- **远程 UI + 后端**: 将同一套 node-server + `dist/server` 部署到机器 A；浏览器可连该地址的 `/ws`。本地任务、终端 PTY 在 **运行 node-server 的那台机器** 上执行。
- **SSH 远程任务**: 在设置里配置 SSH 后，由 **node-server 进程** 使用 `ssh2` 连接目标主机并在远端执行 shell 命令；输出经 `terminal.data` / `terminal.exit` 推到前端终端。私钥路径、密码、主机指纹等均以 **服务器进程所在环境** 为准（不是浏览器所在机器）。

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
