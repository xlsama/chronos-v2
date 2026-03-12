import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { projectDocumentService } from '../../services/project-document.service'
import { projectService } from '../../services/project.service'

export const searchRunbooks = createTool({
  id: 'searchRunbooks',
  description: '搜索已发布的 Runbook（操作手册），包括项目 Runbook 和全局 Runbook。返回最相关的 Runbook 片段。',
  inputSchema: z.object({
    query: z.string().describe('搜索查询'),
    projectId: z.string().optional().describe('项目 ID（可选，不传则搜索全局）'),
    limit: z.number().optional().default(3).describe('返回结果数量'),
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
    const results = await projectDocumentService.search(input.query, {
      kind: 'runbook',
      projectId: input.projectId,
      publicationStatuses: ['published'],
      limit: input.limit,
    })
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
    const doc = await projectDocumentService.getById(input.documentId)
    if (!doc) return { found: false }
    return { found: true, title: doc.title, content: doc.content ?? '' }
  },
})

export const createRunbook = createTool({
  id: 'createRunbook',
  description: '基于事件解决经验创建新的草稿 Runbook。Agent 在成功解决事件后应调用此工具沉淀经验。',
  inputSchema: z.object({
    projectId: z.string().describe('项目 ID'),
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
    try {
      const doc = await projectDocumentService.createMarkdownDocument({
        projectId: input.projectId,
        kind: 'runbook',
        title: input.title,
        content: input.content,
        tags: input.tags,
        description: input.description,
        publicationStatus: 'draft',
        source: 'agent',
        createdBy: 'agent',
      })
      return { success: true, documentId: doc.id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  },
})
