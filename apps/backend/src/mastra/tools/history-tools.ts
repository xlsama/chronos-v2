import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { projectDocumentService } from '../../services/project-document.service'

export const searchIncidentHistory = createTool({
  id: 'searchIncidentHistory',
  description: '搜索历史事件记录，查找与当前问题相似的过往事件及其解决方案。',
  inputSchema: z.object({
    query: z.string().describe('搜索查询（描述当前问题）'),
    projectId: z.string().uuid().optional().describe('项目 UUID（可选）'),
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
      kind: 'incident_history',
      projectId: input.projectId,
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

export const getIncidentHistoryDetail = createTool({
  id: 'getIncidentHistoryDetail',
  description: '根据文档 ID 获取完整的历史事件详情。',
  inputSchema: z.object({
    documentId: z.string().describe('历史事件文档 ID'),
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
