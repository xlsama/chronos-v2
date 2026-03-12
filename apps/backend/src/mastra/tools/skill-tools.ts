import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { skillCatalogService } from '../../services/skill-catalog.service'

export const listSkills = createTool({
  id: 'listSkills',
  description: '列出所有可用的 Skills（技能/能力清单）。每个 Skill 包含名称、描述、适用服务类型和工具列表。',
  inputSchema: z.object({}),
  outputSchema: z.object({
    skills: z.array(z.object({
      slug: z.string(),
      name: z.string(),
      description: z.string().optional(),
      applicableServiceTypes: z.array(z.string()),
      toolCount: z.number(),
    })),
  }),
  execute: async () => {
    const skills = await skillCatalogService.list()
    return {
      skills: skills.map((s) => ({
        slug: s.slug,
        name: s.name,
        description: s.description,
        applicableServiceTypes: s.applicableServiceTypes,
        toolCount: s.tools.length,
      })),
    }
  },
})

export const loadSkill = createTool({
  id: 'loadSkill',
  description: '加载指定 Skill 的完整定义，包括详细文档、MCP 服务器配置和工具列表。在决定使用某个 Skill 前调用此工具获取详情。',
  inputSchema: z.object({
    slug: z.string().describe('Skill 的 slug 标识符'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    skill: z.any().optional(),
  }),
  execute: async (input) => {
    const skill = await skillCatalogService.getBySlug(input.slug)
    if (!skill) return { found: false }
    return {
      found: true,
      skill: {
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        applicableServiceTypes: skill.applicableServiceTypes,
        mcpServers: skill.mcpServers,
        tools: skill.tools,
        markdown: skill.markdown,
      },
    }
  },
})
