import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { skillMcpManager } from '../../lib/skill-mcp-manager'
import { skillCatalogService } from '../../services/skill-catalog.service'
import { checkApproval } from '../../lib/approval-interceptor'
import { logger, truncate } from '../../lib/logger'
import { agentContextStorage, resolveProjectId } from '../../lib/agent-context'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function simplifyMcpResult(result: unknown): unknown {
  if (!isRecord(result)) return result

  const content = Array.isArray(result.content) ? result.content : []
  const textParts: string[] = []

  for (const item of content) {
    if (!isRecord(item)) continue
    if (item.type === 'text' && typeof item.text === 'string' && item.text.trim()) {
      textParts.push(item.text.trim())
      continue
    }
    if (item.type === 'json' && item.json !== undefined) {
      textParts.push(JSON.stringify(item.json, null, 2))
    }
  }

  const text = textParts.join('\n\n').trim()
  let parsedTextJson: unknown = undefined
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      parsedTextJson = JSON.parse(text)
    } catch {
      parsedTextJson = undefined
    }
  }

  return {
    ...result,
    ...(text ? { text } : {}),
    ...(result.structuredContent !== undefined
      ? { structuredContent: result.structuredContent }
      : {}),
    ...(parsedTextJson !== undefined ? { parsedTextJson } : {}),
  }
}

function extractMcpErrorMessage(result: unknown): string | null {
  if (!isRecord(result)) return null
  if (result.isError !== true) return null

  const text = typeof result.text === 'string' ? result.text.trim() : ''
  if (text) return text

  const content = Array.isArray(result.content) ? result.content : []
  for (const item of content) {
    if (!isRecord(item)) continue
    if (item.type === 'text' && typeof item.text === 'string' && item.text.trim()) {
      return item.text.trim()
    }
  }

  return 'MCP tool returned an error result'
}

async function getSkillRiskLevel(toolName: string): Promise<string | undefined> {
  const underscoreIndex = toolName.indexOf('_')
  if (underscoreIndex === -1) return undefined
  const skillSlug = toolName.substring(0, underscoreIndex)
  try {
    const skill = await skillCatalogService.getBySlug(skillSlug)
    return skill?.riskLevel
  } catch {
    return undefined
  }
}

export const activateSkillMcp = createTool({
  id: 'activateSkillMcp',
  description: '激活 Skill 所需的 MCP 服务器。根据 Skill 的 mcpServers 配置和项目服务信息，动态注册 MCP 服务器并返回可用的工具列表。必须在 executeMcpTool 之前调用。',
  inputSchema: z.object({
    skillSlug: z.string().describe('Skill 的 slug'),
    projectId: z.string().uuid().describe('项目 UUID'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    activatedTools: z.array(z.object({
      name: z.string(),
      description: z.string().optional(),
      inputSchema: z.record(z.string(), z.unknown()).optional(),
    })).optional(),
    error: z.string().optional(),
  }),
  execute: async (input) => {
    const ctx = agentContextStorage.getStore()
    logger.info({ ...ctx, skillSlug: input.skillSlug, projectId: input.projectId }, '[Tool:activateSkillMcp] invoked')
    try {
      // Resolve projectId from incident context to guard against LLM passing wrong ID (e.g. serviceId)
      const projectId = await resolveProjectId(input.projectId) ?? input.projectId
      if (projectId !== input.projectId) {
        logger.warn({ ...ctx, inputProjectId: input.projectId, resolvedProjectId: projectId }, '[Tool:activateSkillMcp] corrected projectId from incident context')
      }

      const tools = await skillMcpManager.activate(input.skillSlug, projectId)
      logger.info({ ...ctx, skillSlug: input.skillSlug, toolCount: tools.length, toolNames: tools.map((t) => t.name) }, '[Tool:activateSkillMcp] activated')
      return { success: true, activatedTools: tools }
    } catch (error) {
      logger.error({ ...ctx, err: error, skillSlug: input.skillSlug }, '[Tool:activateSkillMcp] failed')
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  },
})

export const executeMcpTool = createTool({
  id: 'executeMcpTool',
  description: '执行已激活的 MCP 工具。传入工具名称和参数，返回执行结果。高风险操作（写操作）会自动触发人工审批。',
  inputSchema: z.object({
    toolName: z.string().describe('MCP 工具名称（从 activateSkillMcp 返回的列表中选择）'),
    args: z.record(z.string(), z.unknown()).describe('工具参数'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    result: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async (input) => {
    const ctx = agentContextStorage.getStore()
    logger.info({ ...ctx, toolName: input.toolName, args: truncate(input.args) }, '[Tool:executeMcpTool] invoked')
    try {
      // Check approval policy
      const skillRiskLevel = await getSkillRiskLevel(input.toolName)
      const decision = await checkApproval('executeMcpTool', input, { skillRiskLevel })
      if (decision.action === 'declined') {
        logger.warn({ ...ctx, toolName: input.toolName }, '[Tool:executeMcpTool] declined by approval')
        return { success: false, error: decision.message }
      }

      const rawResult = await skillMcpManager.executeTool(input.toolName, input.args)
      const result = simplifyMcpResult(rawResult)
      const errorMessage = extractMcpErrorMessage(result)
      if (errorMessage) {
        logger.warn({ ...ctx, toolName: input.toolName, errorMessage }, '[Tool:executeMcpTool] MCP returned error')
        return { success: false, error: errorMessage, result }
      }

      logger.info({ ...ctx, toolName: input.toolName, result: truncate(result) }, '[Tool:executeMcpTool] succeeded')
      return { success: true, result }
    } catch (error) {
      logger.error({ ...ctx, err: error, toolName: input.toolName }, '[Tool:executeMcpTool] failed')
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  },
})

export const listActiveMcps = createTool({
  id: 'listActiveMcps',
  description: '列出当前所有已激活的 MCP 服务器及其工具清单。用于多 Skill 场景下确认当前激活状态。',
  inputSchema: z.object({}),
  outputSchema: z.object({
    activeMcps: z.array(z.object({
      skillSlug: z.string(),
      serverType: z.string(),
      projectId: z.string(),
      tools: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        inputSchema: z.record(z.string(), z.unknown()).optional(),
      })),
    })),
  }),
  execute: async () => {
    const active = skillMcpManager.listActive()
    logger.debug({ count: active.length }, '[Tool:listActiveMcps] invoked')
    return { activeMcps: active }
  },
})

export const deactivateSkillMcp = createTool({
  id: 'deactivateSkillMcp',
  description: '停用已激活的 Skill MCP 服务器，释放资源。在完成操作后调用。',
  inputSchema: z.object({
    skillSlug: z.string().describe('Skill 的 slug'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async (input) => {
    const ctx = agentContextStorage.getStore()
    logger.info({ ...ctx, skillSlug: input.skillSlug }, '[Tool:deactivateSkillMcp] invoked')
    await skillMcpManager.deactivate(input.skillSlug)
    logger.info({ ...ctx, skillSlug: input.skillSlug }, '[Tool:deactivateSkillMcp] done')
    return { success: true }
  },
})
