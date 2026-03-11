import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { kbService } from '../../services/knowledge-base.service'

export const searchKnowledge = createTool({
  id: 'search-knowledge',
  description:
    'Semantic search the knowledge base to find relevant project documentation, system architecture, service descriptions, and database nodes. Use this to identify which project/system an incident belongs to and what services are involved. Results are reranked for relevance.',
  inputSchema: z.object({
    query: z.string().describe('Search query describing the problem or system'),
    projectId: z.string().optional().describe('Optional project ID to scope the search'),
    limit: z.number().optional().describe('Max results (default 5)'),
  }),
  execute: async (inputData) => {
    const results = await kbService.searchByVector(inputData.query, {
      projectId: inputData.projectId,
      limit: inputData.limit,
    })
    return results.map((r) => ({
      content: r.chunkContent,
      relevanceScore: r.rerankScore ?? Math.round(r.similarity * 1000) / 1000,
      document: { id: r.documentId, title: r.documentTitle },
      project: { id: r.projectId, name: r.projectName },
    }))
  },
})

export const getKnowledgeDocument = createTool({
  id: 'get-knowledge-document',
  description:
    'Get the full content of a knowledge base document by ID. Use after searchKnowledge to read the complete document for detailed project/system information.',
  inputSchema: z.object({
    id: z.string().describe('Document UUID'),
  }),
  execute: async (inputData) => {
    const doc = await kbService.getDocumentById(inputData.id)
    if (!doc) return { error: 'Document not found' }
    return {
      id: doc.id,
      title: doc.title,
      type: doc.type,
      content: doc.content,
      projectId: doc.projectId,
    }
  },
})
