import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { mcpRegistry } from '../../mcp/registry'

type DynamicMCPTool = {
  type: 'dynamic'
  description?: string
  inputSchema: { jsonSchema?: { properties?: Record<string, unknown> } }
  execute?: (input: Record<string, unknown>) => Promise<unknown>
}

export const searchMcpTools = createTool({
  id: 'search-mcp-tools',
  description:
    '搜索指定服务前缀下可用的 MCP 工具。返回工具名、描述和参数说明。在执行基础设施操作前，先用此工具了解可用的操作。前缀来源于 Supervisor 委派提示中的 MCP 工具前缀列表。',
  inputSchema: z.object({
    prefixes: z
      .array(z.string())
      .describe('MCP 工具前缀列表，如 ["order_mysql", "prod_redis"]'),
  }),
  execute: async ({ prefixes }) => {
    const allTools = mcpRegistry.getAllToolsAsAISDK()
    const results: Array<{
      toolKey: string
      description: string
      parameters?: Record<string, unknown>
    }> = []

    for (const [key, tool] of Object.entries(allTools)) {
      if (prefixes.some((p) => key.startsWith(p))) {
        const typedTool = tool as DynamicMCPTool
        results.push({
          toolKey: key,
          description: typedTool.description ?? key,
          parameters: typedTool.inputSchema?.jsonSchema?.properties,
        })
      }
    }

    if (results.length === 0) {
      return {
        message: `未找到匹配前缀 [${prefixes.join(', ')}] 的 MCP 工具。请确认前缀是否正确，或使用 listConnections 查看可用连接。`,
        availablePrefixes: Object.keys(allTools).map((k) => k.split('_').slice(0, -1).join('_')).filter((v, i, a) => a.indexOf(v) === i),
      }
    }

    return { tools: results, count: results.length }
  },
})

export const executeMcpTool = createTool({
  id: 'execute-mcp-tool',
  description:
    '执行指定的 MCP 工具。先用 searchMcpTools 获取可用工具列表和参数说明，再用此工具执行。先只读诊断（SELECT/GET/查日志），再考虑写操作。写操作前说明影响。',
  inputSchema: z.object({
    toolKey: z.string().describe('searchMcpTools 返回的 toolKey'),
    input: z
      .record(z.string(), z.unknown())
      .describe('工具参数，参见 searchMcpTools 返回的参数说明'),
  }),
  execute: async ({ toolKey, input }) => {
    const allTools = mcpRegistry.getAllToolsAsAISDK()
    const tool = allTools[toolKey]

    if (!tool) {
      return {
        error: `工具 ${toolKey} 不存在，请用 searchMcpTools 确认可用工具`,
      }
    }

    try {
      const typedTool = tool as DynamicMCPTool
      if (!typedTool.execute) {
        return { error: `工具 ${toolKey} 不支持执行` }
      }
      return await typedTool.execute(input)
    } catch (err) {
      return {
        error: `执行失败: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  },
})
