import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { skillService } from '../../services/skill.service'

// Supervisor loads skill on demand (skills manifest already in system prompt)
export const loadSkill = createTool({
  id: 'load-skill',
  description:
    '加载指定 Skill 的完整方法论内容。仅在需要详细步骤时调用。Skill 列表已在上下文中提供。',
  inputSchema: z.object({
    id: z.string().describe('Skill UUID，从上下文中的 Skills 列表获取'),
  }),
  execute: async ({ id }) => {
    const skill = await skillService.getById(id)
    if (!skill) return { error: 'Skill not found' }
    return { name: skill.name, content: skill.content, category: skill.category }
  },
})
