import { incidentService } from '../services/incident.service'
import { messageService } from '../services/message.service'
import { mcpRegistry } from '../mcp/registry'
import { opsAgent } from '../mastra/agents/ops-agent'
import { publisher, redis } from './redis'
import { logger } from './logger'
import { buildMultimodalParts } from './attachment-parts'
import { notifyIncidentStatusChanged } from './notify'

type IncidentRow = NonNullable<Awaited<ReturnType<typeof incidentService.getById>>>

export async function triggerAgentForIncident(incident: IncidentRow): Promise<{ threadId: string }> {
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

  // Fire-and-forget: stream agent response
  const mcpTools = mcpRegistry.getAllToolsAsAISDK()
  const messages = [{ role: 'user' as const, content: messageContent }]

  logger.info({ incidentId: incident.id, messageCount: messages.length, content: incident.content.slice(0, 200) }, 'Agent request (auto-trigger)')

  opsAgent
    .stream(messages as any, {
      maxSteps: 50,
      toolsets: Object.keys(mcpTools).length > 0 ? { mcp: mcpTools } : undefined,
    })
    .then(async (result) => {
      // Mark stream as active
      await redis.set(`stream:active:${threadId}`, '1', 'EX', 300)

      // Consume stream + broadcast via Redis Pub/Sub
      const encoder = new TextEncoder()
      const transform = new TransformStream<string, Uint8Array>({
        transform(chunk, controller) {
          controller.enqueue(encoder.encode(chunk))
          publisher.publish(`chat:${threadId}`, chunk)
        },
        flush() {
          publisher.publish(`chat:${threadId}`, '[DONE]')
        },
      })

      const reader = result.textStream.pipeThrough(transform as any).getReader()
      // Drain the stream
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }

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
