import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { projectDocumentService } from '../../services/project-document.service'

export const saveIncidentHistory = createTool({
  id: 'saveIncidentHistory',
  description: '将事件的分析和解决过程保存为 Incident History 文档，用于沉淀经验供将来检索。在事件解决后调用此工具。',
  inputSchema: z.object({
    projectId: z.string().uuid().describe('项目 UUID'),
    title: z.string().describe('历史记录标题（简述事件）'),
    content: z.string().describe('事件完整记录（Markdown 格式，包含原因分析、解决步骤、经验总结）'),
    tags: z.array(z.string()).optional().describe('标签'),
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
        kind: 'incident_history',
        title: input.title,
        content: input.content,
        tags: input.tags,
        source: 'agent',
        createdBy: 'agent',
      })
      return { success: true, documentId: doc.id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  },
})
