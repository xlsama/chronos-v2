import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { connectionService } from '../services/connection.service'
import { testConnection } from '../services/connection-tester'
import { AppError } from '../lib/errors'

export const connectionRoutes = new Hono()
  .get('/', async (c) => {
    const data = await connectionService.list()
    return c.json({ data })
  })
  .post('/', zValidator('json', z.object({
    name: z.string().min(1),
    type: z.enum(['mysql', 'postgresql', 'redis', 'mongodb', 'clickhouse', 'elasticsearch', 'kafka', 'rabbitmq', 'kubernetes', 'docker', 'argocd', 'grafana', 'prometheus', 'sentry', 'jenkins']),
    config: z.record(z.string(), z.unknown()),
  })), async (c) => {
    const input = c.req.valid('json')
    const connection = await connectionService.create(input)
    return c.json({ data: connection }, 201)
  })
  .post('/test', zValidator('json', z.object({
    type: z.enum(['mysql', 'postgresql', 'redis', 'mongodb', 'clickhouse', 'elasticsearch', 'kafka', 'rabbitmq', 'kubernetes', 'docker', 'argocd', 'grafana', 'prometheus', 'sentry', 'jenkins']),
    config: z.record(z.string(), z.unknown()),
  })), async (c) => {
    const { type, config } = c.req.valid('json')
    const result = await testConnection(type, config)
    return c.json({ data: result })
  })
  .get('/:id', async (c) => {
    const connection = await connectionService.getById(c.req.param('id'))
    if (!connection) throw new AppError(404, 'Connection not found')
    return c.json({ data: connection })
  })
  .put('/:id', zValidator('json', z.object({
    name: z.string().min(1).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    const connection = await connectionService.update(c.req.param('id'), input)
    if (!connection) throw new AppError(404, 'Connection not found')
    return c.json({ data: connection })
  })
  .delete('/:id', async (c) => {
    const connection = await connectionService.delete(c.req.param('id'))
    if (!connection) throw new AppError(404, 'Connection not found')
    return c.json({ data: connection })
  })
  .post('/:id/test', async (c) => {
    const connection = await connectionService.getRawById(c.req.param('id'))
    if (!connection) throw new AppError(404, 'Connection not found')
    const result = await testConnection(connection.type, connection.config)
    await connectionService.updateStatus(connection.id, result.success ? 'connected' : 'error')
    return c.json({ data: { success: result.success, status: result.success ? 'connected' : 'error', message: result.message } })
  })
