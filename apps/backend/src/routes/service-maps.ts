import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { serviceMapService } from '../services/service-map.service'
import { AppError } from '../lib/errors'

const graphSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string().optional(),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.record(z.string(), z.unknown()).optional(),
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    label: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })),
})

export const serviceMapRoutes = new Hono()
  .get('/', async (c) => {
    const data = await serviceMapService.list()
    return c.json({ data })
  })
  .post('/', zValidator('json', z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    graph: graphSchema,
  })), async (c) => {
    const input = c.req.valid('json')
    const serviceMap = await serviceMapService.create(input)
    return c.json({ data: serviceMap }, 201)
  })
  .get('/:id', async (c) => {
    const serviceMap = await serviceMapService.getById(c.req.param('id'))
    if (!serviceMap) throw new AppError(404, 'Service map not found')
    return c.json({ data: serviceMap })
  })
  .put('/:id', zValidator('json', z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    graph: graphSchema.optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    const serviceMap = await serviceMapService.update(c.req.param('id'), input)
    if (!serviceMap) throw new AppError(404, 'Service map not found')
    return c.json({ data: serviceMap })
  })
  .delete('/:id', async (c) => {
    const serviceMap = await serviceMapService.delete(c.req.param('id'))
    if (!serviceMap) throw new AppError(404, 'Service map not found')
    return c.json({ data: serviceMap })
  })
