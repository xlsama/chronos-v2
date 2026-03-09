# Chronos v2 — TypeScript/Mastra 架构设计

## 1. 迁移决策

### 为什么全量迁移（而非混合部署）

| 因素 | 判断 |
|------|------|
| 后端代码量 | ~2900 行 Python，Phase 1（CRUD + stub），迁移成本低 |
| Agent 实现 | 13 个节点中大部分是 stub，几乎不需要"迁移"而是"重写" |
| 前端状态 | 零功能页面，只有 shadcn 组件库，等于 greenfield |
| 全栈统一 | TypeScript 全栈消除前后端类型不一致，共享 Zod schema |
| 运维复杂度 | 单语言栈 = 1 套构建工具、1 套依赖管理、1 套 CI/CD |

### 技术选型

| 层 | 当前（Python） | 迁移后（TypeScript） |
|----|---------------|---------------------|
| API 框架 | FastAPI | **Hono**（Mastra 内置） + 自定义路由 |
| ORM | SQLAlchemy async | **Drizzle ORM**（类型安全、轻量） |
| Agent 框架 | LangGraph | **Mastra**（workflow + agent） |
| LLM 调用 | LangChain | **AI SDK 6**（Mastra 内置） |
| 工具协议 | 自定义 LangChain tools | **MCP** + Mastra createTool |
| 数据库 | PostgreSQL + asyncpg | PostgreSQL + **@mastra/pg** + Drizzle |
| 缓存/PubSub | redis.asyncio | **ioredis** / Mastra EventEmitter |
| 向量搜索 | 未实现 | **PgVector**（@mastra/pg） |
| 认证 | JWT (pyjwt) | **Better Auth** 或 jose |
| 验证 | Pydantic v2 | **Zod**（前后端共享） |
| 包管理 | uv | **pnpm** workspaces |
| 构建 | - | **Turborepo** |

---

## 2. Monorepo 结构

```
chronos-v2/
├── package.json                    # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json                      # Turborepo 配置
├── docker-compose.yml              # PostgreSQL + Redis
├── .env                            # 环境变量
│
├── packages/
│   └── shared/                     # 共享类型和 schema
│       ├── package.json
│       └── src/
│           ├── schemas/            # Zod schemas（前后端共享）
│           │   ├── incident.ts
│           │   ├── runbook.ts
│           │   ├── topology.ts
│           │   ├── user.ts
│           │   ├── webhook.ts
│           │   └── chat.ts
│           ├── types/              # TypeScript 类型
│           │   └── index.ts
│           └── constants/          # 枚举和常量
│               └── index.ts
│
├── apps/
│   ├── backend/                    # Mastra + Hono 后端
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts       # Drizzle ORM 配置
│   │   └── src/
│   │       ├── index.ts            # 入口：Mastra 实例 + 服务启动
│   │       ├── mastra/             # Mastra 核心
│   │       │   ├── index.ts        # Mastra 实例注册
│   │       │   ├── agents/         # Agent 定义
│   │       │   │   └── incident-agent.ts
│   │       │   ├── workflows/      # Workflow 定义
│   │       │   │   ├── incident-workflow.ts    # 主工作流
│   │       │   │   └── steps/                  # 工作流步骤
│   │       │   │       ├── ingest.ts
│   │       │   │       ├── enrich.ts
│   │       │   │       ├── classify.ts
│   │       │   │       ├── retrieve.ts
│   │       │   │       ├── resolve.ts          # plan + execute 合并
│   │       │   │       ├── human-input.ts      # suspend/resume
│   │       │   │       ├── verify.ts
│   │       │   │       └── finalize.ts
│   │       │   └── tools/          # Mastra tools
│   │       │       ├── bash.ts
│   │       │       ├── file-ops.ts
│   │       │       ├── http-fetch.ts
│   │       │       └── index.ts
│   │       ├── mcp/                # MCP Server 配置
│   │       │   ├── mysql-server.ts
│   │       │   ├── grafana-server.ts
│   │       │   └── index.ts
│   │       ├── db/                 # Drizzle ORM
│   │       │   ├── index.ts        # 连接池
│   │       │   ├── schema/         # 表定义
│   │       │   │   ├── users.ts
│   │       │   │   ├── incidents.ts
│   │       │   │   ├── runbooks.ts
│   │       │   │   ├── executions.ts
│   │       │   │   ├── topology.ts
│   │       │   │   ├── ai-providers.ts
│   │       │   │   └── index.ts
│   │       │   └── migrations/     # Drizzle 迁移
│   │       ├── routes/             # 自定义 API 路由
│   │       │   ├── auth.ts
│   │       │   ├── incidents.ts
│   │       │   ├── runbooks.ts
│   │       │   ├── webhooks.ts
│   │       │   ├── chat.ts         # SSE streaming
│   │       │   ├── topology.ts
│   │       │   ├── executions.ts
│   │       │   ├── settings.ts
│   │       │   ├── skills.ts
│   │       │   └── index.ts
│   │       ├── services/           # 业务逻辑
│   │       │   ├── incident.ts
│   │       │   ├── webhook.ts
│   │       │   ├── runbook.ts
│   │       │   ├── execution.ts
│   │       │   ├── chat.ts         # Redis pub/sub + SSE
│   │       │   └── skill-loader.ts # SKILL.md 解析
│   │       ├── lib/                # 工具函数
│   │       │   ├── auth.ts         # JWT / Better Auth
│   │       │   ├── encryption.ts   # API key 加密
│   │       │   ├── redis.ts        # Redis 客户端
│   │       │   └── logger.ts       # pino / consola
│   │       └── skills/             # SKILL.md 知识文档
│   │           ├── mysql-slow-query/SKILL.md
│   │           ├── redis-memory-analysis/SKILL.md
│   │           └── k8s-pod-crash/SKILL.md
│   │
│   └── frontend/                   # 现有 React 前端（保持）
│       ├── package.json
│       └── src/
│           ├── routes/             # TanStack Router 页面
│           │   ├── _app.tsx                    # 主布局（sidebar）
│           │   ├── _app.index.tsx              # Dashboard
│           │   ├── _app.incidents.tsx           # 事件列表
│           │   ├── _app.incidents.$id.tsx       # 事件详情 + 聊天
│           │   ├── _app.runbooks.tsx            # Runbook 列表
│           │   ├── _app.runbooks.$id.tsx        # Runbook 编辑器
│           │   ├── _app.topology.tsx            # 拓扑图
│           │   ├── _app.skills.tsx              # 技能管理
│           │   ├── _app.settings.tsx            # 设置
│           │   └── login.tsx                    # 登录
│           ├── lib/
│           │   ├── api.ts                      # ofetch 客户端
│           │   └── types.ts                    # 从 @chronos/shared 导入
│           ├── hooks/
│           │   ├── use-incidents.ts             # TanStack Query
│           │   ├── use-runbooks.ts
│           │   ├── use-chat.ts                  # SSE + useChat
│           │   └── use-topology.ts
│           └── components/
│               ├── incidents/
│               ├── runbooks/
│               ├── chat/
│               └── topology/
│
└── skills/                          # SKILL.md 全局目录（可选）
```

