import { createOpenAI } from '@ai-sdk/openai'
import { generateObject, generateText } from 'ai'
import { z } from 'zod/v4'
import { env } from '../env'
import { logger } from '../lib/logger'
import { generateIncidentSummary } from '../lib/generate-summary'
import { projectService } from './project.service'
import { projectDocumentService, type SearchDocumentResult } from './project-document.service'
import { skillCatalogService, type SkillRecord } from './skill-catalog.service'
import { projectServiceCatalog } from './project-service-catalog.service'
import { agentRunService } from './agent-run.service'
import { incidentService } from './incident.service'
import { workflowApprovalService } from './workflow-approval.service'

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: env.OPENAI_BASE_URL,
})

const incidentAnalysisSchema = z.object({
  shortSummary: z.string(),
  severity: z.enum(['info', 'warning', 'critical']),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  serviceTypes: z.array(z.string()).max(8),
  keywords: z.array(z.string()).max(12),
  hypotheses: z.array(z.string()).max(6),
  requiresHumanApproval: z.boolean(),
})

type IncidentRow = NonNullable<Awaited<ReturnType<typeof incidentService.getById>>>

export const incidentWorkflowService = {
  async start(incident: IncidentRow) {
    const run = await agentRunService.create({
      incidentId: incident.id,
      status: 'running',
      stage: 'analysis',
    })

    try {
      const summary = (await generateIncidentSummary(
        incident.content,
        incident.attachments as IncidentRow['attachments'],
      )) ?? incident.summary

      const projects = await projectService.list()
      const analysis = await analyzeIncident(incident, projects)
      const resolvedProjectId = analysis.projectId && projects.some((project) => project.id === analysis.projectId)
        ? analysis.projectId
        : null

      const services = resolvedProjectId ? await projectServiceCatalog.list(resolvedProjectId) : []
      const [knowledge, runbooks, history, skills] = await Promise.all([
        resolvedProjectId
          ? projectDocumentService.search(incident.content, { kind: 'knowledge', projectId: resolvedProjectId, limit: 4 })
          : Promise.resolve([]),
        resolvedProjectId
          ? projectDocumentService.search(incident.content, {
            kind: 'runbook',
            projectId: resolvedProjectId,
            publicationStatuses: ['published'],
            limit: 3,
          })
          : Promise.resolve([]),
        resolvedProjectId
          ? projectDocumentService.search(incident.content, { kind: 'incident_history', projectId: resolvedProjectId, limit: 3 })
          : Promise.resolve([]),
        skillCatalogService.list(),
      ])

      const selectedSkills = selectSkills({
        incidentText: incident.content,
        analysis,
        services,
        skills,
      })

      const plannedActions = buildPlannedActions(selectedSkills, services)
      const approvals = await createWorkflowApprovals({
        runId: run.id,
        incidentId: incident.id,
        projectId: resolvedProjectId,
        plannedActions,
      })

      const finalSummaryDraft = await generateFinalSummary({
        incident,
        summary,
        analysis,
        knowledge,
        runbooks,
        history,
        services,
        selectedSkills: selectedSkills.map((skill) => skill.slug),
        plannedActions,
      })

      const status = approvals.length > 0 || analysis.requiresHumanApproval
        ? 'waiting_human'
        : 'in_progress'
      const runStatus = approvals.length > 0 || analysis.requiresHumanApproval
        ? 'waiting_approval'
        : 'completed'

      await Promise.all([
        incidentService.update(incident.id, {
          projectId: resolvedProjectId,
          status,
          summary: summary ?? null,
          analysis,
          selectedSkills: selectedSkills.map((skill) => skill.slug),
          finalSummaryDraft,
        }),
        agentRunService.update(run.id, {
          projectId: resolvedProjectId,
          stage: approvals.length > 0 ? 'approval' : 'summary',
          status: runStatus,
          selectedSkills: selectedSkills.map((skill) => skill.slug),
          analysis,
          context: {
            knowledge,
            runbooks,
            history,
            services,
          },
          plannedActions,
          result: finalSummaryDraft,
        }),
      ])

      return { runId: run.id }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown workflow error'
      logger.error({ err: error, incidentId: incident.id, runId: run.id }, 'Failed to run incident workflow')
      await Promise.all([
        incidentService.update(incident.id, {
          status: 'waiting_human',
          resolutionNotes: message,
        }),
        agentRunService.update(run.id, {
          status: 'failed',
          stage: 'failed',
          lastError: message,
        }),
      ])
      throw error
    }
  },
}

