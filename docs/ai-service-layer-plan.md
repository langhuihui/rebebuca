# Rebebuca AI 服务层实施计划

> 目标：绕过 CLI 工具，直接与大模型 API 通讯，解决 IO 解析复杂和延迟问题

## 一、背景分析

### 1.1 当前架构的问题

```
当前: User → AICollabPanel → PTY → CLI (claude-code等) → 解析终端输出
目标: User → AICollabPanel → AI Service → 直接API调用 → 结构化响应
```

| 问题 | 描述 |
|------|------|
| IO 解析复杂 | 需要解析 ANSI 转义序列、处理终端输出格式 |
| 无结构化数据 | 无法获取 token 使用量、工具调用详情等元数据 |
| 延迟较高 | CLI 启动开销 + 终端缓冲区延迟 |
| 依赖外部工具 | 用户需要安装 claude-code/codex 等 CLI |
| 无法精细控制 | 无法自定义 system prompt、工具集、模型参数 |

### 1.2 OpenCode 的优势

OpenCode 使用 Vercel AI SDK 直接与大模型通讯：
- **统一抽象**: 支持 20+ 个 AI 提供商
- **流式响应**: 实时获取 text-delta、tool-call 等事件
- **结构化数据**: token 使用量、工具调用结果、推理过程
- **完整工具系统**: bash/read/write/edit/glob/grep 等

---

## 二、技术方案

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Vue 3)                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐                                              │
│  │   AICollabPanel   │  ← 复用现有 UI 组件                           │
│  └────────┬──────────┘                                              │
│           │                                                         │
│  ┌────────┴──────────────────────────────────────────────────────┐  │
│  │                    AI Service Layer (新增)                     │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────┐ │  │
│  │  │  provider/   │ │   stream/    │ │       tools/           │ │  │
│  │  │  (多模型)    │ │  (流式处理)  │ │  (bash/read/write/...) │ │  │
│  │  └──────────────┘ └──────────────┘ └────────────────────────┘ │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────┐ │  │
│  │  │  session/    │ │  message/    │ │     permission/        │ │  │
│  │  │  (会话管理)  │ │  (消息处理)  │ │     (权限控制)         │ │  │
│  │  └──────────────┘ └──────────────┘ └────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────┴───────────────────────────────────┐  │
│  │                      Adapter Layer (复用)                      │  │
│  │      terminal / fs / dialog / storage / system / ...          │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心模块设计

#### 2.2.1 Provider 模块 (`src/services/ai/provider/`)

```typescript
// provider/types.ts
export type ProviderType = 
  | 'anthropic'   // Claude
  | 'openai'      // GPT-4
  | 'google'      // Gemini
  | 'deepseek'    // DeepSeek
  | 'glm'         // 智谱 GLM
  | 'kimi'        // Moonshot Kimi
  | 'custom';     // 自定义 OpenAI 兼容

export interface ProviderConfig {
  type: ProviderType;
  apiKey: string;
  baseUrl?: string;       // 自定义端点
  model: string;          // 模型 ID
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}

// provider/index.ts
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export async function getLanguageModel(config: ProviderConfig): Promise<LanguageModelV2> {
  switch (config.type) {
    case 'anthropic':
      return createAnthropic({ apiKey: config.apiKey })(config.model);
    case 'openai':
      return createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl })(config.model);
    case 'google':
      return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model);
    case 'deepseek':
    case 'glm':
    case 'kimi':
    case 'custom':
      // 使用 OpenAI 兼容模式
      return createOpenAI({ 
        apiKey: config.apiKey, 
        baseURL: config.baseUrl,
        compatibility: 'compatible'
      })(config.model);
  }
}
```

#### 2.2.2 Stream 模块 (`src/services/ai/stream/`)

