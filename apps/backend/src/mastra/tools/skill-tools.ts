import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { skillService } from '../../services/skill.service'

export const searchSkills = createTool({
  id: 'search-skills',
  description:
    'Search the skill knowledge base by keyword or category. Returns skill names and brief summaries. Use this to find relevant diagnostic methodologies.',
  inputSchema: z.object({
    query: z.string().optional().describe('Search keyword'),
    category: z
      .string()
      .optional()
      .describe('Filter by category (database, cache, kubernetes, etc.)'),
  }),
  execute: async (inputData) => {
    const results = await skillService.list({
      search: inputData.query,
      category: inputData.category,
    })
    return results.map((s) => ({
      id: s.id,
      name: s.name,
      summary: s.summary,
      category: s.category,
      tags: s.tags,
    }))
  },
})

export const getSkill = createTool({
  id: 'get-skill',
  description:
    'Get the full content of a specific skill by ID. Use after searchSkills to read the complete methodology.',
  inputSchema: z.object({
    id: z.string().describe('Skill UUID'),
  }),
  execute: async (inputData) => {
    const skill = await skillService.getById(inputData.id)
    if (!skill) return { error: 'Skill not found' }
    return skill
  },
})
