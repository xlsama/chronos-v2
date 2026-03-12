import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { toolPolicyService } from '../services/tool-policy.service'

export const toolPolicyRoutes = new Hono()
  .get('/', async (c) => {
    const data = await toolPolicyService.getGlobal()
    return c.json({ data })
  })
  .put(
    '/',
    zValidator(
      'json',
      z.object({
        approvalThreshold: z.enum(['none', 'low', 'medium', 'high']).optional(),
        allowDatabaseWrite: z.boolean().optional(),
        allowDatabaseDDL: z.boolean().optional(),
        allowK8sMutations: z.boolean().optional(),
        allowSSH: z.boolean().optional(),
        allowCICDTrigger: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const body = c.req.valid('json')
      const data = await toolPolicyService.upsert(body)
      return c.json({ data })
    },
  )