```typescript
// stream/types.ts
export interface StreamEvent {
  type: 
    | 'text-start'
    | 'text-delta'
    | 'tool-call-start'
    | 'tool-call-delta'
    | 'tool-result'
    | 'finish'
    | 'error';
  data: any;
}

export interface StreamInput {
  sessionId: string;
  messages: Message[];
  model: ProviderConfig;
  tools: Tool[];
  system?: string[];
  abort?: AbortSignal;
}

// stream/index.ts
import { streamText } from 'ai';

export async function* stream(input: StreamInput): AsyncGenerator<StreamEvent> {
  const language = await getLanguageModel(input.model);
  
  const response = streamText({
    model: language,
    messages: input.messages,
    tools: buildTools(input.tools),
    system: input.system?.join('\n'),
    abortSignal: input.abort,
    maxTokens: input.model.options?.maxTokens ?? 8192,
    temperature: input.model.options?.temperature ?? 0.7,
  });

  for await (const event of response.fullStream) {
    yield transformEvent(event);
  }
}
```

#### 2.2.3 Tools 模块 (`src/services/ai/tools/`)

移植 OpenCode 的工具实现，适配 Rebebuca 的 adapter 层：

```
src/services/ai/tools/
├── types.ts          # 工具类型定义
├── registry.ts       # 工具注册表
├── bash.ts          # 命令执行 (使用 adapter.terminal)
├── read.ts          # 文件读取 (使用 adapter.fs)
├── write.ts         # 文件写入 (使用 adapter.fs)
├── edit.ts          # 文件编辑 (多策略模糊匹配)
├── glob.ts          # 文件搜索
├── grep.ts          # 内容搜索
├── webfetch.ts      # 网页抓取
└── task.ts          # 子任务 (spawn sub-agent)
```

**工具定义示例 (read.ts):**

```typescript
import { z } from 'zod';
import { Tool } from './types';
import { getAdapter } from '@/adapters';

export const ReadTool: Tool = {
  id: 'read',
  description: '读取文件内容，支持分页读取大文件',
  parameters: z.object({
    filePath: z.string().describe('要读取的文件路径'),
    offset: z.number().optional().describe('起始行号 (0-based)'),
    limit: z.number().optional().describe('读取行数，默认 2000'),
  }),
  
  async execute(params, ctx) {
    const adapter = await getAdapter();
    const { filePath, offset = 0, limit = 2000 } = params;
    
    // 权限检查
    await ctx.requestPermission({
      type: 'read',
      path: filePath,
    });
    
    // 使用 adapter.fs 读取文件
    const content = await adapter.fs.readFile(filePath);
    const lines = content.split('\n');
    
    // 分页处理
    const slice = lines.slice(offset, offset + limit);
    const formatted = slice.map((line, i) => 
      `${String(offset + i + 1).padStart(5, '0')}| ${line}`
    ).join('\n');
    
    return {
      title: filePath,
      output: formatted,
      metadata: {
        totalLines: lines.length,
        readLines: slice.length,
        truncated: lines.length > offset + limit,
      },
    };
  },
};
```

**工具定义示例 (bash.ts):**

```typescript
import { z } from 'zod';
import { Tool } from './types';
import { getAdapter } from '@/adapters';

export const BashTool: Tool = {
  id: 'bash',
  description: '执行 shell 命令',
  parameters: z.object({
    command: z.string().describe('要执行的命令'),
    cwd: z.string().optional().describe('工作目录'),
    timeout: z.number().optional().describe('超时时间(ms)，默认 120000'),
  }),
  
  async execute(params, ctx) {
    const adapter = await getAdapter();
    const { command, cwd, timeout = 120000 } = params;
    
    // 权限检查
    await ctx.requestPermission({
      type: 'bash',
      command,
    });
    
    // 创建临时 PTY 执行命令
    const ptyInfo = await adapter.terminal.create({
      command,
      cwd: cwd || ctx.projectPath,
      shell: true,
    });
    
    let output = '';
    const unlisten = adapter.terminal.onData((event) => {
      if (event.ptyId === ptyInfo.ptyId) {
        output += event.data;
        // 实时更新 UI
        ctx.updateMetadata({ output: output.slice(-10000) });
      }
    });
    
    // 等待执行完成或超时
    const exitCode = await Promise.race([
      new Promise<number>((resolve) => {
        adapter.terminal.onExit((event) => {
          if (event.ptyId === ptyInfo.ptyId) resolve(event.code);
        });
      }),
      new Promise<number>((_, reject) => {
        setTimeout(() => reject(new Error('Command timeout')), timeout);
      }),
    ]).finally(() => unlisten());
    
    return {
      title: command.slice(0, 50),
      output,
      metadata: { exitCode },
    };
  },
};
```