async function analyzeIncident(incident: IncidentRow, projects: Awaited<ReturnType<typeof projectService.list>>) {
  const fallback = {
    shortSummary: incident.summary ?? incident.content.slice(0, 120),
    severity: 'warning' as const,
    projectId: null,
    projectName: null,
    confidence: 0.2,
    serviceTypes: [],
    keywords: extractKeywords(incident.content),
    hypotheses: ['需要结合知识库和 runbook 进一步人工确认'],
    requiresHumanApproval: true,
  }

  if (projects.length === 0) return fallback

  try {
    const { object } = await generateObject({
      model: openai.chat(env.OPENAI_MODEL_MINI),
      schema: incidentAnalysisSchema,
      system: '你是 OPS 事件分析 Agent。识别项目归属、服务类型、关键词与调查方向。如果无法确定项目，projectId 必须返回 null。',
      prompt: [
        '候选项目:',
        projects.map((project) => `- ${project.id} | ${project.name} | ${project.description ?? ''} | tags=${project.tags.join(',')}`).join('\n'),
        '',
        '事件内容:',
        incident.content,
      ].join('\n'),
    })
    return object
  } catch (error) {
    logger.warn({ err: error, incidentId: incident.id }, 'AI incident analysis failed, using fallback')
    return fallback
  }
}

function selectSkills(input: {
  incidentText: string
  analysis: z.infer<typeof incidentAnalysisSchema>
  services: Awaited<ReturnType<typeof projectServiceCatalog.list>>
  skills: SkillRecord[]
}) {
  const serviceTypes = new Set([
    ...input.analysis.serviceTypes,
    ...input.services.map((service) => service.type),
  ])
  const keywords = new Set(
    extractKeywords(`${input.incidentText}\n${input.analysis.keywords.join(' ')}`).map((keyword) => keyword.toLowerCase()),
  )

  return input.skills
    .filter(Boolean)
    .filter((skill) => {
      const serviceTypeMatch =
        skill.applicableServiceTypes.length === 0 ||
        skill.applicableServiceTypes.some((serviceType) => serviceTypes.has(serviceType))

      const textualSignal = `${skill.name} ${skill.description ?? ''} ${skill.markdown}`.toLowerCase()
      const keywordMatch = [...keywords].some((keyword) => textualSignal.includes(keyword))
      return serviceTypeMatch || keywordMatch
    })
    .slice(0, 5)
}

function buildPlannedActions(
  skills: SkillRecord[],
  services: Awaited<ReturnType<typeof projectServiceCatalog.list>>,
) {
  return skills.flatMap((skill) => skill.tools.map((tool) => {
    const matchedServices = services.filter((service) => {
      if (tool.allowedServiceTypes.length === 0) return true
      return tool.allowedServiceTypes.includes(service.type)
    })

    return {
      skillSlug: skill.slug,
      skillName: skill.name,
      toolKey: tool.key,
      toolName: tool.toolName,
      approvalMode: tool.approvalMode,
      riskLevel: tool.riskLevel,
      notes: tool.notes,
      input: tool.input ?? {},
      services: matchedServices.map((service) => ({
        id: service.id,
        name: service.name,
        type: service.type,
      })),
    }
  }))
}

