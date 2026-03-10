import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { incidentService } from '../services/incident.service'
import { AppError } from '../lib/errors'

export const incidentRoutes = new Hono()
  .get('/', zValidator('query', z.object({
    status: z.string().optional(),
    severity: z.string().optional(),
    limit: z.coerce.number().optional(),
    offset: z.coerce.number().optional(),
  })), async (c) => {
    const query = c.req.valid('query')
    const data = await incidentService.list(query)
    return c.json({ data })
  })
  .post('/', zValidator('json', z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    source: z.string().optional(),
    sourceId: z.string().optional(),
    severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    category: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    const incident = await incidentService.create(input)
    return c.json({ data: incident }, 201)
  })
  .get('/:id', async (c) => {
    const incident = await incidentService.getById(c.req.param('id'))
    if (!incident) throw new AppError(404, 'Incident not found')
    return c.json({ data: incident })
  })
  .patch('/:id', zValidator('json', z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    status: z.enum(['new', 'triaging', 'in_progress', 'waiting_human', 'resolved', 'closed']).optional(),
    processingMode: z.enum(['automatic', 'semi_automatic']).nullable().optional(),
    category: z.string().optional(),
    threadId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    const incident = await incidentService.update(c.req.param('id'), input)
    if (!incident) throw new AppError(404, 'Incident not found')
    return c.json({ data: incident })
  })