#### 2.2.4 Session 模块 (`src/services/ai/session/`)

```typescript
// session/types.ts
export interface AISession {
  id: string;
  projectPath: string;
  model: ProviderConfig;
  messages: Message[];
  tools: string[];        // 启用的工具 ID 列表
  system: string[];       // System prompts
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// session/index.ts
export class AISessionManager {
  private sessions = new Map<string, AISession>();
  private abortControllers = new Map<string, AbortController>();
  
  async createSession(config: CreateSessionConfig): Promise<AISession> {
    const session: AISession = {
      id: generateId(),
      projectPath: config.projectPath,
      model: config.model,
      messages: [],
      tools: config.tools ?? ['read', 'write', 'edit', 'bash', 'glob', 'grep'],
      system: await this.buildSystemPrompts(config),
      status: 'idle',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
    this.sessions.set(session.id, session);
    return session;
  }
  
  async runLoop(sessionId: string, userMessage: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    session.status = 'running';
    const abort = new AbortController();
    this.abortControllers.set(sessionId, abort);
    
    // 添加用户消息
    session.messages.push({ role: 'user', content: userMessage });
    
    // 消息循环
    while (session.status === 'running') {
      const tools = await ToolRegistry.getTools(session.tools, session.projectPath);
      
      for await (const event of stream({
        sessionId,
        messages: session.messages,
        model: session.model,
        tools,
        system: session.system,
        abort: abort.signal,
      })) {
        await this.handleEvent(session, event);
      }
      
      // 检查是否需要继续（有 tool-call 结果需要处理）
      const lastMessage = session.messages[session.messages.length - 1];
      if (lastMessage.role === 'assistant' && !lastMessage.toolCalls?.length) {
        session.status = 'completed';
      }
    }
  }
  
  stop(sessionId: string): void {
    const abort = this.abortControllers.get(sessionId);
    if (abort) abort.abort();
    const session = this.sessions.get(sessionId);
    if (session) session.status = 'paused';
  }
}
```

#### 2.2.5 Permission 模块 (`src/services/ai/permission/`)

```typescript
// permission/types.ts
export type PermissionType = 'read' | 'write' | 'bash' | 'external_directory';

export interface PermissionRequest {
  id: string;
  type: PermissionType;
  path?: string;
  command?: string;
  patterns: string[];
}

export type PermissionRule = {
  type: PermissionType;
  pattern: string;
  action: 'allow' | 'deny' | 'ask';
};

// permission/index.ts
export class PermissionManager {
  private rules: PermissionRule[] = [];
  private pending = new Map<string, { resolve: () => void; reject: (err: Error) => void }>();
  
  async request(req: Omit<PermissionRequest, 'id'>): Promise<void> {
    const rule = this.evaluate(req.type, req.patterns);
    
    if (rule.action === 'deny') {
      throw new Error(`Permission denied: ${req.type}`);
    }
    
    if (rule.action === 'allow') {
      return;
    }
    
    // 需要用户确认
    const id = generateId();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      // 发布事件让 UI 显示确认对话框
      eventBus.emit('permission:request', { id, ...req });
    });
  }
  
  reply(id: string, action: 'allow' | 'deny' | 'always'): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    
    if (action === 'deny') {
      pending.reject(new Error('Permission rejected by user'));
    } else {
      if (action === 'always') {
        // 保存规则
        this.addRule({ type: req.type, pattern: '*', action: 'allow' });
      }
      pending.resolve();
    }
    this.pending.delete(id);
  }
}
```

### 2.3 与现有架构的集成

#### 2.3.1 修改 `stores/aiCollab.ts`

