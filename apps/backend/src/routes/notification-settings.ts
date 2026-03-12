import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { notificationSettingsService } from '../services/notification-settings.service'

const upsertSchema = z.object({
  webhookUrl: z.string().url(),
  signKey: z.string().optional(),
  enabled: z.boolean(),
})

export const notificationSettingsRoutes = new Hono()
  .get('/:platform', async (c) => {
    const platform = c.req.param('platform')
    const settings = await notificationSettingsService.getByPlatform(platform)
    return c.json({ data: settings })
  })
  .put('/:platform', zValidator('json', upsertSchema), async (c) => {
    const platform = c.req.param('platform')
    const input = c.req.valid('json')
    const settings = await notificationSettingsService.upsert({ platform, ...input })
    return c.json({ data: settings })
  })