async function createWorkflowApprovals(input: {
  runId: string
  incidentId: string
  projectId: string | null
  plannedActions: ReturnType<typeof buildPlannedActions>
}) {
  const manualActions = input.plannedActions.filter((action) => action.approvalMode === 'manual')
  return Promise.all(manualActions.flatMap((action) => {
    const targets = action.services.length > 0 ? action.services : [{ id: null, name: 'generic', type: null }]
    return targets.map((target) => workflowApprovalService.create({
      agentRunId: input.runId,
      incidentId: input.incidentId,
      projectId: input.projectId,
      skillSlug: action.skillSlug,
      toolKey: action.toolKey,
      toolName: action.toolName,
      serviceId: target.id ?? undefined,
      serviceName: target.name,
      riskLevel: action.riskLevel,
      approvalMode: 'manual',
      input: action.input,
      description: action.notes ?? `${action.skillName} 计划调用 ${action.toolName}`,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    }))
  }))
}

async function generateFinalSummary(input: {
  incident: IncidentRow
  summary: string | null | undefined
  analysis: z.infer<typeof incidentAnalysisSchema>
  knowledge: SearchDocumentResult[]
  runbooks: SearchDocumentResult[]
  history: SearchDocumentResult[]
  services: Awaited<ReturnType<typeof projectServiceCatalog.list>>
  selectedSkills: string[]
  plannedActions: ReturnType<typeof buildPlannedActions>
}) {
  const contextText = [
    `摘要: ${input.summary ?? '无'}`,
    `分析: ${JSON.stringify(input.analysis, null, 2)}`,
    `服务: ${input.services.map((service) => `${service.name}(${service.type})`).join(', ') || '无'}`,
    `命中 Skills: ${input.selectedSkills.join(', ') || '无'}`,
    `计划动作: ${JSON.stringify(input.plannedActions, null, 2)}`,
    `知识库:\n${formatSearchResults(input.knowledge)}`,
    `Runbook:\n${formatSearchResults(input.runbooks)}`,
    `Incident History:\n${formatSearchResults(input.history)}`,
  ].join('\n\n')

  try {
    const { text } = await generateText({
      model: openai.chat(env.OPENAI_MODEL),
      system: [
        '你是 OPS 事件总结 Agent。',
        '输出中文 Markdown，总结当前调查结果、根因假设、涉及项目/服务、建议动作、是否需要人工批准。',
        '如果系统尚未真正执行修复，必须明确写出“当前仍待人工执行/确认”，不能宣称已解决。',
      ].join('\n'),
      prompt: `事件原文:\n${input.incident.content}\n\n上下文:\n${contextText}`,
      maxOutputTokens: 1800,
    })
    return text.trim()
  } catch (error) {
    logger.warn({ err: error, incidentId: input.incident.id }, 'Failed to generate final summary')
    return [
      `# ${input.summary ?? 'Incident Summary'}`,
      '',
      '## 分析结论',
      `- 项目: ${input.analysis.projectName ?? '未识别'}`,
      `- 严重度: ${input.analysis.severity}`,
      `- 关键词: ${input.analysis.keywords.join(', ') || '无'}`,
      '',
      '## 建议动作',
      ...input.plannedActions.map((action) => `- ${action.skillName}: ${action.toolName} (${action.approvalMode})`),
      '',
      '## 当前状态',
      '- 当前只完成了分析、检索和动作规划，仍待人工执行/确认。',
    ].join('\n')
  }
}

function formatSearchResults(results: SearchDocumentResult[]) {
  if (results.length === 0) return '- 无'
  return results.map((result, index) => `- [${index + 1}] ${result.title}: ${result.content.slice(0, 240)}`).join('\n')
}

function extractKeywords(input: string) {
  return [...new Set(
    input
      .toLowerCase()
      .split(/[^a-z0-9_\u4e00-\u9fa5]+/g)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length >= 3),
  )].slice(0, 10)
}