```typescript
// 新增 AI Service 模式
export type AgentMode = 'cli' | 'native';  // cli = 现有 PTY 模式, native = 直接 API

interface AgentConfig {
  // ... 现有字段
  mode: AgentMode;
  nativeConfig?: {
    provider: ProviderConfig;
    tools: string[];
  };
}

// startAgent 方法扩展
async startAgent(config: AgentConfig, sessionId: string, workerIndex?: number) {
  if (config.mode === 'native') {
    return this.startNativeAgent(config, sessionId, workerIndex);
  }
  return this.startCliAgent(config, sessionId, workerIndex);
}

async startNativeAgent(config: AgentConfig, sessionId: string, workerIndex?: number) {
  const aiSession = await aiSessionManager.createSession({
    projectPath: this.sessions.get(sessionId)?.projectPath,
    model: config.nativeConfig!.provider,
    tools: config.nativeConfig!.tools,
  });
  
  // 返回 agent 实例，但不需要 ptyId
  return {
    id: config.id,
    config,
    status: 'running',
    aiSessionId: aiSession.id,  // 新增
    workerIndex,
  };
}
```

#### 2.3.2 修改 `AICollabPanel.vue`

```vue
<template>
  <!-- 新增模式选择 -->
  <n-form-item :label="t('aiCollab.agentMode')">
    <n-radio-group v-model:value="agentConfigForm.mode">
      <n-radio value="cli">{{ t('aiCollab.cliMode') }}</n-radio>
      <n-radio value="native">{{ t('aiCollab.nativeMode') }}</n-radio>
    </n-radio-group>
  </n-form-item>
  
  <!-- Native 模式配置 -->
  <template v-if="agentConfigForm.mode === 'native'">
    <n-form-item :label="t('aiCollab.provider')">
      <n-select v-model:value="agentConfigForm.provider" :options="providerOptions" />
    </n-form-item>
    <n-form-item :label="t('aiCollab.apiKey')">
      <n-input v-model:value="agentConfigForm.apiKey" type="password" />
    </n-form-item>
    <n-form-item :label="t('aiCollab.model')">
      <n-select v-model:value="agentConfigForm.model" :options="modelOptions" />
    </n-form-item>
  </template>
</template>
```

---

## 三、依赖管理

### 3.1 新增 NPM 依赖

```json
{
  "dependencies": {
    "ai": "^5.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/google": "^1.0.0",
    "zod": "^3.23.0"
  }
}
```

### 3.2 可选依赖（高级功能）

```json
{
  "optionalDependencies": {
    "tree-sitter": "^0.21.0",
    "tree-sitter-bash": "^0.21.0"
  }
}
```

---

## 四、实施阶段

### Phase 1: 基础框架 (1-2 周)

**目标**: 建立 AI 服务层基础结构，实现简单对话

- [ ] 创建 `src/services/ai/` 目录结构
- [ ] 实现 Provider 模块 (Anthropic + OpenAI)
- [ ] 实现 Stream 模块 (基础流式处理)
- [ ] 实现 Session 模块 (会话管理)
- [ ] 添加 `ai` 和 `@ai-sdk/*` 依赖
- [ ] 创建简单的测试页面验证集成

**交付物**:
- 能够直接与 Claude/GPT-4 进行简单对话
- 流式响应正常显示在 UI 中

### Phase 2: 工具系统 (2-3 周)

**目标**: 移植核心工具，支持代码编辑

- [ ] 实现 Tool 类型定义和注册表
- [ ] 移植 `read` 工具 (适配 adapter.fs)
- [ ] 移植 `write` 工具 (适配 adapter.fs)
- [ ] 移植 `edit` 工具 (包含模糊匹配算法)
- [ ] 移植 `bash` 工具 (适配 adapter.terminal)
- [ ] 移植 `glob` 和 `grep` 工具
- [ ] 实现工具调用 UI (显示工具执行状态)

**交付物**:
- AI 能够读写项目文件
- AI 能够执行 shell 命令
- 工具调用有实时状态反馈

### Phase 3: 权限与安全 (1 周)

**目标**: 实现权限控制机制

- [ ] 实现 Permission 模块
- [ ] 创建权限确认对话框 UI
- [ ] 实现 "总是允许" 规则持久化
- [ ] 实现外部目录访问控制
- [ ] 实现危险命令拦截

**交付物**:
- 敏感操作需要用户确认
- 支持自定义权限规则

### Phase 4: 多 Provider 支持 (1 周)

**目标**: 支持更多模型提供商

- [ ] 添加 DeepSeek 支持
- [ ] 添加智谱 GLM 支持
- [ ] 添加 Kimi 支持
- [ ] 添加自定义 OpenAI 兼容端点支持
- [ ] 实现 API Key 管理 UI

