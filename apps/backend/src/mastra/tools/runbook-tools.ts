import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { runbookService } from '../../services/runbook.service'

export const searchRunbooks = createTool({
  id: 'search-runbooks',
  description:
    'Search runbooks (past resolution records) by keyword or tags. Returns titles, tags and brief summaries. Use this to find relevant past solutions before diving into details.',
  inputSchema: z.object({
    query: z.string().optional().describe('Search keyword for title matching'),
    tags: z.array(z.string()).optional().describe('Filter by tags'),
    limit: z.number().optional().default(10).describe('Max results'),
  }),
  execute: async (inputData) => {
    const results = await runbookService.list({
      search: inputData.query,
      tags: inputData.tags,
      limit: inputData.limit,
    })
    return results.map((r) => ({
      id: r.id,
      title: r.title,
      tags: r.tags,
      summary: r.content.slice(0, 200) + (r.content.length > 200 ? '...' : ''),
    }))
  },
})

export const getRunbook = createTool({
  id: 'get-runbook',
  description:
    'Get the full content of a specific runbook by ID. Use after searchRunbooks to read the complete resolution details.',
  inputSchema: z.object({
    id: z.string().describe('Runbook UUID'),
  }),
  execute: async (inputData) => {
    const runbook = await runbookService.getById(inputData.id)
    if (!runbook) return { error: 'Runbook not found' }
    return runbook
  },
})

export const createRunbook = createTool({
  id: 'create-runbook',
  description:
    'Create a new runbook to document a resolution process. Use this after resolving an incident to preserve the knowledge.',
  inputSchema: z.object({
    title: z.string().describe('Runbook title'),
    content: z.string().describe('Full markdown content of the runbook'),
    incidentId: z.string().optional().describe('Related incident UUID'),
    tags: z.array(z.string()).optional().describe('Tags for categorization'),
  }),
  execute: async (inputData) => {
    const runbook = await runbookService.create(inputData)
    return { success: true, id: runbook.id, title: runbook.title }
  },
})