---

## 3. 核心架构：事件驱动 Agent

### 3.1 整体流程

```
                         ┌─────────────────────────┐
                         │    External Sources      │
                         │  Alertmanager / PagerDuty │
                         │  Grafana / Custom Hook    │
                         └──────────┬──────────────┘
                                    │ POST /api/webhooks/ingest
                                    ▼
┌───────────────────────────────────────────────────────────────┐
│                    Mastra Backend (Hono)                       │
│                                                               │
│  ┌─────────┐    ┌──────────────────────────────────────────┐  │
│  │ Webhook  │───▶│         Incident Workflow               │  │
│  │ Route    │    │                                          │  │
│  └─────────┘    │  ┌────────┐  ┌────────┐  ┌───────────┐  │  │
│                 │  │ Ingest │─▶│ Enrich │─▶│ Classify  │  │  │
│                 │  └────────┘  └────────┘  └─────┬─────┘  │  │
│                 │                                 │         │  │
│                 │                    ┌────────────┼────┐    │  │
│                 │                    ▼            ▼    │    │  │
│                 │              ┌──────────┐ ┌────────┐│    │  │
│                 │              │ Retrieve │ │ branch ││    │  │
│                 │              │ Runbook  │ │        ││    │  │
│                 │              └────┬─────┘ └────┬───┘│    │  │
│                 │                   │            │     │    │  │
│                 │                   ▼            ▼     │    │  │
│                 │              ┌─────────────────────┐ │    │  │
│                 │              │    Resolve Step     │ │    │  │
│                 │              │  (Agent + Tools)    │ │    │  │
│                 │              │                     │ │    │  │
│                 │              │  ┌───────────────┐  │ │    │  │
│                 │              │  │ Incident Agent│  │ │    │  │
│                 │              │  │ + bash tool   │  │ │    │  │
│                 │              │  │ + file tool   │  │ │    │  │
│                 │              │  │ + MCP tools   │  │ │    │  │
│                 │              │  └───────┬───────┘  │ │    │  │
│                 │              │          │          │ │    │  │
│                 │              │   confident?        │ │    │  │
│                 │              │    yes → execute    │ │    │  │
│                 │              │    no  → suspend    │ │    │  │
│                 │              └──────────┬──────────┘ │    │  │
│                 │                         │            │    │  │
│                 │                   ┌─────▼─────┐     │    │  │
│                 │                   │  Verify   │     │    │  │
│                 │                   └─────┬─────┘     │    │  │
│                 │                         │            │    │  │
│                 │                   ┌─────▼──────┐    │    │  │
│                 │                   │ Finalize   │    │    │  │
│                 │                   │ + Runbook  │    │    │  │
│                 │                   └────────────┘    │    │  │
│                 └────────────────────────────────────┘│    │  │
│                                                       │    │  │
│  ┌──────────────────────────────────────────────────┐ │    │  │
│  │               MCP Servers                         │ │    │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────┐  │ │    │  │
│  │  │ MySQL   │ │ Grafana  │ │  K8s   │ │ Redis │  │ │    │  │
│  │  └─────────┘ └──────────┘ └────────┘ └───────┘  │ │    │  │
│  └──────────────────────────────────────────────────┘ │    │  │
│                                                       │    │  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │    │  │
│  │PostgreSQL│  │  Redis   │  │  PgVector (RAG)  │    │    │  │
│  └──────────┘  └──────────┘  └──────────────────┘    │    │  │
└───────────────────────────────────────────────────────────────┘
                                    │
                                    │ SSE / WebSocket
                                    ▼
                         ┌─────────────────────┐
                         │    React Frontend    │
                         │  Incident Dashboard  │
                         │  Chat Interface      │
                         │  Runbook Editor       │
                         └─────────────────────┘
```

