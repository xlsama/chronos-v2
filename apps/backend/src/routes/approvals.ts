import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { toolApprovalService } from '../services/tool-approval.service'
import { supervisorAgent } from '../mastra/agents/supervisor-agent'
import { publisher, redis } from '../lib/redis'
import { logger } from '../lib/logger'

interface SuspendPayload {
  approvalId: string
  toolKey: string
  toolName: string
  connectionName: string
  connectionType: string
  riskLevel: string
  input: Record<string, unknown>
  description: string
}

function extractSuspendPayload(chunk: { type: string; payload?: Record<string, unknown> }): SuspendPayload | null {
  if (chunk.type === 'tool-call-suspended' || chunk.type === 'agent-execution-suspended') {
    return (chunk.payload as { suspendPayload: SuspendPayload })?.suspendPayload ?? null
  }
  return null
}

function extractTextDelta(chunk: { type: string; payload?: Record<string, unknown> }): string | null {
  if (chunk.type === 'text-delta') {
    return (chunk.payload as { text: string })?.text ?? null
  }
  return null
}

export const approvalRoutes = new Hono()
  .get(
    '/',
    zValidator(
      'query',
      z.object({
        status: z.enum(['pending', 'approved', 'declined', 'expired']).optional(),
        threadId: z.string().optional(),
      }),
    ),
    async (c) => {
      const { status, threadId } = c.req.valid('query')
      const data = await toolApprovalService.list({ status, threadId })
      return c.json({ data })
    },
  )
  .get('/:id', async (c) => {
    const id = c.req.param('id')
    const data = await toolApprovalService.getById(id)
    if (!data) return c.json({ error: 'Approval not found' }, 404)
    return c.json({ data })
  })
  .post(
    '/:id/decide',
    zValidator(
      'json',
      z.object({
        approved: z.boolean(),
        reason: z.string().optional(),
      }),
    ),
    async (c) => {
      const id = c.req.param('id')
      const { approved, reason } = c.req.valid('json')

      // Validate approval exists and is pending
      const existing = await toolApprovalService.getById(id)
      if (!existing) return c.json({ error: 'Approval not found' }, 404)
      if (existing.status !== 'pending') return c.json({ error: `Approval already ${existing.status}` }, 400)
      if (!existing.runId) return c.json({ error: 'Approval not yet linked to agent run' }, 400)

      // Check expiry
      if (existing.expiresAt <= new Date()) {
        await toolApprovalService.decide(id, false, '审批已过期')
        return c.json({ error: 'Approval has expired' }, 400)
      }

      // Update approval status
      const approval = await toolApprovalService.decide(id, approved, reason)

      // Resume agent stream
      try {
        const resumedStream = await supervisorAgent.resumeStream(
          { approved, ...(reason && { reason }) },
          { runId: existing.runId },
        )

        // Continue broadcasting the resumed stream
        await redis.set(`stream:active:${existing.threadId}`, '1', 'EX', 300)

        // Consume resumed stream in background
        ;(async () => {
          try {
            for await (const chunk of resumedStream.fullStream) {
              const text = extractTextDelta(chunk as { type: string; payload?: Record<string, unknown> })
              if (text) {
                publisher.publish(`chat:${existing.threadId}`, text)
                continue
              }

              const suspendPayload = extractSuspendPayload(chunk as { type: string; payload?: Record<string, unknown> })
              if (suspendPayload) {
                // Chained approval scenario
                await toolApprovalService.updateRunId(suspendPayload.approvalId, resumedStream.runId, existing.threadId, existing.incidentId ?? undefined)
                publisher.publish(`chat:${existing.threadId}`, JSON.stringify({
                  type: 'approval_required',
                  data: { ...suspendPayload, runId: resumedStream.runId },
                }))
              }
            }
          } catch (err) {
            logger.error({ err, threadId: existing.threadId }, 'Error consuming resumed stream')
          } finally {
            publisher.publish(`chat:${existing.threadId}`, '[DONE]')
            await redis.del(`stream:active:${existing.threadId}`).catch(() => {})
          }
        })()

        return c.json({ data: approval })
      } catch (err) {
        logger.error({ err, approvalId: id }, 'Failed to resume agent stream')
        return c.json({ error: 'Failed to resume agent execution' }, 500)
      }
    },
  )
