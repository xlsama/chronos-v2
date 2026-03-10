import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { incidentService } from '../services/incident.service'
import { AppError } from '../lib/errors'
import { triggerAgentForIncident } from '../lib/agent-trigger'
import { generateIncidentSummary } from '../lib/generate-summary'
import { logger } from '../lib/logger'
import { notifyIncidentCreated, notifyIncidentStatusChanged } from '../lib/notify'

const attachmentSchema = z.object({
  type: z.enum(['image', 'file']),
  url: z.string(),
  name: z.string(),
  mimeType: z.string(),
})

export const incidentRoutes = new Hono()
  .get('/', zValidator('query', z.object({
    status: z.string().optional(),
    limit: z.coerce.number().optional(),
    offset: z.coerce.number().optional(),
  })), async (c) => {
    const query = c.req.valid('query')
    const { items, total } = await incidentService.list(query)
    return c.json({ data: items, total })
  })
  .post('/', zValidator('json', z.object({
    content: z.string().min(1),
    attachments: z.array(attachmentSchema).optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    const incident = await incidentService.create({
      content: input.content,
      attachments: input.attachments ?? null,
      source: 'manual',
    })
    // fire-and-forget: async summary + agent trigger + notification
    generateAndUpdateSummary(incident.id, input.content, input.attachments ?? null)
    triggerAgentForIncident(incident)
    notifyIncidentCreated(incident)
    return c.json({ data: incident }, 201)
  })
  .get('/:id', async (c) => {
    const incident = await incidentService.getById(c.req.param('id'))
    if (!incident) throw new AppError(404, 'Incident not found')
    return c.json({ data: incident })
  })
  .patch('/:id', zValidator('json', z.object({
    status: z.enum(['new', 'triaging', 'in_progress', 'waiting_human', 'resolved', 'closed']).optional(),
    processingMode: z.enum(['automatic', 'semi_automatic']).nullable().optional(),
    threadId: z.string().optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    // Read old status before update for notification
    const oldIncident = input.status ? await incidentService.getById(c.req.param('id')) : null
    const incident = await incidentService.update(c.req.param('id'), input)
    if (!incident) throw new AppError(404, 'Incident not found')
    // fire-and-forget: notify status change
    if (input.status && oldIncident && oldIncident.status !== input.status) {
      notifyIncidentStatusChanged(incident, oldIncident.status, input.status)
    }
    return c.json({ data: incident })
  })

type Attachment = { type: 'image' | 'file'; url: string; name: string; mimeType: string }

export async function generateAndUpdateSummary(id: string, content: string, attachments: Attachment[] | null) {
  try {
    const summary = await generateIncidentSummary(content, attachments)
    if (summary) await incidentService.update(id, { summary })
  } catch (err) {
    logger.warn({ err, incidentId: id }, 'Failed to generate summary')
  }
}
