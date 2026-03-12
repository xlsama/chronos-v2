import { Hono } from 'hono'
import { logger } from '../lib/logger'
import { publishChatEvent, getSubscriber, chatChannel } from '../lib/redis'
import { messageService } from '../services/message.service'
import { incidentService } from '../services/incident.service'
import { createSupervisorAgent } from '../mastra/agents/supervisor-agent'

export const chatRoutes = new Hono()
  // Stream chat response
  .post('/', async (c) => {
    const body = await c.req.json<{
      threadId: string
      incidentId?: string
      message: string
    }>()

    const { threadId, incidentId, message } = body
    if (!threadId || !message) {
      return c.json({ error: 'threadId and message are required' }, 400)
    }

    // Save user message
    await messageService.save({
      threadId,
      incidentId,
      role: 'user',
      content: message,
    })

    // Build context from incident if available
    let context: Parameters<typeof createSupervisorAgent>[0] = undefined
    if (incidentId) {
      const incident = await incidentService.getById(incidentId)
      if (incident) {
        context = {
          incidentContent: incident.content,
          incidentSummary: incident.summary ?? undefined,
          analysis: incident.analysis as Record<string, unknown> | undefined,
          selectedSkills: incident.selectedSkills,
          projectId: incident.projectId ?? undefined,
        }
      }
    }

    // Create supervisor agent with incident context
    const agent = createSupervisorAgent(context)

    // Use Mastra agent stream with memory (threadId-based)
    const response = await agent.stream(message, {
      memory: {
        thread: threadId,
        resource: incidentId ?? 'chat',
      },
      maxSteps: 10,
    })

    // Save assistant message on completion in the background
    response.text.then(async (text) => {
      await messageService.save({
        threadId,
        incidentId,
        role: 'assistant',
        content: text,
      })
      await publishChatEvent(threadId, 'message', {
        role: 'assistant',
        content: text,
      }).catch((err) => logger.warn({ err }, 'Failed to publish chat event'))
    }).catch((err) => logger.error({ err }, 'Failed to save assistant message'))

    // Broadcast stream start
    publishChatEvent(threadId, 'stream-start', { threadId }).catch(() => {})

    // Pipe Mastra textStream into a web-compatible byte stream
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response.textStream) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  })

  // SSE subscription for real-time updates
  .get('/:threadId/subscribe', async (c) => {
    const { threadId } = c.req.param()
    const sub = getSubscriber()
    const channel = chatChannel(threadId)

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()

        const onMessage = (_ch: string, msg: string) => {
          try {
            controller.enqueue(encoder.encode(`data: ${msg}\n\n`))
          } catch {
            // Stream closed
          }
        }

        sub.subscribe(channel).then(() => {
          sub.on('message', onMessage)
        })

        // Heartbeat
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'))
          } catch {
            clearInterval(heartbeat)
          }
        }, 15000)

        // Cleanup on close
        c.req.raw.signal.addEventListener('abort', () => {
          clearInterval(heartbeat)
          sub.unsubscribe(channel).catch(() => {})
          sub.removeListener('message', onMessage)
          try { controller.close() } catch {}
        })
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  })

  // Get message history
  .get('/:threadId/messages', async (c) => {
    const { threadId } = c.req.param()
    const messages = await messageService.listByThread(threadId)
    return c.json({ data: messages })
  })
