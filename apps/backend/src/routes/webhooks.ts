import { createHmac } from 'node:crypto'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { ofetch } from 'ofetch'
import { incidentService } from '../services/incident.service'
import { triggerAgentForIncident } from '../lib/agent-trigger'
import { generateAndUpdateSummary } from './incidents'

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
    // fire-and-forget: async summary + agent trigger
    generateAndUpdateSummary(incident.id, input.content, input.attachments ?? null)
    triggerAgentForIncident(incident)
    return c.json({ data: incident }, 201)
  })
  .post('/test', zValidator('json', z.object({
    webhookUrl: z.string().url(),
    signKey: z.string().optional(),
    platform: z.enum(['feishu']),
  })), async (c) => {
    const { webhookUrl, signKey } = c.req.valid('json')

    const body: Record<string, unknown> = {
      msg_type: 'text',
      content: {
        text: '✅ Chronos 通知测试成功\n这是一条来自 Chronos 的测试消息，说明 Webhook 配置正确。',
      },
    }

    if (signKey) {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const stringToSign = `${timestamp}\n${signKey}`
      const sign = createHmac('sha256', stringToSign).update('').digest('base64')
      body.timestamp = timestamp
      body.sign = sign
    }

    try {
      const result = await ofetch<{ code: number; msg?: string }>(webhookUrl, {
        method: 'POST',
        body,
      })

      if (result.code !== 0) {
        return c.json({ error: `飞书返回错误: ${result.msg ?? `code ${result.code}`}` }, 400)
      }

      return c.json({ data: { success: true } })
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      return c.json({ error: `Webhook 请求失败: ${message}` }, 502)
    }
  })
