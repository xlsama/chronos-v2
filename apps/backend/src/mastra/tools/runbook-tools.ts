import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { projectDocumentService } from '../../services/project-document.service'
import { projectService } from '../../services/project.service'
import { logger, truncate } from '../../lib/logger'
import { agentContextStorage, resolveProjectId } from '../../lib/agent-context'

export const searchRunbooks = createTool({
  id: 'searchRunbooks',
  description: '搜索已发布的 Runbook（操作手册），包括项目 Runbook 和全局 Runbook。返回最相关的 Runbook 片段。',
  inputSchema: z.object({
    query: z.string().describe('搜索查询'),
    projectId: z.string().optional().describe('项目 UUID（可选，自动从事件上下文推导）'),
    limit: z.coerce.number().optional().default(3).describe('返回结果数量'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      documentId: z.string(),
      projectName: z.string(),
      title: z.string(),
      content: z.string(),
      similarity: z.number(),
    })),
  }),
  execute: async (input) => {
    const ctx = agentContextStorage.getStore()
    const projectId = await resolveProjectId(input.projectId)
    logger.info({ ...ctx, query: truncate(input.query, 200), projectId, limit: input.limit }, '[Tool:searchRunbooks] invoked')
    const results = await projectDocumentService.search(input.query, {
      kind: 'runbook',
      projectId,
      publicationStatuses: ['published'],
      limit: input.limit,
    })
    logger.debug(
      { ...ctx, resultCount: results.length, topSimilarity: results[0]?.similarity },
      '[Tool:searchRunbooks] results',
    )
    return {
      results: results.map((r) => ({
        documentId: r.documentId,
        projectName: r.projectName,
        title: r.title,
        content: r.content,
        similarity: r.similarity,
      })),
    }
  },
})

export const getRunbook = createTool({
  id: 'getRunbook',
  description: '根据文档 ID 获取完整的 Runbook 内容。',
  inputSchema: z.object({
    documentId: z.string().describe('Runbook 文档 ID'),
  }),
  outputSchema: z.object({
    title: z.string().optional(),
    content: z.string().optional(),
    found: z.boolean(),
  }),
  execute: async (input) => {
    const ctx = agentContextStorage.getStore()
    logger.info({ ...ctx, documentId: input.documentId }, '[Tool:getRunbook] invoked')
    const doc = await projectDocumentService.getById(input.documentId)
    logger.debug({ ...ctx, documentId: input.documentId, found: Boolean(doc) }, '[Tool:getRunbook] result')
    if (!doc) return { found: false }
    return { found: true, title: doc.title, content: doc.content ?? '' }
  },
})

export const createRunbook = createTool({
  id: 'createRunbook',
  description: '基于事件解决经验创建新的草稿 Runbook。Agent 在成功解决事件后应调用此工具沉淀经验。',
  inputSchema: z.object({
    projectId: z.string().uuid().describe('项目 UUID'),
    title: z.string().describe('Runbook 标题'),
    content: z.string().describe('Runbook 内容（Markdown）'),
    tags: z.array(z.string()).optional().describe('标签'),
    description: z.string().optional().describe('简要描述'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    documentId: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async (input) => {
    const ctx = agentContextStorage.getStore()
    const projectId = await resolveProjectId(input.projectId)
    logger.info({ ...ctx, projectId, title: input.title }, '[Tool:createRunbook] invoked')
    if (projectId !== input.projectId) {
      logger.warn({ ...ctx, inputProjectId: input.projectId, resolvedProjectId: projectId }, '[Tool:createRunbook] corrected projectId from incident context')
    }
    try {
      const doc = await projectDocumentService.createMarkdownDocument({
        projectId,
        kind: 'runbook',
        title: input.title,
        content: input.content,
        tags: input.tags,
        description: input.description,
        publicationStatus: 'draft',
        source: 'agent',
        createdBy: 'agent',
      })
      logger.info({ ...ctx, documentId: doc.id }, '[Tool:createRunbook] created')
      return { success: true, documentId: doc.id }
    } catch (error) {
      logger.error({ ...ctx, err: error, title: input.title }, '[Tool:createRunbook] failed')
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  },
})
