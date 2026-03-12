import { Hono } from 'hono'
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from 'ai'
import { toAISdkStream } from '@mastra/ai-sdk'
import { logger } from '../lib/logger'
import { publishChatEvent, getSubscriber, chatChannel } from '../lib/redis'
import { messageService } from '../services/message.service'
import { incidentService } from '../services/incident.service'
import { projectService } from '../services/project.service'
import { createSupervisorAgent } from '../mastra/agents/supervisor-agent'

export const chatRoutes = new Hono()
  // Stream chat response (AI SDK UIMessage protocol)
  .post('/', async (c) => {
    const body = await c.req.json<{
      messages: UIMessage[]
      threadId: string
      incidentId?: string
    }>()

    const { messages: uiMessages, threadId, incidentId } = body
    if (!threadId || !uiMessages?.length) {
      return c.json({ error: 'threadId and messages are required' }, 400)
    }

    // Extract last user message text
    const lastMessage = uiMessages[uiMessages.length - 1]
    const messageText = lastMessage.parts
      ?.filter((p: { type: string }) => p.type === 'text')
      .map((p: { type: string; text?: string }) => p.text ?? '')
      .join('') ?? ''

    if (!messageText.trim()) {
      return c.json({ error: 'Empty message' }, 400)
    }

    // Save user message
    await messageService.save({
      threadId,
      incidentId,
      role: 'user',
      content: messageText,
    })

    // Build context from incident if available
    let context: Parameters<typeof createSupervisorAgent>[0] = undefined
    if (incidentId) {
      const incident = await incidentService.getById(incidentId)
      if (incident) {
        let projectName: string | undefined
        if (incident.projectId) {
          const project = await projectService.getById(incident.projectId)
          projectName = project?.name
        }
        context = {
          incidentContent: incident.content,
          incidentSummary: incident.summary ?? undefined,
          analysis: incident.analysis as Record<string, unknown> | undefined,
          selectedSkills: incident.selectedSkills,
          projectId: incident.projectId ?? undefined,
          projectName,
        }
      }
    }

    // Create supervisor agent with incident context
    const agent = createSupervisorAgent(context)

    logger.info({ threadId, incidentId }, '[Agent] supervisor started')

    const response = await agent.stream(messageText, {
      memory: {
        thread: threadId,
        resource: incidentId ?? 'chat',
      },
      maxSteps: 10,
      onStepFinish: (event) => {
        const toolNames = event.toolCalls?.map((tc) => tc.payload.toolName) ?? []
        if (toolNames.length > 0) {
          logger.info({ threadId, tools: toolNames }, '[Agent] step finished with tool calls')
        }
      },
      delegation: {
        onDelegationStart: ({ primitiveId, primitiveType }) => {
          logger.info({ threadId, agentId: primitiveId, type: primitiveType }, '[Agent] delegating to sub-agent')
        },
        onDelegationComplete: ({ primitiveId, duration, success, error }) => {
          logger.info(
            { threadId, agentId: primitiveId, duration: `${duration}ms`, success, error: error?.message },
            '[Agent] sub-agent completed',
          )
        },
      },
    })

    logger.info({ threadId }, '[Agent] supervisor stream created')

    // Convert Mastra stream to AI SDK UIMessage stream
    const sdkStream = toAISdkStream(response, {
      from: 'agent',
      sendReasoning: true,
      sendSources: true,
    })

    // Broadcast stream start
    publishChatEvent(threadId, 'stream-start', { threadId }).catch(() => {})

    // Wrap in createUIMessageStream for onFinish callback
    const uiStream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Cast needed: @mastra/ai-sdk uses node:stream/web ReadableStream
        // while ai package expects Web API ReadableStream
        writer.merge(sdkStream as unknown as ReadableStream)
      },
      onFinish: async ({ responseMessage }) => {
        try {
          const textContent = responseMessage.parts
            .filter((p) => p.type === 'text')
            .map((p) => (p as { type: 'text'; text: string }).text)
            .join('')

          await messageService.save({
            threadId,
            incidentId,
            role: 'assistant',
            content: textContent,
            metadata: { parts: responseMessage.parts },
          })

          await publishChatEvent(threadId, 'message', {
            id: responseMessage.id,
            role: 'assistant',
            parts: responseMessage.parts,
          })
        } catch (err) {
          logger.error({ err }, 'Failed to save assistant message')
        }
      },
    })

    return createUIMessageStreamResponse({ stream: uiStream })
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

  // Get message history (UIMessage-compatible format)
  .get('/:threadId/messages', async (c) => {
    const { threadId } = c.req.param()
    const dbMessages = await messageService.listByThread(threadId)

    const uiMessages = dbMessages.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      parts: (msg.metadata as Record<string, unknown>)?.parts ?? [
        { type: 'text', text: msg.content ?? '' },
      ],
      createdAt: new Date(msg.createdAt),
    }))

    return c.json(uiMessages)
  })
