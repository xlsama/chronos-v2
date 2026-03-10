import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { incidentService } from '../services/incident.service'
import { triggerAgentForIncident } from '../lib/agent-trigger'
import { generateAndUpdateSummary } from './incidents'
import { sendFeishuMessage, notifyIncidentCreated } from '../lib/notify'

const attachmentSchema = z.object({
  type: z.enum(['image', 'file']),
  url: z.string(),
  name: z.string(),
  mimeType: z.string(),
})

export const webhookRoutes = new Hono()
  .post('/alert', zValidator('json', z.object({
    content: z.string().min(1),
    attachments: z.array(attachmentSchema).optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    const incident = await incidentService.create({
      content: input.content,
      attachments: input.attachments ?? null,
      source: 'webhook',
    })
    // fire-and-forget: async summary + agent trigger + notification
    generateAndUpdateSummary(incident.id, input.content, input.attachments ?? null)
    triggerAgentForIncident(incident)
    notifyIncidentCreated(incident)
    return c.json({ data: incident }, 201)
  })
  .post('/test', zValidator('json', z.object({
    webhookUrl: z.string().url(),
    signKey: z.string().optional(),
    platform: z.enum(['feishu']),
  })), async (c) => {
    const { webhookUrl, signKey } = c.req.valid('json')

    try {
      await sendFeishuMessage({
        webhookUrl,
        signKey: signKey || null,
        body: {
          msg_type: 'text',
          content: {
            text: '✅ Chronos 通知测试成功\n这是一条来自 Chronos 的测试消息，说明 Webhook 配置正确。',
          },
        },
      })
      return c.json({ data: { success: true } })
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      return c.json({ error: `Webhook 请求失败: ${message}` }, 502)
    }
  })
