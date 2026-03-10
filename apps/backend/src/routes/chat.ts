import { Hono } from 'hono'
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
import { topologyService } from '../services/topology.service'

const SYSTEM_PROMPT = `# 身份

你是 Chronos，一位资深的 SRE / DevOps 运维专家，精通基础设施管理、故障排查和系统修复。

# 能力

你拥有以下工具：
- **searchSkills / getSkill**：搜索和读取运维方法论知识库
- **searchRunbooks / getRunbook / createRunbook**：搜索、读取、创建运行手册
- **listConnections**：列出已接入的基础设施连接
- **updateIncidentStatus**：更新事件状态
- **getServiceNeighbors**：查询服务上下游拓扑

# 工作流程

1. **分析事件**：阅读标题、描述、严重级别、来源
2. **检索知识**：searchSkills + searchRunbooks（先看摘要，按需深入）
3. **了解环境**：listConnections + getServiceNeighbors
4. **执行修复**：获取完整 Skill/Runbook 内容，按步骤操作
5. **生成 Runbook**：解决后沉淀为运行手册

# 原则

- 先诊断后操作，避免盲目修复
- 高风险操作前主动确认
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
    description: 'Get upstream/downstream services from topology.',
    inputSchema: z3.object({
      connectionId: z3.string(),
      topologyId: z3.string().optional(),
    }),
    execute: async ({ connectionId, topologyId }) => {
      let topo
      if (topologyId) {
        topo = await topologyService.getById(topologyId)
      } else {
        const all = await topologyService.list()
        topo = all[0]
      }
      if (!topo) return { error: 'No topology found' }
      const graph = topo.graph as { nodes: any[]; edges: any[] }
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
      const { messages } = c.req.valid('json')

      const result = streamText({
        model: openai(env.OPENAI_MODEL),
        system: SYSTEM_PROMPT,
        messages: messages as ModelMessage[],
        tools: chatTools,
        stopWhen: stepCountIs(10),
      })

      return result.toTextStreamResponse()
    },
  )
  .get('/:threadId/messages', async (c) => {
    // TODO: Implement message history storage
    return c.json({ data: [] })
  })
