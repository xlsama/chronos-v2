import type { MessageListInput } from '@mastra/core/agent/message-list'
import { toAISdkStream } from '@mastra/ai-sdk'
import { incidentService } from '../services/incident.service'
import { messageService } from '../services/message.service'
import { kbService } from '../services/knowledge-base.service'
import { supervisorAgent } from '../mastra/agents/supervisor-agent'
import { publisher, redis } from './redis'
import { logger } from './logger'
import { buildMultimodalParts } from './attachment-parts'
import { notifyIncidentStatusChanged } from './notify'
import { formatKbContext } from './kb-context'

type IncidentRow = NonNullable<Awaited<ReturnType<typeof incidentService.getById>>>

interface TriggerOptions {
  knowledgeBaseIds?: string[]
}

export async function triggerAgentForIncident(incident: IncidentRow, options?: TriggerOptions): Promise<{ threadId: string }> {
  const threadId = crypto.randomUUID()

  // Update incident with threadId and status
  await incidentService.update(incident.id, { threadId, status: 'triaging' })

  // Build multimodal message content
  const messageContent = await buildMultimodalParts(
    incident.content,
    incident.attachments as { type: 'image' | 'file'; url: string; name: string; mimeType: string }[] | null,
  )

  // Save user message
  await messageService.create({
    threadId,
    incidentId: incident.id,
    role: 'user',
    content: incident.content,
  })

  // Build context array
  const context: { role: 'system'; content: string }[] = [
    {
      role: 'system' as const,
      content: `当前处理的事件 ID: ${incident.id}\n在调用 updateIncidentStatus 等工具时，请使用此 ID。`,
    },
  ]

  // Knowledge base vector search
  if (options?.knowledgeBaseIds && options.knowledgeBaseIds.length > 0) {
    try {
      const kbResults = await kbService.searchByVector(incident.content, {
        projectIds: options.knowledgeBaseIds,
        limit: 10,
      })
      if (kbResults.length > 0) {
        context.push({
          role: 'system' as const,
          content: formatKbContext(kbResults),
        })
      }
    } catch (err) {
      logger.warn({ err, incidentId: incident.id }, 'Failed to search knowledge base for incident')
    }
  }

  const messages = [{ role: 'user' as const, content: messageContent }]

  logger.info({ incidentId: incident.id, content: incident.content.slice(0, 200) }, 'Agent request (auto-trigger)')

  // Fire-and-forget: stream agent response
  supervisorAgent.stream(messages as MessageListInput, {
    maxSteps: 50,
    context,
    memory: { thread: threadId, resource: threadId },
    onIterationComplete: async (ctx) => {
      logger.info({ threadId, incidentId: incident.id, iteration: ctx.iteration, finishReason: ctx.finishReason }, 'Iteration complete')
      return { continue: true }
    },
    delegation: {
      onDelegationStart: async (ctx) => {
        logger.info({ threadId, incidentId: incident.id, primitiveId: ctx.primitiveId }, 'Delegation start')
        return { proceed: true }
      },
      onDelegationComplete: async (ctx) => {
        if (ctx.error) {
          logger.error({ threadId, incidentId: incident.id, primitiveId: ctx.primitiveId, error: ctx.error }, 'Delegation failed')
          return { feedback: `${ctx.primitiveId} 执行失败: ${ctx.error}，请考虑替代方案。` }
        }
        logger.info({ threadId, incidentId: incident.id, primitiveId: ctx.primitiveId }, 'Delegation complete')
      },
    },
  })
    .then(async (result) => {
      // Mark stream as active
      await redis.set(`stream:active:${threadId}`, '1', 'EX', 300)

      // Consume fullStream via toAISdkStream and broadcast structured events
      const aiSdkStream = toAISdkStream(result, {
        from: 'agent',
        sendReasoning: true,
      })
      const reader = aiSdkStream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          publisher.publish(`chat:${threadId}`, JSON.stringify(value))
        }
      } finally {
        reader.releaseLock()
      }

      publisher.publish(`chat:${threadId}`, '[DONE]')

      // Save assistant message
      const [text, steps] = await Promise.all([result.text, result.steps])
      await messageService.create({
        threadId,
        incidentId: incident.id,
        role: 'assistant',
        content: text,
        toolInvocations: steps.length > 0 ? steps : undefined,
      })

      logger.info({ threadId, incidentId: incident.id, text: text.slice(0, 200), stepsCount: steps.length }, 'Agent response (auto-trigger)')
      await redis.del(`stream:active:${threadId}`).catch(() => {})
    })
    .catch(async (err) => {
      logger.error({ err, threadId, incidentId: incident.id }, 'Agent failed to process incident')
      const updated = await incidentService.update(incident.id, { status: 'waiting_human' }).catch(() => null)
      if (updated) {
        notifyIncidentStatusChanged(updated, 'triaging', 'waiting_human')
      }
      await redis.del(`stream:active:${threadId}`).catch(() => {})
      publisher.publish(`chat:${threadId}`, '[DONE]')
    })

  return { threadId }
}
