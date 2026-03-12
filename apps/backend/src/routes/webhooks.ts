import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { incidentService } from '../services/incident.service'
import { incidentWorkflowService } from '../services/incident-workflow.service'
import { messageService } from '../services/message.service'
import { publishChatEvent } from '../lib/redis'
import { runAgentInBackground } from '../lib/agent-runner'
import { sendFeishuMessage } from '../lib/feishu'
import { env } from '../env'

const attachmentSchema = z.object({
  type: z.enum(['image', 'file']),
  url: z.string(),
  name: z.string(),
  mimeType: z.string(),
})

const eventSchema = z.object({
  content: z.string().min(1),
  projectId: z.string().uuid().nullable().optional(),
  attachments: z.array(attachmentSchema).optional(),
  sourceMetadata: z.record(z.string(), z.unknown()).optional(),
})

async function triggerAgent(incident: Awaited<ReturnType<typeof incidentService.create>>) {
  const threadId = `incident-${incident.id}`

  await messageService.save({
    threadId,
    incidentId: incident.id,
    role: 'user',
    content: incident.content,
  })

  await publishChatEvent(threadId, 'stream-start', { threadId })
  void runAgentInBackground(threadId, incident)
}

export const webhookRoutes = new Hono()
  .post('/events', zValidator('json', eventSchema), async (c) => {
    const input = c.req.valid('json')
    const incident = await incidentService.create({
      content: input.content,
      projectId: input.projectId ?? null,
      attachments: input.attachments ?? null,
      source: 'webhook',
      metadata: input.sourceMetadata ?? {},
      status: 'triaging',
      processingMode: 'automatic',
    })

    if (env.AGENT_AUTO_TRIGGER) {
      void triggerAgent(incident)
    } else {
      void incidentWorkflowService.start(incident)
    }
    return c.json({ data: incident }, 201)
  })
  .post('/alert', zValidator('json', eventSchema), async (c) => {
    const input = c.req.valid('json')
    const incident = await incidentService.create({
      content: input.content,
      projectId: input.projectId ?? null,
      attachments: input.attachments ?? null,
      source: 'webhook',
      metadata: input.sourceMetadata ?? {},
      status: 'triaging',
      processingMode: 'automatic',
    })

    if (env.AGENT_AUTO_TRIGGER) {
      void triggerAgent(incident)
    } else {
      void incidentWorkflowService.start(incident)
    }
    return c.json({ data: incident }, 201)
  })
  .post('/test', zValidator('json', z.object({
    webhookUrl: z.string().url(),
    signKey: z.string().optional(),
    platform: z.enum(['feishu']),
  })), async (c) => {
    const { webhookUrl, signKey, platform } = c.req.valid('json')
    if (platform === 'feishu') {
      await sendFeishuMessage({ webhookUrl, signKey, text: '[Chronos] 测试消息 - 通知配置成功 ✅' })
    }
    return c.json({ data: { success: true } })
  })
