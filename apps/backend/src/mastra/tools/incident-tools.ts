import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { incidentService } from '../../services/incident.service'
import { checkApproval } from '../../lib/approval-interceptor'
import { logger } from '../../lib/logger'

export const updateIncidentStatus = createTool({
  id: 'updateIncidentStatus',
  description: '更新事件状态。可用状态: new, triaging, in_progress, waiting_human, resolved, closed。关闭事件（resolved/closed）需要人工审批。',
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
    logger.info({ incidentId: input.incidentId, status: input.status }, '[Tool:updateIncidentStatus] invoked')
    try {
      // Check approval policy (resolving/closing requires approval)
      const decision = await checkApproval('updateIncidentStatus', input)
      if (decision.action === 'declined') {
        return { success: false, error: decision.message }
      }

      const incident = await incidentService.update(input.incidentId, {
        status: input.status,
        ...(input.resolutionNotes ? { resolutionNotes: input.resolutionNotes } : {}),
      })
      logger.info(
        { incidentId: input.incidentId, status: input.status, success: Boolean(incident) },
        '[Incident] status update requested by agent'
      )
      return { success: true, incident }
    } catch (error) {
      logger.error(
        { err: error, incidentId: input.incidentId, status: input.status },
        '[Incident] status update requested by agent failed'
      )
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  },
})
