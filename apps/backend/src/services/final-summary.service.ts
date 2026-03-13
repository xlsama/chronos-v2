import { logger } from '../lib/logger'
import {
  getFinalSummaryMetadata,
  mergeFinalSummaryMetadata,
  type SummaryToolTrace,
} from '../lib/final-summary'
import { summarizeAgent } from '../mastra/agents/summarize-agent'
import { incidentService } from './incident.service'
import { messageService } from './message.service'

export const finalSummaryService = {
  async ensureForIncident(input: {
    incidentId: string
    threadId: string
    toolTrace?: SummaryToolTrace[]
  }) {
    logger.info({ incidentId: input.incidentId, threadId: input.threadId }, '[Summary] ensureForIncident invoked')
    const incident = await incidentService.getById(input.incidentId)
    if (!incident) return null
    if (incident.finalSummaryDraft?.trim()) {
      if (incident.status === 'resolved' || incident.status === 'summarizing') {
        const completedIncident = await incidentService.update(incident.id, { status: 'completed' })
        return completedIncident ?? incident
      }
      return incident
    }
    if (incident.status === 'summarizing' || incident.status === 'completed') return incident
    if (incident.status !== 'resolved') return incident

    const summarizingIncident = await incidentService.update(incident.id, { status: 'summarizing' })
    const currentIncident = summarizingIncident ?? incident

    const messages = await messageService.listByThread(input.threadId)
    const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant')
    const prompt = buildSummaryPrompt({
      incident: currentIncident,
      threadId: input.threadId,
      messages: messages.map((message) => ({
        role: message.role,
        createdAt: message.createdAt.toISOString(),
        content: message.content ?? '',
      })),
      latestAssistantReply: latestAssistantMessage?.content ?? '',
      toolTrace: input.toolTrace ?? [],
    })

    logger.debug({ incidentId: input.incidentId, promptLength: prompt.length }, '[Summary] prompt built')

    try {
      const result = await summarizeAgent.generate(prompt)
      const summary = result.text.trim()
      if (!summary) {
        logger.warn({ incidentId: input.incidentId, threadId: input.threadId }, '[Summary] empty final summary generated')
        const reverted = await incidentService.update(currentIncident.id, { status: 'resolved' })
        return reverted ?? currentIncident
      }

      logger.debug({ incidentId: input.incidentId, summaryLength: summary.length }, '[Summary] summary generated')

      const existingMeta = getFinalSummaryMetadata(currentIncident.metadata)
      const generatedAt = existingMeta?.generatedAt ?? new Date().toISOString()

      const updated = await incidentService.update(currentIncident.id, {
        status: 'completed',
        finalSummaryDraft: summary,
        metadata: mergeFinalSummaryMetadata(currentIncident.metadata, {
          status: existingMeta?.documentId ? 'saved' : 'generated',
          generatedAt,
          source: 'summarize-agent',
          ...(existingMeta?.documentId ? { documentId: existingMeta.documentId } : {}),
          ...(existingMeta?.savedAt ? { savedAt: existingMeta.savedAt } : {}),
        }),
      })

      logger.info({ incidentId: input.incidentId }, '[Summary] final summary saved')
      return updated
    } catch (error) {
      await incidentService.update(currentIncident.id, { status: 'resolved' }).catch((rollbackError) => {
        logger.error(
          { err: rollbackError, incidentId: input.incidentId, threadId: input.threadId },
          '[Summary] failed to rollback incident status after summary error',
        )
      })
      throw error
    }
  },
}

function buildSummaryPrompt(input: {
  incident: Awaited<ReturnType<typeof incidentService.getById>> extends infer T
    ? NonNullable<T>
    : never
  threadId: string
  messages: Array<{ role: string; createdAt: string; content: string }>
  latestAssistantReply: string
  toolTrace: SummaryToolTrace[]
}) {
  const toolTraceSection = input.toolTrace.length > 0
    ? input.toolTrace
        .map((trace, index) => {
          const args = trace.args ? JSON.stringify(trace.args, null, 2) : ''
          return [
            `${index + 1}. ${trace.toolName}`,
            args ? `参数:\n${args}` : '',
          ].filter(Boolean).join('\n')
        })
        .join('\n\n')
    : '无可用工具调用轨迹'

  const messageSection = input.messages.length > 0
    ? input.messages
        .map((message) => {
          const content = message.content.trim() || '[空消息]'
          return [
            `时间: ${message.createdAt}`,
            `角色: ${message.role}`,
            '内容:',
            content,
          ].join('\n')
        })
        .join('\n\n---\n\n')
    : '无消息记录'

  return [
    '请根据以下上下文生成最终报告。',
    '',
    '## Incident',
    `- ID: ${input.incident.id}`,
    `- 状态: ${input.incident.status}`,
    `- 摘要: ${input.incident.summary ?? '未提供'}`,
    `- 项目 ID: ${input.incident.projectId ?? '未关联项目'}`,
    input.incident.resolutionNotes ? `- 解决说明: ${input.incident.resolutionNotes}` : '',
    '',
    '### 事件原文',
    input.incident.content,
    '',
    '### 主 Agent 最后一轮回复',
    input.latestAssistantReply || '无',
    '',
    '### 工具调用轨迹',
    toolTraceSection,
    '',
    `### Thread 消息链路 (${input.threadId})`,
    messageSection,
  ].filter(Boolean).join('\n')
}