### 3.2 LangGraph 节点 → Mastra 映射

当前 13 个 LangGraph 节点可以精简为 **7 个 Mastra Workflow Step**：

| LangGraph 节点 | Mastra Step | 说明 |
|---------------|-------------|------|
| ingest | `ingest` | 解析 webhook payload，创建 Incident 记录 |
| enrich | `enrich` | 拉取拓扑、集成数据（MCP tools） |
| classify | `classify` | LLM 分类严重度 + 类别（AI SDK structured output） |
| retrieve | `retrieve` | RAG 检索 runbook + skill 匹配（PgVector） |
| decide_mode + plan + execute + observe + replan | `resolve` | **核心：Agent 自主推理循环**，内含 suspend 逻辑 |
| ask_human | `resolve` 内的 `suspend()` | 上下文不足时暂停等用户输入 |
| verify | `verify` | Agent 验证问题是否解决 |
| summarize + finalize | `finalize` | 生成 runbook + 更新状态 |

**为什么精简？** LangGraph 需要显式定义每个节点和路由。Mastra 的 Agent 本身就是一个 tool-calling loop，不需要手动拆分 plan/execute/observe/replan — Agent 自己会循环调用 tools 直到完成。

### 3.3 Incident Workflow 实现

```typescript
// apps/backend/src/mastra/workflows/incident-workflow.ts

import { createWorkflow, createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { incidentAgent } from '../agents/incident-agent'

// ─── Step 1: Ingest ───
const ingestStep = createStep({
  id: 'ingest',
  inputSchema: z.object({
    source: z.string(),
    source_id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    severity: z.string().optional(),
    labels: z.record(z.string()).optional(),
    raw_body: z.any().optional(),
  }),
  outputSchema: z.object({
    incidentId: z.string(),
    summary: z.string(),
    severity: z.string(),
    serviceName: z.string().optional(),
    environment: z.string().optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    // 1. 去重：检查 source + source_id 是否已存在
    // 2. 创建 Incident 记录（Drizzle insert）
    // 3. 提取基本信息
    return {
      incidentId: 'uuid',
      summary: inputData.title,
      severity: inputData.severity ?? 'medium',
      serviceName: inputData.labels?.service,
      environment: inputData.labels?.env,
    }
  },
})

// ─── Step 2: Enrich ───
const enrichStep = createStep({
  id: 'enrich',
  inputSchema: z.object({
    incidentId: z.string(),
    summary: z.string(),
    severity: z.string(),
    serviceName: z.string().optional(),
    environment: z.string().optional(),
  }),
  outputSchema: z.object({
    incidentId: z.string(),
    summary: z.string(),
    severity: z.string(),
    context: z.object({
      topology: z.array(z.any()),
      recentLogs: z.string().optional(),
      metrics: z.any().optional(),
    }),
  }),
  execute: async ({ inputData, mastra }) => {
    // 1. 查询 topology（Drizzle: service + dependencies）
    // 2. 通过 MCP 拉取 Grafana metrics / MySQL status
    // 3. 组装上下文
    return {
      ...inputData,
      context: {
        topology: [],  // service dependency graph
        recentLogs: '', // from log system
        metrics: null,  // from grafana
      },
    }
  },
})

// ─── Step 3: Classify（LLM structured output）───
const classifyStep = createStep({
  id: 'classify',
  inputSchema: z.object({
    incidentId: z.string(),
    summary: z.string(),
    severity: z.string(),
    context: z.any(),
  }),
  outputSchema: z.object({
    incidentId: z.string(),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    category: z.string(),
    confidence: z.number(),
    context: z.any(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent('incident-agent')
    // 用 AI SDK structured output 做分类
    const result = await agent.generate(
      `Classify this incident:\n${inputData.summary}\nContext: ${JSON.stringify(inputData.context)}`,
      {
        output: z.object({
          severity: z.enum(['critical', 'high', 'medium', 'low']),
          category: z.string().describe('e.g. database, network, k8s, application'),
          confidence: z.number().min(0).max(1),
        }),
      }
    )
    return {
      incidentId: inputData.incidentId,
      severity: result.object.severity,
      category: result.object.category,
      confidence: result.object.confidence,
      context: inputData.context,
    }
  },
})

// ─── Step 4: Retrieve（RAG + Skill 匹配）───
const retrieveStep = createStep({
  id: 'retrieve',
  inputSchema: z.object({
    incidentId: z.string(),
    severity: z.string(),
    category: z.string(),
    confidence: z.number(),
    context: z.any(),
  }),
  outputSchema: z.object({
    incidentId: z.string(),
    severity: z.string(),
    category: z.string(),
    confidence: z.number(),
    context: z.any(),
    matchedSkill: z.string().optional(),  // SKILL.md content
    matchedRunbooks: z.array(z.any()),    // past solutions
  }),
  execute: async ({ inputData, mastra }) => {
    // 1. Skill 匹配（category + tags）
    // 2. PgVector 语义检索匹配的 Runbook
    // 3. 组装知识上下文
    return {
      ...inputData,
      matchedSkill: null,
      matchedRunbooks: [],
    }
  },
})

// ─── Step 5: Resolve（Agent 自主推理 + Human-in-the-loop）───
const resolveStep = createStep({
  id: 'resolve',
  inputSchema: z.object({
    incidentId: z.string(),
    severity: z.string(),
    category: z.string(),
    confidence: z.number(),
    context: z.any(),
    matchedSkill: z.string().optional(),
    matchedRunbooks: z.array(z.any()),
  }),
  outputSchema: z.object({
    incidentId: z.string(),
    resolution: z.string(),
    steps: z.array(z.object({
      action: z.string(),
      result: z.string(),
      tool: z.string().optional(),
    })),
    mode: z.enum(['automatic', 'semi_automatic']),
  }),
  // suspend/resume schema for human-in-the-loop
  suspendSchema: z.object({
    reason: z.string(),
    question: z.string(),
    currentContext: z.any(),
  }),
  resumeSchema: z.object({
    userMessage: z.string(),
    additionalContext: z.any().optional(),
  }),
  execute: async ({ inputData, resumeData, suspend, mastra }) => {
    const agent = mastra.getAgent('incident-agent')

    // 构建 system prompt
    const systemPrompt = buildResolvePrompt({
      skill: inputData.matchedSkill,
      runbooks: inputData.matchedRunbooks,
      context: inputData.context,
      resumeContext: resumeData,  // 用户补充的上下文
    })

    // Agent 自主推理 + tool calling loop
    const result = await agent.generate(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Resolve incident: ${inputData.category} - severity ${inputData.severity}` },
        // 如果是 resume，追加用户消息
        ...(resumeData ? [{ role: 'user', content: resumeData.userMessage }] : []),
      ],
      { maxSteps: 20 }
    )

    // 判断是否需要人工介入
    if (result.text.includes('[NEED_HUMAN_INPUT]')) {
      return await suspend({
        reason: 'Agent needs more context',
        question: extractQuestion(result.text),
        currentContext: { steps: extractSteps(result) },
      })
    }

    return {
      incidentId: inputData.incidentId,
      resolution: result.text,
      steps: extractSteps(result),
      mode: inputData.confidence > 0.8 ? 'automatic' : 'semi_automatic',
    }
  },
})

