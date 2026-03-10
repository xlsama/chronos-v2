import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { streamText, stepCountIs, tool, type ModelMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z as z3 } from 'zod'
import { env } from '../env'
import { incidentService } from '../services/incident.service'
import { runbookService } from '../services/runbook.service'
import { skillService } from '../services/skill.service'
import { connectionService } from '../services/connection.service'
import { serviceMapService } from '../services/service-map.service'
import { messageService } from '../services/message.service'
import { publisher, redis, createSubscriber } from '../lib/redis'
import { logger } from '../lib/logger'
import { mcpRegistry } from '../mcp/registry'

const SYSTEM_PROMPT = `# 身份

你是 Chronos，一位资深的 SRE / DevOps 运维专家，精通基础设施管理、故障排查和系统修复。

# 能力

你拥有以下工具：
- **searchSkills / getSkill**：搜索和读取运维方法论知识库
- **searchRunbooks / getRunbook / createRunbook**：搜索、读取、创建运行手册
- **listConnections**：列出已接入的基础设施连接
- **updateIncidentStatus**：更新事件状态
- **getServiceNeighbors**：查询服务上下游依赖

# MCP 工具能力

你可以通过 MCP 工具直接操作已接入的服务：
- 数据库（MySQL/PostgreSQL）：执行 SQL、查看表结构、查看进程
- 缓存（Redis）：执行命令、查看 INFO、搜索 keys
- 日志（Elasticsearch）：搜索日志、查看索引、集群健康
- 容器（Kubernetes）：查看 Pods/日志/事件、查看资源详情、在 Pod 中执行命令
- 监控（Grafana/Prometheus）：查询指标、查看告警、搜索仪表盘

工具名称格式: {服务名}_{操作}，先用 listConnections 查看可用服务。

# 工作流程

1. **分析事件**：阅读标题、描述、严重级别、来源
2. **检索知识**：searchSkills + searchRunbooks（先看摘要，按需深入）
3. **了解环境**：listConnections + getServiceNeighbors
4. **诊断问题**：使用 MCP 工具查询数据库、日志、监控指标等
5. **执行修复**：获取完整 Skill/Runbook 内容，按步骤操作
6. **生成 Runbook**：解决后沉淀为运行手册

# 操作原则

- 先只读诊断（SELECT/GET/查日志），再考虑写操作
- 写操作前向用户说明影响并确认
- DDL（DROP/ALTER/TRUNCATE）禁止执行
- 如果现有工具无法完成诊断，告诉用户需要在哪台机器执行什么命令，请用户提供结果
- 用中文回复用户`

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
  ...(env.OPENAI_BASE_URL && { baseURL: env.OPENAI_BASE_URL }),
})

// AI SDK v6 tools (inputSchema + execute)
const chatTools = {
  searchSkills: tool({
    description: 'Search skill knowledge base. Returns names and summaries.',
    inputSchema: z3.object({
      query: z3.string().optional().describe('Search keyword'),
      category: z3.string().optional().describe('Category filter'),
    }),
    execute: async ({ query, category }) => {
      const results = await skillService.list({ search: query, category })
      return results.map((s) => ({ id: s.id, name: s.name, summary: s.summary, category: s.category, tags: s.tags }))
    },
  }),
  getSkill: tool({
    description: 'Get full skill content by ID.',
    inputSchema: z3.object({ id: z3.string() }),
    execute: async ({ id }) => skillService.getById(id),
  }),
  searchRunbooks: tool({
    description: 'Search past resolution records.',
    inputSchema: z3.object({
      query: z3.string().optional().describe('Search keyword'),
      tags: z3.array(z3.string()).optional().describe('Filter by tags'),
    }),
    execute: async ({ query, tags }) => {
      const results = await runbookService.list({ search: query, tags })
      return results.map((r) => ({
        id: r.id,
        title: r.title,
        tags: r.tags,
        summary: r.content.slice(0, 200) + (r.content.length > 200 ? '...' : ''),
      }))
    },
  }),
  getRunbook: tool({
    description: 'Get full runbook content by ID.',
    inputSchema: z3.object({ id: z3.string() }),
    execute: async ({ id }) => runbookService.getById(id),
  }),
  createRunbook: tool({
    description: 'Create a new runbook.',
    inputSchema: z3.object({
      title: z3.string(),
      content: z3.string(),
      incidentId: z3.string().optional(),
      tags: z3.array(z3.string()).optional(),
    }),
    execute: async (input) => {
      const runbook = await runbookService.create(input)
      return { success: true, id: runbook.id, title: runbook.title }
    },
  }),
  listConnections: tool({
    description: 'List available infrastructure connections.',
    inputSchema: z3.object({}),
    execute: async () => {
      const connections = await connectionService.list()
      return connections.map((c) => ({ id: c.id, name: c.name, type: c.type, status: c.status }))
    },
  }),
  updateIncidentStatus: tool({
    description: 'Update incident status or processing mode.',
    inputSchema: z3.object({
      incidentId: z3.string(),
      status: z3.enum(['new', 'triaging', 'in_progress', 'waiting_human', 'resolved', 'closed']).optional(),
      processingMode: z3.enum(['automatic', 'semi_automatic']).optional(),
    }),
    execute: async ({ incidentId, ...updates }) => {
      const incident = await incidentService.update(incidentId, updates)
      return incident ? { success: true } : { error: 'Incident not found' }
    },
  }),
  getServiceNeighbors: tool({
    description: 'Get upstream/downstream services from service map.',
    inputSchema: z3.object({
      connectionId: z3.string(),
      serviceMapId: z3.string().optional(),
    }),
    execute: async ({ connectionId, serviceMapId }) => {
      let serviceMap
      if (serviceMapId) {
        serviceMap = await serviceMapService.getById(serviceMapId)
      } else {
        const all = await serviceMapService.list()
        serviceMap = all[0]
      }
      if (!serviceMap) return { error: 'No service map found' }
      const graph = serviceMap.graph as { nodes: any[]; edges: any[] }
      const upstream = graph.edges
        .filter((e: any) => e.target === connectionId)
        .map((e: any) => ({
          id: e.source,
          label: graph.nodes.find((n: any) => n.id === e.source)?.data?.label || e.source,
        }))
      const downstream = graph.edges
        .filter((e: any) => e.source === connectionId)
        .map((e: any) => ({
          id: e.target,
          label: graph.nodes.find((n: any) => n.id === e.target)?.data?.label || e.target,
        }))
      return { connectionId, upstream, downstream }
    },
  }),
}

