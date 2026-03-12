import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { createUIMessageStream, createUIMessageStreamResponse, convertToModelMessages } from 'ai'
import type { UIMessage } from 'ai'
import { toAISdkStream } from '@mastra/ai-sdk'
import type { MessageListInput } from '@mastra/core/agent/message-list'
import type { LLMStepResult } from '@mastra/core/agent'
import { messageService } from '../services/message.service'
import { kbService } from '../services/knowledge-base.service'
import { publisher, redis, createSubscriber } from '../lib/redis'
import { logger } from '../lib/logger'
import { supervisorAgent } from '../mastra/agents/supervisor-agent'
import { formatKbContext } from '../lib/kb-context'

// UIMessage part schema for zod validation (loose, since parts can vary)
const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(z.record(z.string(), z.unknown())),
  createdAt: z.unknown().optional(),
})

export const chatRoutes = new Hono()
  .post(
    '/',
    zValidator(
      'json',
      z.object({
        messages: z.array(uiMessageSchema),
        id: z.string().optional(),
        incidentId: z.string().optional(),
        knowledgeBaseIds: z.array(z.string().uuid()).optional(),
        trigger: z.string().optional(),
        messageId: z.string().optional(),
      }),
    ),
    async (c) => {
      const { messages, incidentId, knowledgeBaseIds } = c.req.valid('json')
      const threadId = c.req.valid('json').id ?? crypto.randomUUID()

      // Extract last user message text from UIMessage parts
      const lastUserMsg = messages.findLast((m) => m.role === 'user')
      const lastUserText =
        (lastUserMsg?.parts?.find((p) => p.type === 'text') as { type: string; text: string } | undefined)?.text ?? ''

      // Save user message
      if (lastUserMsg && lastUserText) {
        await messageService.create({
          threadId,
          ...(incidentId && { incidentId }),
          role: 'user',
          content: lastUserText,
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
      if (knowledgeBaseIds && knowledgeBaseIds.length > 0 && lastUserText) {
        try {
          const kbResults = await kbService.searchByVector(lastUserText, {
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

      // Convert UIMessage[] to CoreMessage[] for Mastra
      const coreMessages = await convertToModelMessages(messages as UIMessage[])

      logger.info({ threadId, lastMessage: lastUserText.slice(0, 200) }, 'Agent request (chat)')

      const result = await supervisorAgent.stream(coreMessages as MessageListInput, {
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

      // Mark stream as active
      await redis.set(`stream:active:${threadId}`, '1', 'EX', 300)

      // Convert Mastra stream to AI SDK UI message stream
      const aiSdkStream = toAISdkStream(result, {
        from: 'agent',
        sendReasoning: true,
      })

      // Create UI message stream with Redis broadcast
      const uiStream = createUIMessageStream({
        execute: async ({ writer }) => {
          const reader = aiSdkStream.getReader()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              writer.write(value as any)
              // Broadcast to Redis for SSE subscribers
              publisher.publish(`chat:${threadId}`, JSON.stringify(value))
            }
          } finally {
            reader.releaseLock()
            publisher.publish(`chat:${threadId}`, '[DONE]')
          }
        },
      })

      return createUIMessageStreamResponse({
        stream: uiStream,
        headers: { 'X-Thread-Id': threadId },
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
            // Forward structured JSON stream parts
            await stream.writeSSE({ data: message, event: 'part' })
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
    const rows = await messageService.listByThreadId(threadId)

    // Convert DB messages to UIMessage format for useChat initialMessages
    const data = rows.map(toUIMessage)
    return c.json({ data })
  })

// DB message → UIMessage format
interface DbMessage {
  id: string
  role: string
  content: string | null
  toolInvocations: unknown
  createdAt: Date
}

function toUIMessage(msg: DbMessage): UIMessage {
  const parts: UIMessage['parts'] = []

  if (msg.content) {
    parts.push({ type: 'text' as const, text: msg.content })
  }

  // Reconstruct tool parts from toolInvocations (LLMStepResult[])
  if (msg.toolInvocations && Array.isArray(msg.toolInvocations)) {
    for (const step of msg.toolInvocations) {
      const s = step as {
        toolCalls?: { payload: { toolCallId: string; toolName: string; args: Record<string, unknown> } }[]
        toolResults?: { payload: { toolCallId: string; result: unknown } }[]
      }
      for (const tc of s.toolCalls ?? []) {
        const matchingResult = s.toolResults?.find(
          (tr) => tr.payload.toolCallId === tc.payload.toolCallId,
        )
        parts.push({
          type: 'tool-invocation' as const,
          toolInvocation: {
            toolCallId: tc.payload.toolCallId,
            toolName: tc.payload.toolName,
            args: tc.payload.args,
            state: 'result' as const,
            result: matchingResult?.payload.result,
          },
        } as unknown as UIMessage['parts'][number])
      }
    }
  }

  return {
    id: msg.id,
    role: msg.role as UIMessage['role'],
    parts,
    createdAt: msg.createdAt,
  } as UIMessage
}
