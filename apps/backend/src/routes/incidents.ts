import { count, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { db } from '../db'
import { workflowApprovals } from '../db/schema'
import { AppError } from '../lib/errors'
import { publishChatEvent } from '../lib/redis'
import { runAgentInBackground } from '../lib/agent-runner'
import { env } from '../env'
import { agentRunService } from '../services/agent-run.service'
import { incidentService } from '../services/incident.service'
import { incidentWorkflowService } from '../services/incident-workflow.service'
import { messageService } from '../services/message.service'
import { projectDocumentService } from '../services/project-document.service'
import { projectService } from '../services/project.service'
import { workflowApprovalService } from '../services/workflow-approval.service'

const attachmentSchema = z.object({
  type: z.enum(['image', 'file']),
  url: z.string(),
  name: z.string(),
  mimeType: z.string(),
})

export const incidentRoutes = new Hono()
  .get('/', zValidator('query', z.object({
    status: z.enum(['new', 'triaging', 'in_progress', 'waiting_human', 'resolved', 'closed']).optional(),
    limit: z.coerce.number().optional(),
    offset: z.coerce.number().optional(),
  })), async (c) => {
    const query = c.req.valid('query')
    const { items, total } = await incidentService.list(query)
    return c.json({ data: items, total })
  })
  .post('/', zValidator('json', z.object({
    content: z.string().min(1),
    projectId: z.string().uuid().nullable().optional(),
    attachments: z.array(attachmentSchema).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    const incident = await incidentService.create({
      content: input.content,
      projectId: input.projectId ?? null,
      attachments: input.attachments ?? null,
      source: 'manual',
      metadata: input.metadata ?? {},
      status: 'triaging',
      processingMode: 'automatic',
    })

    if (env.AGENT_AUTO_TRIGGER) {
      const threadId = `incident-${incident.id}`
      await messageService.save({
        threadId,
        incidentId: incident.id,
        role: 'user',
        content: incident.content,
      })
      await publishChatEvent(threadId, 'stream-start', { threadId })
      void runAgentInBackground(threadId, incident)
    } else {
      void incidentWorkflowService.start(incident)
    }
    return c.json({ data: incident }, 201)
  })
  .get('/:id', async (c) => {
    const incident = await incidentService.getById(c.req.param('id'))
    if (!incident) throw new AppError(404, 'Incident not found')

    const [project, approvals, runs, approvalCount] = await Promise.all([
      incident.projectId ? projectService.getById(incident.projectId) : Promise.resolve(null),
      workflowApprovalService.list({ incidentId: incident.id }),
      agentRunService.listByIncident(incident.id),
      db.select({ total: count() }).from(workflowApprovals).where(eq(workflowApprovals.incidentId, incident.id)),
    ])

    const relatedHistory = incident.projectId
      ? await projectDocumentService.search(incident.content, {
        kind: 'incident_history',
        projectId: incident.projectId,
        limit: 3,
      })
      : []

    return c.json({
      data: {
        ...incident,
        project,
        approvals,
        runs,
        approvalCount: approvalCount[0]?.total ?? 0,
        relatedHistory,
      },
    })
  })
  .patch('/:id', zValidator('json', z.object({
    status: z.enum(['new', 'triaging', 'in_progress', 'waiting_human', 'resolved', 'closed']).optional(),
    summary: z.string().nullable().optional(),
    finalSummaryDraft: z.string().nullable().optional(),
    resolutionNotes: z.string().nullable().optional(),
  })), async (c) => {
    const incident = await incidentService.update(c.req.param('id'), c.req.valid('json'))
    if (!incident) throw new AppError(404, 'Incident not found')
    return c.json({ data: incident })
  })
  .get('/:id/approvals', async (c) => {
    const incident = await incidentService.getById(c.req.param('id'))
    if (!incident) throw new AppError(404, 'Incident not found')
    const data = await workflowApprovalService.list({ incidentId: incident.id })
    return c.json({ data })
  })
  .post('/:id/approve', zValidator('json', z.object({
    approvalId: z.string().uuid(),
    approved: z.boolean(),
    reason: z.string().optional(),
  })), async (c) => {
    const incident = await incidentService.getById(c.req.param('id'))
    if (!incident) throw new AppError(404, 'Incident not found')

    const input = c.req.valid('json')
    const approval = await workflowApprovalService.getById(input.approvalId)
    if (!approval || approval.incidentId !== incident.id) {
      throw new AppError(404, 'Approval not found')
    }

    const updatedApproval = await workflowApprovalService.decide(input.approvalId, input.approved, input.reason)

    const pendingApprovals = await workflowApprovalService.list({ incidentId: incident.id, status: 'pending' })
    if (pendingApprovals.length === 0) {
      await incidentService.update(incident.id, {
        status: input.approved ? 'in_progress' : 'waiting_human',
        resolutionNotes: input.approved
          ? '所有待审批动作已确认，等待人工执行或二次触发处理。'
          : `审批被拒绝: ${input.reason ?? '未提供原因'}`,
      })
    }

    return c.json({ data: updatedApproval })
  })
  .post('/:id/save-summary', async (c) => {
    const incident = await incidentService.getById(c.req.param('id'))
    if (!incident) throw new AppError(404, 'Incident not found')
    if (!incident.projectId) throw new AppError(400, 'Incident has no resolved project')
    if (!incident.finalSummaryDraft) throw new AppError(400, 'Incident has no summary draft')

    const document = await projectDocumentService.createMarkdownDocument({
      projectId: incident.projectId,
      kind: 'incident_history',
      title: `${incident.summary ?? 'incident'}-${incident.id.slice(0, 8)}`,
      content: incident.finalSummaryDraft,
      source: 'agent',
      createdBy: 'user',
      metadata: {
        incidentId: incident.id,
        incidentSummary: incident.summary,
      },
    })

    await incidentService.update(incident.id, {
      status: 'resolved',
      resolutionNotes: `Saved to incident history: ${document.title}`,
    })

    return c.json({ data: document }, 201)
  })
