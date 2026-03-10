import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { topologyService } from '../services/topology.service'
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

export const topologyRoutes = new Hono()
  .get('/', async (c) => {
    const data = await topologyService.list()
    return c.json({ data })
  })
  .post('/', zValidator('json', z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    graph: graphSchema,
  })), async (c) => {
    const input = c.req.valid('json')
    const topo = await topologyService.create(input)
    return c.json({ data: topo }, 201)
  })
  .get('/:id', async (c) => {
    const topo = await topologyService.getById(c.req.param('id'))
    if (!topo) throw new AppError(404, 'Topology not found')
    return c.json({ data: topo })
  })
  .put('/:id', zValidator('json', z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    graph: graphSchema.optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    const topo = await topologyService.update(c.req.param('id'), input)
    if (!topo) throw new AppError(404, 'Topology not found')
    return c.json({ data: topo })
  })
  .delete('/:id', async (c) => {
    const topo = await topologyService.delete(c.req.param('id'))
    if (!topo) throw new AppError(404, 'Topology not found')
    return c.json({ data: topo })
  })
