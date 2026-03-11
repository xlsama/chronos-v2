import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { serviceMapService } from '../services/service-map.service'
import { AppError } from '../lib/errors'

const serviceNodeTypes = [
  'service', 'database', 'cache', 'queue', 'search',
  'gateway', 'monitoring', 'cicd', 'container', 'external',
] as const

const edgeRelationTypes = [
  'calls', 'depends-on', 'reads-from', 'writes-to', 'publishes', 'subscribes',
] as const

const edgeProtocols = [
  'http', 'grpc', 'tcp', 'amqp', 'kafka', 'redis', 'sql', 'custom',
] as const

const nodeDataSchema = z.object({
  label: z.string().min(1),
  serviceType: z.enum(serviceNodeTypes),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  connectionId: z.uuid().optional(),
  kbProjectId: z.uuid().optional(),
})

const edgeDataSchema = z.object({
  relationType: z.enum(edgeRelationTypes),
  protocol: z.enum(edgeProtocols).optional(),
  description: z.string().optional(),
  critical: z.boolean().optional(),
})

const graphSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string().optional(),
    position: z.object({ x: z.number(), y: z.number() }),
    data: nodeDataSchema,
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    label: z.string().optional(),
    data: edgeDataSchema.optional(),
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
