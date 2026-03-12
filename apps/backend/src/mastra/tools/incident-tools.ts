import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { incidentService } from '../../services/incident.service'

export const updateIncidentStatus = createTool({
  id: 'updateIncidentStatus',
  description: '更新事件状态。可用状态: new, triaging, in_progress, waiting_human, resolved, closed',
  inputSchema: z.object({
    incidentId: z.string().describe('事件 ID'),
    status: z.enum(['new', 'triaging', 'in_progress', 'waiting_human', 'resolved', 'closed']).describe('目标状态'),
    resolutionNotes: z.string().optional().describe('解决备注（解决时填写）'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    incident: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async (input) => {
    try {
      const incident = await incidentService.update(input.incidentId, {
        status: input.status,
        ...(input.resolutionNotes ? { resolutionNotes: input.resolutionNotes } : {}),
      })
      return { success: true, incident }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  },
})
