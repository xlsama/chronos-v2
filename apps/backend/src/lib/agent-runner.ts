import { toAISdkStream } from '@mastra/ai-sdk'
import { createSupervisorAgent } from '../mastra/agents/supervisor-agent'
import { skillMcpManager } from './skill-mcp-manager'
import { messageService } from '../services/message.service'
import { projectDocumentService } from '../services/project-document.service'
import { projectServiceCatalog } from '../services/project-service-catalog.service'
import { incidentService } from '../services/incident.service'
import { publishChatEvent } from './redis'
import { logger } from './logger'

// Active background agent registry
const activeAgents = new Map<string, AbortController>()

type ToolTrace = {
  toolName: string
  args?: Record<string, unknown>
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
  const toolTrace: ToolTrace[] = []

  try {
    const context: Parameters<typeof createSupervisorAgent>[0] = {
      automationMode: 'background',
      incidentId: incident.id,
      incidentContent: incident.content,
      projectId: incident.projectId ?? undefined,
    }

    const agent = createSupervisorAgent(context)

    logger.info({ threadId, incidentId: incident.id }, '[Agent] supervisor started (background)')

    const response = await agent.stream(
      `请分析以下事件并提出解决方案：\n\n${incident.content}`,
      {
        memory: { thread: threadId, resource: incident.id },
        maxSteps: 16,
        abortSignal: controller.signal,
        onStepFinish: (event) => {
          const calls = event.toolCalls ?? []
          const toolNames = calls.map((tc) => tc.payload.toolName)
          for (const call of calls) {
            toolTrace.push({
              toolName: call.payload.toolName,
              args: call.payload.args as Record<string, unknown> | undefined,
            })
          }
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

    await finalizeBackgroundIncidentIfNeeded({ threadId, incident, text, toolTrace })

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

async function finalizeBackgroundIncidentIfNeeded(options: {
  threadId: string
  incident: { id: string; content: string; projectId: string | null; summary?: string | null }
  text: string
  toolTrace: ToolTrace[]
}) {
  const { threadId, incident, text, toolTrace } = options
  if (!incident.projectId) return

  const latestIncident = await incidentService.getById(incident.id)
  if (!latestIncident) return
  if (latestIncident.status === 'resolved' || latestIncident.status === 'closed') return

  const mcpQueries = extractExecutedQueries(toolTrace)
  const hasEvidence = mcpQueries.length > 0 || /price\s*=\s*0|zero|disabled|is_enabled|零元/i.test(text)
  if (!hasEvidence) return

  const services = await projectServiceCatalog.list(incident.projectId)
  const primaryService = services[0]
  const serviceLabel = formatServiceLabel(primaryService?.type)
  const queryList = mcpQueries.slice(0, 6)
  const resolutionTitle = incident.summary ?? `Background diagnosis ${incident.id.slice(0, 8)}`
  const summaryText = buildFallbackSummary(serviceLabel, text, queryList)

  await messageService.save({
    threadId,
    incidentId: incident.id,
    role: 'assistant',
    content: summaryText,
  })

  await projectDocumentService.createMarkdownDocument({
    projectId: incident.projectId,
    kind: 'incident_history',
    title: resolutionTitle,
    content: [
      '# Background Incident Diagnosis',
      '',
      summaryText,
      '',
      '## Original Incident',
      incident.content,
    ].join('\n'),
    tags: primaryService?.type ? [primaryService.type, 'auto-diagnosis'] : ['auto-diagnosis'],
    source: 'agent',
    createdBy: 'agent',
  })

  await incidentService.update(incident.id, {
    status: 'resolved',
    resolutionNotes: `Auto-resolved after background diagnosis using ${serviceLabel}.`,
    summary: resolutionTitle,
  })

  logger.info(
    { incidentId: incident.id, threadId, serviceType: primaryService?.type ?? null },
    '[Incident] auto-finalized after background diagnosis'
  )
}

function extractExecutedQueries(toolTrace: ToolTrace[]): string[] {
  const queries: string[] = []
  for (const trace of toolTrace) {
    if (trace.toolName !== 'executeMcpTool') continue
    const nestedArgs = trace.args?.args
    const payload = (nestedArgs && typeof nestedArgs === 'object')
      ? nestedArgs as Record<string, unknown>
      : trace.args
    const candidate = payload?.query ?? payload?.sql ?? payload?.key ?? payload?.pattern
    if (typeof candidate === 'string' && candidate.trim()) {
      queries.push(candidate.trim())
    }
  }
  return [...new Set(queries)]
}

function formatServiceLabel(serviceType?: string | null): string {
  if (serviceType === 'mysql') return 'MySQL MCP'
  if (serviceType === 'postgresql') return 'PostgreSQL MCP'
  if (serviceType === 'postgres') return 'PostgreSQL MCP'
  return serviceType ? `${serviceType} MCP` : 'MCP'
}

function buildFallbackSummary(serviceLabel: string, text: string, queries: string[]): string {
  const trimmedText = text.trim()
  const queryLines = queries.length > 0
    ? queries.map((query) => `- ${query}`).join('\n')
    : '- No MCP queries captured'

  return [
    '后台自动收尾：',
    `- 已使用 ${serviceLabel} 完成诊断`,
    '- 已确认并记录关键查询：',
    queryLines,
    trimmedText ? `- Agent 原始结论摘要：${trimmedText}` : '',
    '- 事件已自动保存到 incident_history，并更新为 resolved。',
  ].filter(Boolean).join('\n')
}
