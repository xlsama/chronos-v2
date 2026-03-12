import { toAISdkStream } from '@mastra/ai-sdk'
import { createSupervisorAgent } from '../mastra/agents/supervisor-agent'
import { messageService } from '../services/message.service'
import { publishChatEvent } from './redis'
import { logger } from './logger'

export async function runAgentStream(options: {
  threadId: string
  incidentId: string
  message: string
  context?: Parameters<typeof createSupervisorAgent>[0]
}): Promise<{ sdkStream: ReadableStream; textPromise: Promise<string> }> {
  const { threadId, incidentId, message, context } = options
  const agent = createSupervisorAgent(context)

  const response = await agent.stream(message, {
    memory: {
      thread: threadId,
      resource: incidentId,
    },
    maxSteps: 10,
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
  try {
    const context: Parameters<typeof createSupervisorAgent>[0] = {
      incidentContent: incident.content,
      projectId: incident.projectId ?? undefined,
    }

    const agent = createSupervisorAgent(context)
    const response = await agent.stream(
      `请分析以下事件并提出解决方案：\n\n${incident.content}`,
      {
        memory: { thread: threadId, resource: incident.id },
        maxSteps: 10,
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
      const { done, value } = await reader.read()
      if (done) break
      await publishChatEvent(threadId, 'stream-chunk', value)
    }

    // Save complete assistant message
    const text = await response.text
    await messageService.save({
      threadId,
      incidentId: incident.id,
      role: 'assistant',
      content: text,
    })

    await publishChatEvent(threadId, 'stream-end', { threadId })
  } catch (error) {
    logger.error({ err: error, incidentId: incident.id }, 'Background agent failed')
    await publishChatEvent(threadId, 'stream-error', {
      error: error instanceof Error ? error.message : 'Agent execution failed',
    })
  }
}
