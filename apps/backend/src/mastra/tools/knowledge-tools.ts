import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { projectDocumentService } from '../../services/project-document.service'
import { logger, truncate } from '../../lib/logger'
import { agentContextStorage } from '../../lib/agent-context'

export const searchKnowledgeBase = createTool({
  id: 'searchKnowledgeBase',
  description: '在项目知识库中进行向量语义搜索，查找与查询相关的知识文档。返回最相关的文档片段。',
  inputSchema: z.object({
    query: z.string().describe('搜索查询（自然语言描述问题）'),
    projectId: z.string().uuid().describe('项目 UUID'),
    limit: z.number().optional().default(4).describe('返回结果数量'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      documentId: z.string(),
      title: z.string(),
      content: z.string(),
      similarity: z.number(),
    })),
  }),
  execute: async (input) => {
    const ctx = agentContextStorage.getStore()
    logger.info({ ...ctx, query: truncate(input.query, 200), projectId: input.projectId, limit: input.limit }, '[Tool:searchKnowledgeBase] invoked')
    const results = await projectDocumentService.search(input.query, {
      kind: 'knowledge',
      projectId: input.projectId,
      limit: input.limit,
    })
    logger.debug(
      { ...ctx, resultCount: results.length, topSimilarity: results[0]?.similarity },
      '[Tool:searchKnowledgeBase] results',
    )
    return {
      results: results.map((r) => ({
        documentId: r.documentId,
        title: r.title,
        content: r.content,
        similarity: r.similarity,
      })),
    }
  },
})

export const getKnowledgeDocument = createTool({
  id: 'getKnowledgeDocument',
  description: '根据文档 ID 获取完整的知识文档内容。',
  inputSchema: z.object({
    documentId: z.string().describe('文档 ID'),
  }),
  outputSchema: z.object({
    title: z.string().optional(),
    content: z.string().optional(),
    found: z.boolean(),
  }),
  execute: async (input) => {
    const ctx = agentContextStorage.getStore()
    logger.info({ ...ctx, documentId: input.documentId }, '[Tool:getKnowledgeDocument] invoked')
    const doc = await projectDocumentService.getById(input.documentId)
    logger.debug({ ...ctx, documentId: input.documentId, found: Boolean(doc) }, '[Tool:getKnowledgeDocument] result')
    if (!doc) return { found: false }
    return { found: true, title: doc.title, content: doc.content ?? '' }
  },
})
