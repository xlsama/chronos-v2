import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { incidentService } from '../../services/incident.service'
import { notifyIncidentStatusChanged } from '../../lib/notify'

export const updateIncidentStatus = createTool({
  id: 'update-incident-status',
  description:
    'Update the status and/or processing mode of an incident. Use this to transition incident status (e.g., from triaging to in_progress, or to resolved).',
  inputSchema: z.object({
    incidentId: z.string().describe('The UUID of the incident to update'),
    status: z
      .enum(['new', 'triaging', 'in_progress', 'waiting_human', 'resolved', 'closed'])
      .optional()
      .describe('New status'),
    processingMode: z
      .enum(['automatic', 'semi_automatic'])
      .optional()
      .describe('Processing mode'),
  }),
  execute: async (inputData) => {
    const { incidentId, ...updates } = inputData
    const oldIncident = updates.status ? await incidentService.getById(incidentId) : null
    const incident = await incidentService.update(incidentId, updates)
    if (!incident) return { error: 'Incident not found' }
    // fire-and-forget: notify status change
    if (updates.status && oldIncident && oldIncident.status !== updates.status) {
      notifyIncidentStatusChanged(incident, oldIncident.status, updates.status)
    }
    return { success: true, incident }
  },
})