**交付物**:
- 用户可选择多种模型
- API Key 安全存储

### Phase 5: 高级功能 (2 周)

**目标**: 完善用户体验

- [ ] 实现 Task 工具 (子 Agent)
- [ ] 实现 WebFetch 工具
- [ ] 实现上下文压缩 (长对话优化)
- [ ] 实现会话持久化 (保存/恢复)
- [ ] 实现 Token 使用量统计 UI
- [ ] 实现推理过程 (thinking) 显示

**交付物**:
- 支持复杂多步骤任务
- 良好的长对话体验
- 清晰的成本可视化

### Phase 6: 测试与优化 (1 周)

**目标**: 稳定性和性能优化

- [ ] 编写单元测试
- [ ] 压力测试 (长对话、大文件)
- [ ] 错误处理完善
- [ ] 性能优化 (减少重渲染)
- [ ] 文档编写

**交付物**:
- 稳定可靠的 AI 服务层
- 完整的开发文档

---

## 五、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Vercel AI SDK 在 Electron 中的兼容性 | 高 | 早期验证 POC，必要时使用原生 fetch 封装 |
| 工具执行安全风险 | 高 | 严格的权限系统 + 沙箱模式 |
| Token 成本失控 | 中 | 添加成本预估和限制功能 |
| 模糊匹配编辑失败率 | 中 | 移植 OpenCode 的多策略匹配算法 |
| 长对话上下文溢出 | 中 | 实现上下文压缩机制 |

---

## 六、文件结构规划

```
src/
├── services/
│   └── ai/
│       ├── index.ts              # 统一导出
│       ├── provider/
│       │   ├── index.ts          # Provider 管理
│       │   ├── types.ts          # 类型定义
│       │   └── models.ts         # 模型配置
│       ├── stream/
│       │   ├── index.ts          # 流式处理
│       │   └── types.ts
│       ├── session/
│       │   ├── index.ts          # 会话管理
│       │   ├── types.ts
│       │   └── loop.ts           # 消息循环
│       ├── tools/
│       │   ├── index.ts          # 工具注册
│       │   ├── types.ts          # 工具类型
│       │   ├── bash.ts
│       │   ├── read.ts
│       │   ├── write.ts
│       │   ├── edit.ts
│       │   ├── edit-replacers.ts # 模糊匹配算法
│       │   ├── glob.ts
│       │   ├── grep.ts
│       │   ├── webfetch.ts
│       │   └── task.ts
│       ├── permission/
│       │   ├── index.ts          # 权限管理
│       │   └── types.ts
│       └── utils/
│           ├── truncate.ts       # 输出截断
│           └── format.ts         # 格式化工具
├── stores/
│   └── aiCollab.ts               # 修改: 支持 native 模式
├── components/
│   ├── AICollabPanel.vue         # 修改: 新增 native 配置
│   └── AIPermissionDialog.vue    # 新增: 权限确认对话框
└── types/
    └── aiService.ts              # 新增: AI 服务类型定义
```

---

## 七、验收标准

### 功能验收

1. ✓ 能够使用 Claude/GPT-4 直接对话
2. ✓ 能够读取、编辑、创建项目文件
3. ✓ 能够执行 shell 命令
4. ✓ 敏感操作有权限确认
5. ✓ 流式响应实时显示
6. ✓ 工具调用状态可视化
7. ✓ 支持多种模型提供商

### 性能验收

1. ✓ 首字延迟 < 500ms (网络正常情况)
2. ✓ 长对话 (100+ 消息) 不卡顿
3. ✓ 大文件读取 (10MB) 有分页处理

### 兼容性验收

1. ✓ macOS 正常运行
2. ✓ Windows 正常运行
3. ✓ Linux 正常运行

---

## 八、后续扩展

1. **MCP Server 集成**: 支持外部 MCP 工具扩展
2. **Agent 协作**: 多个 AI Agent 并行执行任务
3. **代码库索引**: 向量数据库支持语义搜索
4. **Git 集成**: 自动提交、PR 创建等
5. **测试执行**: 自动运行测试并分析结果
