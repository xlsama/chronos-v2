import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { skillService } from '../services/skill.service'
import { AppError } from '../lib/errors'

export const skillRoutes = new Hono()
  .get('/', zValidator('query', z.object({
    search: z.string().optional(),
    category: z.string().optional(),
    limit: z.coerce.number().optional(),
    offset: z.coerce.number().optional(),
  })), async (c) => {
    const query = c.req.valid('query')
    const data = await skillService.list(query)
    return c.json({ data })
  })
  .post('/', zValidator('json', z.object({
    name: z.string().min(1),
    summary: z.string().min(1),
    content: z.string().min(1),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    const skill = await skillService.create(input)
    return c.json({ data: skill }, 201)
  })
  .get('/:id', async (c) => {
    const skill = await skillService.getById(c.req.param('id'))
    if (!skill) throw new AppError(404, 'Skill not found')
    return c.json({ data: skill })
  })
  .put('/:id', zValidator('json', z.object({
    name: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    const skill = await skillService.update(c.req.param('id'), input)
    if (!skill) throw new AppError(404, 'Skill not found')
    return c.json({ data: skill })
  })
  .delete('/:id', async (c) => {
    const skill = await skillService.delete(c.req.param('id'))
    if (!skill) throw new AppError(404, 'Skill not found')
    return c.json({ data: skill })
  })
