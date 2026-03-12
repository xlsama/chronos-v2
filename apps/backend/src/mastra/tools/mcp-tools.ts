import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { mcpRegistry } from '../../mcp/registry'
import { toolPolicyService } from '../../services/tool-policy.service'
import { toolApprovalService } from '../../services/tool-approval.service'
import { classifyToolExecution, isBlockedByPolicy, needsApproval } from '../../lib/tool-classifier'

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
    '执行指定的 MCP 工具。先用 searchMcpTools 获取可用工具列表和参数说明，再用此工具执行。高风险操作会自动暂停等待人工审批。',
  inputSchema: z.object({
    toolKey: z.string().describe('searchMcpTools 返回的 toolKey'),
    input: z
      .record(z.string(), z.unknown())
      .describe('工具参数，参见 searchMcpTools 返回的参数说明'),
  }),
  suspendSchema: z.object({
    approvalId: z.string(),
    toolKey: z.string(),
    toolName: z.string(),
    connectionName: z.string(),
    connectionType: z.string(),
    riskLevel: z.enum(['none', 'low', 'medium', 'high']),
    input: z.record(z.string(), z.unknown()),
    description: z.string(),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
    reason: z.string().optional(),
  }),
  execute: async ({ toolKey, input }, context) => {
    const { resumeData, suspend } = context?.agent ?? {}

    // ── Look up tool info from registry ──
    const toolInfo = mcpRegistry.getToolInfo(toolKey)
    if (!toolInfo) {
      return { error: `工具 ${toolKey} 不存在，请用 searchMcpTools 确认可用工具` }
    }

    // ── Resume path: approval decision arrived ──
    if (resumeData) {
      if (!resumeData.approved) {
        return { declined: true, reason: resumeData.reason ?? '用户拒绝了此操作' }
      }
      try {
        return await toolInfo.execute(input)
      } catch (err) {
        return { error: `执行失败: ${err instanceof Error ? err.message : String(err)}` }
      }
    }

    // ── First call path: risk assessment ──
    const riskLevel = classifyToolExecution(toolInfo.connectionType, toolInfo.toolName, input)
    const policy = await toolPolicyService.getGlobal()

    // Kill switch checks
    const blockResult = isBlockedByPolicy(toolInfo.connectionType, toolInfo.toolName, input, policy)
    if (blockResult.blocked) {
      return { blocked: true, reason: blockResult.reason }
    }

    // Approval check
    if (needsApproval(riskLevel, policy.approvalThreshold)) {
      const approval = await toolApprovalService.create({
        threadId: 'pending',
        toolKey,
        toolName: toolInfo.toolName,
        connectionName: toolInfo.connectionName,
        connectionType: toolInfo.connectionType,
        riskLevel,
        input,
        description: `执行 ${toolInfo.connectionName} 的 ${toolInfo.toolName} 操作`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      })

      return suspend?.({
        approvalId: approval.id,
        toolKey,
        toolName: toolInfo.toolName,
        connectionName: toolInfo.connectionName,
        connectionType: toolInfo.connectionType,
        riskLevel,
        input,
        description: `执行 ${toolInfo.connectionName} 的 ${toolInfo.toolName} 操作`,
      })
    }

    // Low risk → execute directly
    try {
      return await toolInfo.execute(input)
    } catch (err) {
      return { error: `执行失败: ${err instanceof Error ? err.message : String(err)}` }
    }
  },
})
