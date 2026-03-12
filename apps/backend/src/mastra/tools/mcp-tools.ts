import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { skillMcpManager } from '../../lib/skill-mcp-manager'

export const activateSkillMcp = createTool({
  id: 'activateSkillMcp',
  description: '激活 Skill 所需的 MCP 服务器。根据 Skill 的 mcpServers 配置和项目服务信息，动态注册 MCP 服务器并返回可用的工具列表。必须在 executeMcpTool 之前调用。',
  inputSchema: z.object({
    skillSlug: z.string().describe('Skill 的 slug'),
    projectId: z.string().uuid().describe('项目 UUID'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    activatedTools: z.array(z.string()).optional(),
    error: z.string().optional(),
  }),
  execute: async (input) => {
    try {
      const tools = await skillMcpManager.activate(input.skillSlug, input.projectId)
      return { success: true, activatedTools: tools }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  },
})

export const executeMcpTool = createTool({
  id: 'executeMcpTool',
  description: '执行已激活的 MCP 工具。传入工具名称和参数，返回执行结果。高风险操作将被标记，建议先确认风险等级。',
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
    try {
      const result = await skillMcpManager.executeTool(input.toolName, input.args)
      return { success: true, result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
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
    await skillMcpManager.deactivate(input.skillSlug)
    return { success: true }
  },
})
