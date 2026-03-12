import { toAISdkStream } from '@mastra/ai-sdk'
import { createSupervisorAgent } from '../mastra/agents/supervisor-agent'
import { skillMcpManager } from './skill-mcp-manager'
import { messageService } from '../services/message.service'
import { publishChatEvent } from './redis'
import { logger } from './logger'

// Active background agent registry
const activeAgents = new Map<string, AbortController>()

export function abortAgent(threadId: string): boolean {
  const controller = activeAgents.get(threadId)
  if (!controller) return false
  controller.abort()
  return true
}

export function isAgentRunning(threadId: string): boolean {
  return activeAgents.has(threadId)
}

export async function runAgentStream(options: {
  threadId: string
  incidentId: string
  message: string
  context?: Parameters<typeof createSupervisorAgent>[0]
}): Promise<{ sdkStream: ReadableStream; textPromise: Promise<string> }> {
  const { threadId, incidentId, message, context } = options
  const agent = createSupervisorAgent(context)

  logger.info({ threadId, incidentId }, '[Agent] supervisor started (stream)')

  const response = await agent.stream(message, {
    memory: {
      thread: threadId,
      resource: incidentId,
    },
    maxSteps: 50,
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

  const sdkStream = toAISdkStream(response, {
    from: 'agent',
    sendReasoning: true,
    sendSources: true,
  })

  return { sdkStream: sdkStream as unknown as ReadableStream, textPromise: response.text }
}

export async function runAgentInBackground(
  threadId: string,
  incident: { id: string; content: string; projectId: string | null; summary?: string | null },
) {
  const controller = new AbortController()
  activeAgents.set(threadId, controller)
  const startTime = Date.now()

  try {
    const context: Parameters<typeof createSupervisorAgent>[0] = {
      incidentContent: incident.content,
      projectId: incident.projectId ?? undefined,
    }

    const agent = createSupervisorAgent(context)

    logger.info({ threadId, incidentId: incident.id }, '[Agent] supervisor started (background)')

    const response = await agent.stream(
      `请分析以下事件并提出解决方案：\n\n${incident.content}`,
      {
        memory: { thread: threadId, resource: incident.id },
        maxSteps: 50,
        abortSignal: controller.signal,
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
      },
    )

    const sdkStream = toAISdkStream(response, {
      from: 'agent',
      sendReasoning: true,
      sendSources: true,
    })

    // Consume stream and broadcast each chunk to Redis
    const reader = sdkStream.getReader()
    while (true) {
      if (controller.signal.aborted) break
      const { done, value } = await reader.read()
      if (done) break
      await publishChatEvent(threadId, 'stream-chunk', value)
    }

    if (controller.signal.aborted) {
      logger.info({ threadId, incidentId: incident.id, duration: `${Date.now() - startTime}ms` }, '[Agent] supervisor aborted')
      await skillMcpManager.deactivateAll()
      await publishChatEvent(threadId, 'stream-aborted', { threadId })
      return
    }

    // Save complete assistant message
    const text = await response.text
    await messageService.save({
      threadId,
      incidentId: incident.id,
      role: 'assistant',
      content: text,
    })

    logger.info(
      { threadId, incidentId: incident.id, duration: `${Date.now() - startTime}ms` },
      '[Agent] supervisor completed'
    )

    await publishChatEvent(threadId, 'stream-end', { threadId })
  } catch (error) {
    if (controller.signal.aborted) {
      logger.info({ threadId, incidentId: incident.id, duration: `${Date.now() - startTime}ms` }, '[Agent] supervisor aborted')
      await skillMcpManager.deactivateAll()
      await publishChatEvent(threadId, 'stream-aborted', { threadId })
      return
    }
    logger.error(
      { err: error, incidentId: incident.id, duration: `${Date.now() - startTime}ms` },
      '[Agent] supervisor failed'
    )
    await publishChatEvent(threadId, 'stream-error', {
      error: error instanceof Error ? error.message : 'Agent execution failed',
    })
  } finally {
    activeAgents.delete(threadId)
  }
}
