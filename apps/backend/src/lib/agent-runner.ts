import { toAISdkStream } from '@mastra/ai-sdk'
import { createSupervisorAgent } from '../mastra/agents/supervisor-agent'
import { skillMcpManager } from './skill-mcp-manager'
import { type SummaryToolTrace } from './final-summary'
import { messageService } from '../services/message.service'
import { finalSummaryService } from '../services/final-summary.service'
import { projectServiceCatalog } from '../services/project-service-catalog.service'
import { incidentService } from '../services/incident.service'
import { publishChatEvent } from './redis'
import { logger } from './logger'

// Active background agent registry
const activeAgents = new Map<string, AbortController>()
const BACKGROUND_ATTEMPT_TIMEOUT_MS = 120_000
const BACKGROUND_MAX_ATTEMPTS = 2

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
  const toolTrace: SummaryToolTrace[] = []
  let lastError: unknown = null

  try {
    const context: Parameters<typeof createSupervisorAgent>[0] = {
      automationMode: 'background',
      incidentId: incident.id,
      incidentContent: incident.content,
      projectId: incident.projectId ?? undefined,
    }

    logger.info({ threadId, incidentId: incident.id }, '[Agent] supervisor started (background)')
    for (let attempt = 1; attempt <= BACKGROUND_MAX_ATTEMPTS; attempt += 1) {
      const attemptToolTrace: SummaryToolTrace[] = []
      const agent = createSupervisorAgent(context)
      const timeoutSignal = AbortSignal.timeout(BACKGROUND_ATTEMPT_TIMEOUT_MS)
      const abortSignal = AbortSignal.any([controller.signal, timeoutSignal])
      lastError = null

      try {
        if (attempt > 1) {
          logger.warn(
            { threadId, incidentId: incident.id, attempt, maxAttempts: BACKGROUND_MAX_ATTEMPTS },
            '[Agent] retrying background diagnosis attempt',
          )
        }

        const response = await agent.stream(
          `请分析以下事件并提出解决方案：\n\n${incident.content}`,
          {
            memory: { thread: threadId, resource: incident.id },
            maxSteps: 16,
            abortSignal,
            onStepFinish: (event) => {
              const calls = event.toolCalls ?? []
              const toolNames = calls.map((tc) => tc.payload.toolName)
              for (const call of calls) {
                attemptToolTrace.push({
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

        const reader = sdkStream.getReader()
        while (true) {
          if (controller.signal.aborted || timeoutSignal.aborted) break
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

        if (timeoutSignal.aborted) {
          throw new Error(`Background diagnosis attempt timed out after ${BACKGROUND_ATTEMPT_TIMEOUT_MS}ms`)
        }

        const rawText = await response.text
        const text = resolveAssistantText(rawText, attemptToolTrace)
        toolTrace.push(...attemptToolTrace)

        const shouldRetry = shouldRetryBackgroundAttempt(text, attemptToolTrace)
        if (shouldRetry && attempt < BACKGROUND_MAX_ATTEMPTS) {
          logger.warn(
            { threadId, incidentId: incident.id, attempt, text },
            '[Agent] background attempt ended without enough progress; retrying',
          )
          continue
        }

        await messageService.save({
          threadId,
          incidentId: incident.id,
          role: 'assistant',
          content: text,
        })

        await finalizeBackgroundIncidentIfNeeded({ threadId, incident, text, toolTrace })
        try {
          await finalSummaryService.ensureForIncident({ incidentId: incident.id, threadId, toolTrace })
        } catch (summaryError) {
          logger.error(
            { err: summaryError, threadId, incidentId: incident.id },
            '[Summary] failed to generate final summary after background run',
          )
        }

        logger.info(
          { threadId, incidentId: incident.id, duration: `${Date.now() - startTime}ms`, attempt },
          '[Agent] supervisor completed'
        )

        await publishChatEvent(threadId, 'stream-end', { threadId })
        return
      } catch (error) {
        lastError = error
        if (controller.signal.aborted) {
          logger.info({ threadId, incidentId: incident.id, duration: `${Date.now() - startTime}ms` }, '[Agent] supervisor aborted')
          await skillMcpManager.deactivateAll()
          await publishChatEvent(threadId, 'stream-aborted', { threadId })
          return
        }

        if (attempt < BACKGROUND_MAX_ATTEMPTS) {
          logger.warn(
            { err: error, threadId, incidentId: incident.id, attempt },
            '[Agent] background attempt failed; retrying',
          )
          continue
        }
      } finally {
        await deactivateTrackedSkills(attemptToolTrace)
      }
    }
  } catch (error) {
    lastError = error
  } finally {
    if (lastError) {
      logger.error(
        { err: lastError, incidentId: incident.id, duration: `${Date.now() - startTime}ms` },
        '[Agent] supervisor failed'
      )
      await publishChatEvent(threadId, 'stream-error', {
        error: lastError instanceof Error ? lastError.message : 'Agent execution failed',
      })
    }
    activeAgents.delete(threadId)
  }
}

async function finalizeBackgroundIncidentIfNeeded(options: {
  threadId: string
  incident: { id: string; content: string; projectId: string | null; summary?: string | null }
  text: string
  toolTrace: SummaryToolTrace[]
}) {
  const { threadId, incident, text, toolTrace } = options
  if (!incident.projectId) return

  const latestIncident = await incidentService.getById(incident.id)
  if (!latestIncident) return
  if (latestIncident.status === 'resolved' || latestIncident.status === 'closed') return

  const mcpQueries = extractExecutedQueries(toolTrace)
  const meaningfulQueries = extractMeaningfulQueries(mcpQueries)
  const hasEvidence = meaningfulQueries.length > 0 && hasConfidentDiagnosis(text)
  if (!hasEvidence) return

  const services = await projectServiceCatalog.list(incident.projectId)
  const primaryService = services[0]
  const serviceLabel = formatServiceLabel(primaryService?.type)
  const resolutionTitle = incident.summary ?? `Background diagnosis ${incident.id.slice(0, 8)}`

  await incidentService.update(incident.id, {
    status: 'resolved',
    resolutionNotes: buildResolutionNotes(serviceLabel, text, meaningfulQueries.slice(0, 6)),
    summary: resolutionTitle,
  })

  logger.info(
    { incidentId: incident.id, threadId, serviceType: primaryService?.type ?? null },
    '[Incident] auto-finalized after background diagnosis'
  )
}

function extractExecutedQueries(toolTrace: SummaryToolTrace[]): string[] {
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

function extractMeaningfulQueries(queries: string[]): string[] {
  return queries.filter((query) => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return false

    const discoveryPatterns = [
      /^show\s+databases\b/,
      /^show\s+tables\b/,
      /^use\s+[\w-]+\s*;\s*show\s+tables\b/,
      /^select\s+database\s*\(\s*\)\s*;?$/,
      /^select\s+table_name\s+from\s+information_schema\.tables\b/,
      /^\*$/,
    ]

    return !discoveryPatterns.some((pattern) => pattern.test(normalized))
  })
}

function hasConfidentDiagnosis(text: string): boolean {
  const normalized = text.trim()
  if (!normalized) return false

  const uncertaintyPatterns = [
    /解析有问题/i,
    /让我尝试/i,
    /继续尝试/i,
    /暂时无法/i,
    /无法确认/i,
    /不能确认/i,
    /信息不足/i,
    /需要进一步/i,
    /需要人工确认/i,
  ]

  if (uncertaintyPatterns.some((pattern) => pattern.test(normalized))) {
    return false
  }

  return /根因|诊断结论|关键查询|关键证据|已确认|异常配置|is_enabled|limit\s*=\s*0|expire_date|price\s*=\s*0|零元|memory|oom|disabled/i.test(normalized)
}

function shouldRetryBackgroundAttempt(text: string, toolTrace: SummaryToolTrace[]): boolean {
  const skills = extractActivatedSkills(toolTrace)
  const queryCount = extractExecutedQueries(toolTrace).length
  if (skills.length === 0) return false
  if (queryCount > 0) return false
  return !hasConfidentDiagnosis(text)
}

function resolveAssistantText(text: string, toolTrace: SummaryToolTrace[]): string {
  const skills = extractActivatedSkills(toolTrace)
  const queries = extractMeaningfulQueries(extractExecutedQueries(toolTrace))
  const normalized = text.trim()

  if (normalized) {
    return enrichAssistantText(normalized, skills, queries)
  }

  if (skills.length === 0 && queries.length === 0) {
    return '## 后台诊断记录\n- 本轮未生成可用结论，也没有形成足够的 MCP 证据。'
  }

  return buildDiagnosticHeader(skills, queries)
}

function extractActivatedSkills(toolTrace: SummaryToolTrace[]): string[] {
  const skills: string[] = []
  for (const trace of toolTrace) {
    if (trace.toolName !== 'activateSkillMcp') continue
    const skillSlug = trace.args?.skillSlug
    if (typeof skillSlug === 'string' && skillSlug.trim()) {
      skills.push(skillSlug.trim())
    }
  }
  return [...new Set(skills)]
}

async function deactivateTrackedSkills(toolTrace: SummaryToolTrace[]) {
  const skills = extractActivatedSkills(toolTrace).reverse()
  for (const skillSlug of skills) {
    try {
      await skillMcpManager.deactivate(skillSlug)
    } catch (error) {
      logger.warn({ err: error, skillSlug }, '[Agent] failed to deactivate MCP after run')
    }
  }
}

function enrichAssistantText(text: string, skills: string[], queries: string[]): string {
  const hasSkillMention = /skill|mcp|activat|mysql|postgres|redis|prometheus/i.test(text)
  if (hasSkillMention) return text

  const header = buildDiagnosticHeader(skills, queries)
  return `${header}\n\n${text}`
}

function buildDiagnosticHeader(skills: string[], queries: string[]): string {
  const lines = [
    '## 后台诊断记录',
    skills.length > 0 ? `- 使用的 Skill: ${skills.join(', ')}` : '',
    skills.length > 0 ? '- MCP 已激活并执行只读查询' : '',
    queries.length > 0 ? '- 关键查询:' : '',
    ...queries.slice(0, 6).map((query) => `  - ${query}`),
    queries.length === 0 ? '- 当前仅完成了连接或结构探测，尚未形成可确认根因。' : '',
  ].filter(Boolean)

  return lines.join('\n')
}

function formatServiceLabel(serviceType?: string | null): string {
  if (serviceType === 'mysql') return 'MySQL MCP'
  if (serviceType === 'postgresql') return 'PostgreSQL MCP'
  if (serviceType === 'postgres') return 'PostgreSQL MCP'
  return serviceType ? `${serviceType} MCP` : 'MCP'
}

function buildResolutionNotes(serviceLabel: string, text: string, queries: string[]): string {
  const trimmedText = text.trim()
  const queryLines = queries.length > 0
    ? queries.map((query) => `- ${query}`).join('\n')
    : '- 无可用查询记录'

  return [
    '后台自动收尾：',
    `- 已使用 ${serviceLabel} 完成诊断`,
    '- 已确认并记录关键查询：',
    queryLines,
    trimmedText ? `- Agent 原始结论摘要：${trimmedText}` : '',
    '- 事件已更新为 resolved，最终报告待用户确认后可添加到记忆。',
  ].filter(Boolean).join('\n')
}
