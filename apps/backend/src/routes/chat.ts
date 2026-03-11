import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import type { MessageListInput } from '@mastra/core/agent/message-list'
import type { LLMStepResult } from '@mastra/core/agent'
import { messageService } from '../services/message.service'
import { kbService } from '../services/knowledge-base.service'
import { publisher, redis, createSubscriber } from '../lib/redis'
import { logger } from '../lib/logger'
import { supervisorAgent } from '../mastra/agents/supervisor-agent'
import { formatKbContext } from '../lib/kb-context'
import { buildSkillsManifest } from '../lib/skills-manifest'

export const chatRoutes = new Hono()
  .post(
    '/',
    zValidator(
      'json',
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(['user', 'assistant', 'system']),
            content: z.string(),
          }),
        ),
        threadId: z.string().optional(),
        incidentId: z.string().optional(),
        knowledgeBaseIds: z.array(z.string().uuid()).optional(),
      }),
    ),
    async (c) => {
      const { messages, incidentId, knowledgeBaseIds } = c.req.valid('json')
      const threadId = c.req.valid('json').threadId ?? crypto.randomUUID()

      // Save user message
      const lastMessage = messages[messages.length - 1]
      if (lastMessage?.role === 'user') {
        await messageService.create({
          threadId,
          ...(incidentId && { incidentId }),
          role: 'user',
          content: lastMessage.content,
        })
      }

      // Build context array
      const context: { role: 'system'; content: string }[] = []

      if (incidentId) {
        context.push({
          role: 'system' as const,
          content: `当前处理的事件 ID: ${incidentId}\n在调用 updateIncidentStatus 等工具时，请使用此 ID。`,
        })
      }

      // Knowledge base vector search
      if (knowledgeBaseIds && knowledgeBaseIds.length > 0 && lastMessage?.role === 'user') {
        try {
          const kbResults = await kbService.searchByVector(lastMessage.content, {
            projectIds: knowledgeBaseIds,
            limit: 5,
          })
          if (kbResults.length > 0) {
            context.push({
              role: 'system' as const,
              content: formatKbContext(kbResults),
            })
          }
        } catch (err) {
          logger.warn({ err, threadId }, 'Failed to search knowledge base')
        }
      }

      // Skills manifest for supervisor agent
      const skillsManifest = await buildSkillsManifest()
      if (skillsManifest) {
        context.push({ role: 'system' as const, content: skillsManifest })
      }

      logger.info({ threadId, lastMessage: lastMessage?.content?.slice(0, 200) }, 'Agent request (chat)')

      const result = await supervisorAgent.stream(messages as MessageListInput, {
        maxSteps: 50,
        ...(context.length > 0 && { context }),
        memory: { thread: threadId, resource: threadId },
        onIterationComplete: async (ctx) => {
          logger.info({ threadId, iteration: ctx.iteration, finishReason: ctx.finishReason }, 'Iteration complete')
          return { continue: true }
        },
        delegation: {
          onDelegationStart: async (ctx) => {
            logger.info({ threadId, primitiveId: ctx.primitiveId }, 'Delegation start')
            return { proceed: true }
          },
          onDelegationComplete: async (ctx) => {
            if (ctx.error) {
              logger.error({ threadId, primitiveId: ctx.primitiveId, error: ctx.error }, 'Delegation failed')
              return { feedback: `${ctx.primitiveId} 执行失败: ${ctx.error}，请考虑替代方案。` }
            }
            logger.info({ threadId, primitiveId: ctx.primitiveId }, 'Delegation complete')
          },
        },
      })

      // Save assistant message after stream completes
      Promise.all([result.text, result.steps])
        .then(async ([text, steps]: [string, LLMStepResult<unknown>[]]) => {
          logger.info({ threadId, text: text.slice(0, 200), stepsCount: steps.length }, 'Agent response (chat)')
          await messageService.create({
            threadId,
            ...(incidentId && { incidentId }),
            role: 'assistant',
            content: text,
            toolInvocations: steps.length > 0 ? steps : undefined,
          })
        })
        .catch((err) => logger.error(err, 'Failed to save assistant message'))
        .finally(() => redis.del(`stream:active:${threadId}`).catch(() => {}))

      // Mark stream as active + build response with Redis Pub/Sub broadcast
      await redis.set(`stream:active:${threadId}`, '1', 'EX', 300)

      const encoder = new TextEncoder()
      const transform = new TransformStream<string, Uint8Array>({
        transform(chunk, controller) {
          const encoded = encoder.encode(chunk)
          controller.enqueue(encoded)
          publisher.publish(`chat:${threadId}`, chunk)
        },
        flush() {
          publisher.publish(`chat:${threadId}`, '[DONE]')
        },
      })

      const readable = (result.textStream as unknown as ReadableStream<string>).pipeThrough(transform)
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-Thread-Id': threadId,
        },
      })
    },
  )
  .get('/:threadId/subscribe', async (c) => {
    const threadId = c.req.param('threadId')

    const isActive = await redis.get(`stream:active:${threadId}`)
    if (!isActive) {
      return c.json({ error: 'No active stream for this thread' }, 404)
    }

    return streamSSE(c, async (stream) => {
      const subscriber = createSubscriber()

      await subscriber.subscribe(`chat:${threadId}`)

      await new Promise<void>((resolve) => {
        subscriber.on('message', async (_channel, message) => {
          try {
            if (message === '[DONE]') {
              await stream.writeSSE({ data: '', event: 'done' })
              resolve()
              return
            }
            await stream.writeSSE({ data: message, event: 'chunk' })
          } catch {
            resolve()
          }
        })

        stream.onAbort(() => resolve())
      })

      await subscriber.unsubscribe(`chat:${threadId}`).catch(() => {})
      await subscriber.quit().catch(() => {})
    })
  })
  .get('/:threadId/messages', async (c) => {
    const threadId = c.req.param('threadId')
    const data = await messageService.listByThreadId(threadId)
    return c.json({ data })
  })
