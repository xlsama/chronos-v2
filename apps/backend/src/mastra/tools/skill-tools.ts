import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { skillCatalogService } from '../../services/skill-catalog.service'
import { logger } from '../../lib/logger'
import { getAgentLogContext, toolLogLabel } from '../../lib/agent-context'

export const listSkills = createTool({
  id: 'listSkills',
  description: '列出所有可用的 Skills（技能/能力清单）。每个 Skill 包含名称、描述和适用的服务类型。',
  inputSchema: z.object({}),
  outputSchema: z.object({
    skills: z.array(z.object({
      slug: z.string(),
      name: z.string(),
      description: z.string().optional(),
      applicableServiceTypes: z.array(z.string()).optional(),
      riskLevel: z.string().optional(),
    })),
  }),
  execute: async () => {
    const ctx = getAgentLogContext()
    logger.info({ ...ctx }, toolLogLabel('listSkills', 'invoked'))
    const skills = await skillCatalogService.list()
    logger.debug({ ...ctx, skillCount: skills.length }, toolLogLabel('listSkills', 'results'))
    return {
      skills: skills.map((s) => ({
        slug: s.slug,
        name: s.name,
        description: s.description,
        applicableServiceTypes: s.applicableServiceTypes,
        riskLevel: s.riskLevel,
      })),
    }
  },
})

export const loadSkill = createTool({
  id: 'loadSkill',
  description: '加载指定 Skill 的完整定义，包括详细的 Markdown 文档和 MCP 配置。在决定使用某个 Skill 前调用此工具获取详情。',
  inputSchema: z.object({
    slug: z.string().describe('Skill 的 slug 标识符'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    skill: z.any().optional(),
  }),
  execute: async (input) => {
    const ctx = getAgentLogContext()
    logger.info({ ...ctx, slug: input.slug }, toolLogLabel('loadSkill', 'invoked'))
    const skill = await skillCatalogService.getBySlug(input.slug)
    logger.debug({ ...ctx, slug: input.slug, found: Boolean(skill) }, toolLogLabel('loadSkill', 'result'))
    if (!skill) return { found: false }
    return {
      found: true,
      skill: {
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        mcpServers: skill.mcpServers,
        applicableServiceTypes: skill.applicableServiceTypes,
        riskLevel: skill.riskLevel,
        markdown: skill.markdown,
      },
    }
  },
})