// ─── Step 6: Verify ───
const verifyStep = createStep({
  id: 'verify',
  inputSchema: z.object({
    incidentId: z.string(),
    resolution: z.string(),
    steps: z.array(z.any()),
    mode: z.string(),
  }),
  outputSchema: z.object({
    incidentId: z.string(),
    verified: z.boolean(),
    resolution: z.string(),
    steps: z.array(z.any()),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent('incident-agent')
    // Agent 用 tools 验证修复是否生效
    const result = await agent.generate(
      `Verify the following resolution was successful:\n${inputData.resolution}\nSteps taken: ${JSON.stringify(inputData.steps)}`,
      { maxSteps: 5 }
    )
    return {
      ...inputData,
      verified: !result.text.includes('[NOT_RESOLVED]'),
    }
  },
})

// ─── Step 7: Finalize（生成 Runbook + 更新状态）───
const finalizeStep = createStep({
  id: 'finalize',
  inputSchema: z.object({
    incidentId: z.string(),
    verified: z.boolean(),
    resolution: z.string(),
    steps: z.array(z.any()),
  }),
  outputSchema: z.object({
    incidentId: z.string(),
    status: z.string(),
    runbookId: z.string().optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent('incident-agent')

    // 1. LLM 生成 Runbook markdown
    const runbookResult = await agent.generate(
      `Generate a runbook in markdown from these resolution steps:\n${JSON.stringify(inputData.steps)}`,
      {
        output: z.object({
          title: z.string(),
          content: z.string(),
          steps: z.array(z.object({
            title: z.string(),
            description: z.string(),
            command: z.string().optional(),
          })),
        }),
      }
    )

    // 2. 保存 Runbook 到 DB（Drizzle insert）
    // 3. 更新 Incident 状态为 resolved
    // 4. 创建 Execution 记录
    // 5. 向量化 Runbook 存入 PgVector（供未来 RAG 检索）

    return {
      incidentId: inputData.incidentId,
      status: inputData.verified ? 'resolved' : 'needs_attention',
      runbookId: 'generated-uuid',
    }
  },
})

// ─── 组装 Workflow ───
export const incidentWorkflow = createWorkflow({
  id: 'incident-workflow',
  inputSchema: z.object({
    source: z.string(),
    source_id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    severity: z.string().optional(),
    labels: z.record(z.string()).optional(),
    raw_body: z.any().optional(),
  }),
  outputSchema: z.object({
    incidentId: z.string(),
    status: z.string(),
    runbookId: z.string().optional(),
  }),
})
  .then(ingestStep)
  .then(enrichStep)
  .then(classifyStep)
  .then(retrieveStep)
  .then(resolveStep)       // 包含 suspend/resume
  .then(verifyStep)
  .then(finalizeStep)
  .commit()
```

### 3.4 Incident Agent 定义

```typescript
// apps/backend/src/mastra/agents/incident-agent.ts

import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { PostgresStore, PgVector } from '@mastra/pg'
import { bashTool, fileReadTool, fileWriteTool, httpFetchTool } from '../tools'

const memory = new Memory({
  storage: new PostgresStore({ connectionString: process.env.DATABASE_URL! }),
  vector: new PgVector({ connectionString: process.env.DATABASE_URL! }),
  options: {
    lastMessages: 20,
    semanticRecall: { topK: 5, messageRange: 2 },
  },
  embedder: openai.embedding('text-embedding-3-small'),
})

export const incidentAgent = new Agent({
  id: 'incident-agent',
  name: 'Chronos Incident Agent',
  instructions: async ({ context }) => {
    // 动态组装 system prompt
    return `You are Chronos, an AI-powered incident management agent.

## Your Capabilities
- Execute bash commands on target hosts to diagnose issues
- Read and write files for configuration changes
- Fetch HTTP endpoints for health checks and metrics
- Access MySQL, Grafana, Redis via MCP tools

## Rules
1. Always explain your reasoning before executing commands
2. For destructive operations (restart, delete), output [NEED_HUMAN_INPUT] and ask for confirmation
3. If you lack context to proceed, output [NEED_HUMAN_INPUT] with a specific question
4. After resolving, verify the fix by checking the affected service
5. Keep a log of all actions taken for runbook generation

## Current Context
${context?.skill || 'No matching skill found'}
${context?.runbooks?.length ? `\nRelevant runbooks:\n${context.runbooks.map(r => r.content).join('\n---\n')}` : ''}
`
  },
  model: openai('gpt-4o'),  // 支持动态切换：anthropic('claude-sonnet-4-6')
  tools: {
    bashTool,
    fileReadTool,
    fileWriteTool,
    httpFetchTool,
    // MCP tools 动态注入
  },
  memory,
})
```

### 3.5 Tools 实现

```typescript
// apps/backend/src/mastra/tools/bash.ts

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

const BLACKLIST = ['rm -rf /', 'mkfs', 'dd if=', ':(){ :|:& };:']

export const bashTool = createTool({
  id: 'bash',
  description: 'Execute a shell command. Use for diagnostics, checking logs, restarting services, etc.',
  inputSchema: z.object({
    command: z.string().describe('The bash command to execute'),
    timeout: z.number().optional().default(60000).describe('Timeout in ms'),
  }),
  outputSchema: z.object({
    stdout: z.string(),
    stderr: z.string(),
    exitCode: z.number(),
  }),
  execute: async ({ command, timeout }) => {
    // 安全检查
    if (BLACKLIST.some(b => command.includes(b))) {
      return { stdout: '', stderr: `Blocked: dangerous command`, exitCode: 1 }
    }
    try {
      const { stdout, stderr } = await execAsync(command, { timeout })
      return { stdout, stderr, exitCode: 0 }
    } catch (err: any) {
      return {
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? err.message,
        exitCode: err.code ?? 1,
      }
    }
  },
})
```

### 3.6 MCP Integration（简洁设计）

```typescript
// apps/backend/src/mcp/index.ts

import { MCPClient } from '@mastra/mcp'

export const mcpClient = new MCPClient({
  servers: {
    // MySQL：查询慢查询、表状态、进程列表
    mysql: {
      command: 'npx',
      args: ['-y', '@anthropic/mcp-mysql'],
      env: {
        MYSQL_HOST: process.env.MYSQL_HOST!,
        MYSQL_USER: process.env.MYSQL_USER!,
        MYSQL_PASSWORD: process.env.MYSQL_PASSWORD!,
      },
    },
    // Grafana：查询面板、告警、metrics
    grafana: {
      url: new URL(process.env.GRAFANA_MCP_URL!),
      requestInit: {
        headers: { Authorization: `Bearer ${process.env.GRAFANA_API_KEY}` },
      },
    },
    // 用户自定义 MCP（通过 Settings 页面配置）
    // 运行时动态加载
  },
  timeout: 30_000,
})

// 导出所有 MCP tools 供 Agent 使用
export const getMcpTools = () => mcpClient.listTools()
```

---

## 4. 数据库设计（Drizzle ORM）

保持与当前 SQLAlchemy 模型一致的 12 张表，用 Drizzle 重写：

```typescript
// apps/backend/src/db/schema/incidents.ts

import { pgTable, uuid, text, varchar, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const severityEnum = pgEnum('severity', ['critical', 'high', 'medium', 'low'])
export const incidentStatusEnum = pgEnum('incident_status', [
  'new', 'triaging', 'in_progress', 'waiting_human', 'resolved', 'closed'
])
export const processingModeEnum = pgEnum('processing_mode', ['automatic', 'semi_automatic'])

export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  source: varchar('source', { length: 100 }).notNull(),
  sourceId: varchar('source_id', { length: 255 }).notNull(),
  severity: severityEnum('severity').default('medium').notNull(),
  status: incidentStatusEnum('status').default('new').notNull(),
  processingMode: processingModeEnum('processing_mode'),
  category: varchar('category', { length: 100 }),
  serviceId: uuid('service_id').references(() => services.id),
  environmentId: uuid('environment_id').references(() => environments.id),
  threadId: varchar('thread_id', { length: 255 }),  // Mastra workflow run ID
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  assignedToId: uuid('assigned_to_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ... 其他表类似
```

### 迁移策略

**选项 A（推荐）：重新建表**
- 当前数据库只有开发数据，可以 `drizzle-kit push` 直接创建
- schema 与 SQLAlchemy 版本保持一致

**选项 B：渐进迁移**
- 如果有生产数据，用 `drizzle-kit introspect` 从现有 PG 生成 Drizzle schema
- 逐步替换查询层

---

## 5. 实时通信（SSE Streaming）

### 方案：Mastra Workflow Streaming + Redis PubSub

```typescript
// apps/backend/src/routes/chat.ts

import { registerApiRoute } from '@mastra/core/server'
import { redis } from '../lib/redis'

// SSE 流式端点
registerApiRoute('/chat/stream/:incidentId', {
  method: 'GET',
  handler: async (c) => {
    const incidentId = c.req.param('incidentId')

    return new Response(
      new ReadableStream({
        async start(controller) {
          const subscriber = redis.duplicate()
          await subscriber.subscribe(`incident:${incidentId}:events`)

          subscriber.on('message', (channel, message) => {
            controller.enqueue(`data: ${message}\n\n`)
          })

          // 清理
          c.req.raw.signal.addEventListener('abort', () => {
            subscriber.unsubscribe()
            subscriber.quit()
            controller.close()
          })
        },
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      }
    )
  },
})

// Workflow 执行时发布事件
// 在每个 step 的 execute 中:
await redis.publish(`incident:${incidentId}:events`, JSON.stringify({
  type: 'step_start',
  step: 'classify',
  timestamp: Date.now(),
}))
```

---

## 6. Human-in-the-Loop 完整流程

```
                          全自动模式
                         ┌──────────┐
                         │          │
  Event ──▶ Workflow ──▶ Resolve ──▶ Verify ──▶ Finalize ──▶ Done
                         │   Agent loops with tools   │
                         │   (maxSteps: 20)           │
                         │                            │
                         │  半自动模式                  │
                         │                            │
                         └──── suspend() ─────────────┘
                                   │
                                   ▼
                         ┌──────────────────┐
                         │  SSE: suspended  │──▶ 前端显示聊天界面
                         │  question: "..." │    用户输入上下文
                         └──────────────────┘
                                   │
                          POST /chat/send
                                   │
                                   ▼
                         ┌──────────────────┐
                         │  run.resume({    │
                         │    step: resolve │
                         │    resumeData:   │
                         │      userMessage │
                         │  })             │
                         └────────┬─────────┘
                                  │
                                  ▼
                         Resolve 继续执行
                         （带上用户补充的上下文）
```

**前端交互**:

```typescript
// frontend: hooks/use-chat.ts

export function useIncidentChat(incidentId: string) {
  const [events, setEvents] = useState<SSEEvent[]>([])
  const [suspended, setSuspended] = useState<SuspendInfo | null>(null)

  // 订阅 SSE
  useEffect(() => {
    const es = new EventSource(`/api/chat/stream/${incidentId}`)
    es.onmessage = (e) => {
      const event = JSON.parse(e.data)
      setEvents(prev => [...prev, event])
      if (event.type === 'suspended') {
        setSuspended(event.data)
      }
    }
    return () => es.close()
  }, [incidentId])

  // 发送消息（resume workflow）
  const send = async (message: string) => {
    await ofetch(`/api/chat/send`, {
      method: 'POST',
      body: { incidentId, message },
    })
    setSuspended(null)
  }

  return { events, suspended, send }
}
```

---

## 7. Skill 系统（保持不变）

Skill 系统的文件式设计与 Mastra 完美兼容：

```typescript
// apps/backend/src/services/skill-loader.ts

import matter from 'gray-matter'
import { glob } from 'fast-glob'
import { readFile } from 'node:fs/promises'

interface SkillMeta {
  name: string
  description: string
  category: string
  tags: string[]
  riskLevel: string
  path: string
}

export class SkillLoader {
  private catalog: SkillMeta[] = []

  async loadCatalog(skillsDir: string) {
    const files = await glob('*/SKILL.md', { cwd: skillsDir })
    this.catalog = await Promise.all(
      files.map(async (f) => {
        const content = await readFile(`${skillsDir}/${f}`, 'utf-8')
        const { data } = matter(content)
        return {
          name: f.split('/')[0],
          description: data.description,
          category: data.category,
          tags: data.tags ?? [],
          riskLevel: data.risk_level ?? 'medium',
          path: `${skillsDir}/${f}`,
        }
      })
    )
  }

  match(category: string, tags?: string[]): SkillMeta[] {
    return this.catalog.filter(s =>
      s.category === category ||
      tags?.some(t => s.tags.includes(t))
    )
  }

  async loadContent(skillName: string): Promise<string> {
    const skill = this.catalog.find(s => s.name === skillName)
    if (!skill) throw new Error(`Skill not found: ${skillName}`)
    return readFile(skill.path, 'utf-8')
  }
}
```

---

## 8. Mastra 实例组装

```typescript
// apps/backend/src/mastra/index.ts

import { Mastra } from '@mastra/core'
import { PostgresStore, PgVector } from '@mastra/pg'
import { registerApiRoute } from '@mastra/core/server'
import { incidentAgent } from './agents/incident-agent'
import { incidentWorkflow } from './workflows/incident-workflow'
import { mcpClient, getMcpTools } from '../mcp'
import { allRoutes } from '../routes'

export const mastra = new Mastra({
  agents: { 'incident-agent': incidentAgent },
  workflows: { 'incident-workflow': incidentWorkflow },
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL!,
  }),
  vectors: {
    pgVector: new PgVector({
      connectionString: process.env.DATABASE_URL!,
    }),
  },
  server: {
    port: 8000,
    apiRoutes: allRoutes,  // 自定义 CRUD 路由
    cors: { origin: ['http://localhost:5173'] },
    build: { swaggerUI: true },
  },
  logger: { level: 'info' },
})
```

---

## 9. 依赖清单

```jsonc
// apps/backend/package.json
{
  "dependencies": {
    // Mastra 核心
    "@mastra/core": "latest",
    "@mastra/memory": "latest",
    "@mastra/pg": "latest",
    "@mastra/rag": "latest",
    "@mastra/mcp": "latest",
    "@mastra/hono": "latest",

    // AI SDK
    "ai": "latest",
    "@ai-sdk/openai": "latest",
    "@ai-sdk/anthropic": "latest",

    // Database
    "drizzle-orm": "latest",
    "postgres": "latest",         // postgres.js driver

    // Cache
    "ioredis": "latest",

    // Utils
    "zod": "latest",
    "gray-matter": "latest",      // SKILL.md frontmatter
    "fast-glob": "latest",
    "jose": "latest",             // JWT
    "bcrypt": "latest",
    "pino": "latest",             // logging

    // Shared
    "@chronos/shared": "workspace:*"
  },
  "devDependencies": {
    "drizzle-kit": "latest",
    "typescript": "latest",
    "vitest": "latest",
    "@types/node": "latest"
  }
}
```

---

## 10. 迁移路线图

### Phase 0: 项目脚手架（1-2 天）
- [ ] 初始化 pnpm monorepo + turborepo
- [ ] 创建 `packages/shared`（Zod schemas）
- [ ] 创建 `apps/backend`（Mastra init）
- [ ] 搬移 `apps/frontend`（现有前端）
- [ ] Docker compose 保持不变（PG + Redis）

### Phase 1: 数据层（2-3 天）
- [ ] Drizzle schema（12 张表 1:1 映射）
- [ ] `drizzle-kit push` 创建表
- [ ] CRUD services（incident, runbook, topology, user, ai-provider）
- [ ] 自定义 API 路由（auth, incidents, runbooks, settings 等）
- [ ] JWT 认证中间件

### Phase 2: Agent 核心（3-5 天）
- [ ] Incident Agent 定义（tools + instructions）
- [ ] Tools 实现（bash, file-ops, http-fetch）
- [ ] Incident Workflow（7 steps）
- [ ] Webhook 入口路由 → trigger workflow
- [ ] Skill Loader 移植

### Phase 3: 实时通信（2-3 天）
- [ ] Redis pub/sub 事件发布
- [ ] SSE streaming 端点
- [ ] Workflow step 执行事件
- [ ] Human-in-the-loop suspend/resume API

### Phase 4: MCP + Integration（2-3 天）
- [ ] MCP Client 配置（MySQL, Grafana）
- [ ] MCP tools 注入到 Agent
- [ ] Settings 页面动态配置 MCP server

### Phase 5: RAG + Runbook（2-3 天）
- [ ] PgVector 设置
- [ ] Runbook 向量化存储
- [ ] Skill 内容向量化
- [ ] Retrieve step 实现语义检索
- [ ] Finalize step 自动生成 Runbook

### Phase 6: 前端功能（5-7 天）
- [ ] API client 接入
- [ ] Incident Dashboard
- [ ] Incident Detail + Chat 界面
- [ ] Runbook 列表 + 编辑器
- [ ] Topology 可视化
- [ ] Settings 页面（AI provider + MCP）
- [ ] Skill 管理页面

### 预估总工期：17-26 天

---

## 11. 与当前 LangGraph 方案的对比

| 维度 | LangGraph (Python) | Mastra (TypeScript) |
|------|-------------------|---------------------|
| 语言统一 | 前后端分离 | 全栈 TypeScript，Zod 共享 |
| Agent Loop | 手动拆 13 个节点 + 路由函数 | Agent 自动 tool loop，Workflow 7 步精简 |
| Human-in-the-loop | `interrupt()` + Command(resume) | `suspend()` + `run.resume()`，Zod 类型安全 |
| 状态持久化 | PostgresSaver checkpoint | Mastra Storage snapshot（自动） |
| MCP | 需自行集成 | `@mastra/mcp` 原生支持 |
| Memory | 未实现 | `@mastra/memory`（4 层：历史、工作记忆、语义、观察） |
| RAG | 未实现 | `@mastra/rag` + PgVector 内置 |
| 扩展性 | 单进程 Python | Node.js cluster / k8s 水平扩展 |
| 可观测性 | 手动日志 | Mastra 内置 OpenTelemetry |
| API 文档 | FastAPI 自动生成 | Swagger UI（Hono + Zod schema） |
| 开发体验 | 好（FastAPI 很棒） | 更好（类型推导 + 前后端一致） |