export const chatRoutes = new Hono()
  .post(
    '/',
    zValidator(
      'json',
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(['user', 'assistant', 'system']),
            content: z.string(),
          }),
        ),
        threadId: z.string().optional(),
        incidentId: z.string().optional(),
      }),
    ),
    async (c) => {
      const { messages, incidentId } = c.req.valid('json')
      const threadId = c.req.valid('json').threadId ?? crypto.randomUUID()

      // Save user message
      const lastMessage = messages[messages.length - 1]
      if (lastMessage?.role === 'user') {
        await messageService.create({
          threadId,
          ...(incidentId && { incidentId }),
          role: 'user',
          content: lastMessage.content,
        })
      }

      // Merge static tools with dynamic MCP tools
      const mcpTools = mcpRegistry.getAllToolsAsAISDK()
      const allTools = { ...chatTools, ...mcpTools }

      const result = streamText({
        model: openai(env.OPENAI_MODEL),
        system: SYSTEM_PROMPT,
        messages: messages as ModelMessage[],
        tools: allTools,
        stopWhen: stepCountIs(50),
        onFinish: async ({ text, steps }) => {
          try {
            await messageService.create({
              threadId,
              ...(incidentId && { incidentId }),
              role: 'assistant',
              content: text,
              toolInvocations: steps.length > 0 ? steps : undefined,
            })
          } catch (err) {
            logger.error(err, 'Failed to save assistant message')
          }
          await redis.del(`stream:active:${threadId}`).catch(() => {})
        },
      })

      // Mark stream as active
      await redis.set(`stream:active:${threadId}`, '1', 'EX', 300)

      // Get the text stream response and intercept for Redis publishing
      const response = result.toTextStreamResponse()
      const body = response.body!

      const transform = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          controller.enqueue(chunk)
          const decoded = new TextDecoder().decode(chunk)
          publisher.publish(`chat:${threadId}`, decoded)
        },
        flush() {
          publisher.publish(`chat:${threadId}`, '[DONE]')
        },
      })

      const headers = new Headers(response.headers)
      headers.set('X-Thread-Id', threadId)

      return new Response(body.pipeThrough(transform), { headers })
    },
  )
  .get('/:threadId/subscribe', async (c) => {
    const threadId = c.req.param('threadId')

    const isActive = await redis.get(`stream:active:${threadId}`)
    if (!isActive) {
      return c.json({ error: 'No active stream for this thread' }, 404)
    }

    return streamSSE(c, async (stream) => {
      const subscriber = createSubscriber()

      await subscriber.subscribe(`chat:${threadId}`)

      await new Promise<void>((resolve) => {
        subscriber.on('message', async (_channel, message) => {
          try {
            if (message === '[DONE]') {
              await stream.writeSSE({ data: '', event: 'done' })
              resolve()
              return
            }
            await stream.writeSSE({ data: message, event: 'chunk' })
          } catch {
            resolve()
          }
        })

        stream.onAbort(() => resolve())
      })

      await subscriber.unsubscribe(`chat:${threadId}`).catch(() => {})
      await subscriber.quit().catch(() => {})
    })
  })
  .get('/:threadId/messages', async (c) => {
    const threadId = c.req.param('threadId')
    const data = await messageService.listByThreadId(threadId)
    return c.json({ data })
  })
