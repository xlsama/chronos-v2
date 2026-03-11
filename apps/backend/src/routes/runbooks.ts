import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { runbookService } from '../services/runbook.service'
import { AppError } from '../lib/errors'

export const runbookRoutes = new Hono()
  .get('/', zValidator('query', z.object({
    search: z.string().optional(),
    tags: z.string().optional(), // comma-separated
    limit: z.coerce.number().optional(),
    offset: z.coerce.number().optional(),
  })), async (c) => {
    const { tags: tagsStr, ...rest } = c.req.valid('query')
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : undefined
    const data = await runbookService.list({ ...rest, tags })
    return c.json({ data })
  })
  .post('/', zValidator('json', z.object({
    title: z.string().min(1),
    content: z.string().optional().default(""),
    incidentId: z.string().uuid().optional(),
    tags: z.array(z.string()).optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    const runbook = await runbookService.create(input)
    return c.json({ data: runbook }, 201)
  })
  .get('/:id', async (c) => {
    const runbook = await runbookService.getById(c.req.param('id'))
    if (!runbook) throw new AppError(404, 'Runbook not found')
    return c.json({ data: runbook })
  })
  .put('/:id', zValidator('json', z.object({
    title: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
    tags: z.array(z.string()).optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    const runbook = await runbookService.update(c.req.param('id'), input)
    if (!runbook) throw new AppError(404, 'Runbook not found')
    return c.json({ data: runbook })
  })
  .delete('/:id', async (c) => {
    const runbook = await runbookService.delete(c.req.param('id'))
    if (!runbook) throw new AppError(404, 'Runbook not found')
    return c.json({ data: runbook })
  })
