import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { AppError } from '../lib/errors'
import { skillCatalogService } from '../services/skill-catalog.service'

const skillSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  markdown: z.string().default(''),
  config: z.object({
    prompt: z.string().optional(),
    applicableServiceTypes: z.array(z.string()).optional(),
    mcpServers: z.array(z.string()).optional(),
    tools: z.array(z.object({
      key: z.string(),
      label: z.string().optional(),
      toolName: z.string(),
      approvalMode: z.enum(['auto', 'manual']),
      riskLevel: z.enum(['none', 'low', 'medium', 'high']),
      allowedServiceTypes: z.array(z.string()).default([]),
      notes: z.string().optional(),
      input: z.record(z.string(), z.unknown()).optional(),
    })).optional(),
  }).optional(),
})

export const skillRoutes = new Hono()
  .get('/', async (c) => {
    const data = await skillCatalogService.list()
    return c.json({ data })
  })
  .post('/', zValidator('json', skillSchema), async (c) => {
    const data = await skillCatalogService.create(c.req.valid('json'))
    return c.json({ data }, 201)
  })
  .get('/:slug', async (c) => {
    const data = await skillCatalogService.getBySlug(c.req.param('slug'))
    if (!data) throw new AppError(404, 'Skill not found')
    return c.json({ data })
  })
  .put('/:slug', zValidator('json', skillSchema.partial()), async (c) => {
    const data = await skillCatalogService.update(c.req.param('slug'), c.req.valid('json'))
    if (!data) throw new AppError(404, 'Skill not found')
    return c.json({ data })
  })
  .delete('/:slug', async (c) => {
    const data = await skillCatalogService.delete(c.req.param('slug'))
    if (!data) throw new AppError(404, 'Skill not found')
    return c.json({ data })
  })
