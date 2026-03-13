import { toAISdkStream } from '@mastra/ai-sdk'
import { createSupervisorAgent } from '../mastra/agents/supervisor-agent'
import { logger, truncate } from './logger'
import { agentContextStorage, createAgentContext, popCurrentAgent, pushCurrentAgent } from './agent-context'
import { agentBackgroundQueue } from './queues'

// Active background agent registry (shared with worker in same process)
const activeAgents = new Map<string, AbortController>()

export function registerActiveAgent(threadId: string, controller: AbortController) {
  activeAgents.set(threadId, controller)
}

export function removeActiveAgent(threadId: string) {
  activeAgents.delete(threadId)
}

export function getActiveAgent(threadId: string) {
  return activeAgents.get(threadId)
}

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
  const agent = await createSupervisorAgent(context)

  logger.info({ threadId, incidentId }, '[Agent] supervisor started (stream)')

  const response = await agentContextStorage.run(createAgentContext({ threadId, incidentId }), () => agent.stream(message, {
    memory: {
      thread: threadId,
      resource: incidentId,
    },
    maxSteps: 30,
    onStepFinish: (event) => {
      const calls = event.toolCalls ?? []
      const toolNames = calls.map((tc) => tc.payload.toolName)
      for (const call of calls) {
        logger.debug(
          { threadId, tool: call.payload.toolName, args: truncate(call.payload.args) },
          '[Agent] tool call detail',
        )
      }
      if (toolNames.length > 0) {
        logger.info({ threadId, tools: toolNames }, '[Agent] step finished with tool calls')
      }
    },
    delegation: {
      onDelegationStart: ({ primitiveId, primitiveType }) => {
        if (primitiveType === 'agent') {
          pushCurrentAgent({ id: primitiveId, name: primitiveId })
        }
        logger.info({ threadId, agentId: primitiveId, type: primitiveType }, '[Agent] delegating to sub-agent')
      },
      onDelegationComplete: ({ primitiveId, duration, success, error }) => {
        popCurrentAgent(primitiveId)
        logger.info(
          { threadId, agentId: primitiveId, duration: `${duration}ms`, success, error: error?.message },
          '[Agent] sub-agent completed',
        )
      },
    },
  }))

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
  await agentBackgroundQueue.add('analyze-incident', {
    threadId,
    incidentId: incident.id,
    content: incident.content,
    projectId: incident.projectId,
    summary: incident.summary,
  }, {
    jobId: `agent-${threadId}`,
  })

  logger.info({ threadId, incidentId: incident.id }, '[Agent] background job enqueued')
}
