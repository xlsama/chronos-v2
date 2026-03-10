import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { messageService } from '../services/message.service'
import { publisher, redis, createSubscriber } from '../lib/redis'
import { logger } from '../lib/logger'
import { mcpRegistry } from '../mcp/registry'
import { opsAgent } from '../mastra/agents/ops-agent'

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
      }),
    ),
    async (c) => {
      const { messages, incidentId } = c.req.valid('json')
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

      // Stream via Mastra Agent, inject MCP tools as toolset
      const mcpTools = mcpRegistry.getAllToolsAsAISDK()
      logger.info({ threadId, lastMessage: lastMessage?.content?.slice(0, 200) }, 'Agent request (chat)')

      const result = await opsAgent.stream(messages as any, {
        maxSteps: 50,
        toolsets: Object.keys(mcpTools).length > 0 ? { mcp: mcpTools } : undefined,
      })

      // Save assistant message after stream completes
      Promise.all([result.text, result.steps])
        .then(async ([text, steps]) => {
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

      return new Response(result.textStream.pipeThrough(transform as any) as any, {
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
