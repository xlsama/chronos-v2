import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { toolApprovals } from '../db/schema'
import { getPublisher, getSubscriber } from '../lib/redis'
import { publishChatEvent } from '../lib/redis'
import { logger } from '../lib/logger'

function approvalChannel(approvalId: string) {
  return `approval:${approvalId}`
}

export const toolApprovalService = {
  async create(data: {
    threadId: string
    incidentId?: string
    toolName: string
    toolArgs?: Record<string, unknown>
    riskLevel: 'none' | 'low' | 'medium' | 'high'
    reason?: string
  }) {
    const [approval] = await db.insert(toolApprovals).values({
      threadId: data.threadId,
      incidentId: data.incidentId,
      toolName: data.toolName,
      toolArgs: data.toolArgs,
      riskLevel: data.riskLevel,
      reason: data.reason,
      status: 'pending',
    }).returning()

    // Notify frontend via SSE
    await publishChatEvent(data.threadId, 'approval-required', {
      id: approval.id,
      toolName: approval.toolName,
      toolArgs: approval.toolArgs,
      riskLevel: approval.riskLevel,
      reason: approval.reason,
      createdAt: approval.createdAt.toISOString(),
    })

    logger.info(
      { approvalId: approval.id, threadId: data.threadId, toolName: data.toolName, riskLevel: data.riskLevel },
      '[Approval] created and awaiting resolution',
    )

    return approval
  },

  async resolve(approvalId: string, action: 'approve' | 'decline') {
    const [approval] = await db.update(toolApprovals)
      .set({
        status: action === 'approve' ? 'approved' : 'declined',
        resolvedAt: new Date(),
      })
      .where(and(
        eq(toolApprovals.id, approvalId),
        eq(toolApprovals.status, 'pending'),
      ))
      .returning()

    if (!approval) {
      return null
    }

    // Publish resolution to Redis so the waiting tool can proceed
    const pub = getPublisher()
    await pub.publish(approvalChannel(approvalId), JSON.stringify({ action }))

    // Also notify frontend via SSE
    await publishChatEvent(approval.threadId, 'approval-resolved', {
      id: approval.id,
      action,
    })

    logger.info(
      { approvalId, action, threadId: approval.threadId, toolName: approval.toolName },
      '[Approval] resolved',
    )

    return approval
  },

  async waitForResolution(approvalId: string, timeoutMs = 300_000): Promise<'approve' | 'decline'> {
    return new Promise((resolve, reject) => {
      const sub = getSubscriber()
      const channel = approvalChannel(approvalId)

      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Approval wait timed out after ${timeoutMs}ms (approvalId=${approvalId})`))
      }, timeoutMs)

      const onMessage = (receivedChannel: string, msg: string) => {
        if (receivedChannel !== channel) return
        try {
          const parsed = JSON.parse(msg) as { action: 'approve' | 'decline' }
          cleanup()
          resolve(parsed.action)
        } catch (err) {
          cleanup()
          reject(err)
        }
      }

      const cleanup = () => {
        clearTimeout(timer)
        sub.removeListener('message', onMessage)
        sub.unsubscribe(channel).catch(() => {})
      }

      sub.subscribe(channel).then(() => {
        sub.on('message', onMessage)
      }).catch((err) => {
        cleanup()
        reject(err)
      })
    })
  },

  async listByThread(threadId: string) {
    return db.select().from(toolApprovals)
      .where(eq(toolApprovals.threadId, threadId))
      .orderBy(toolApprovals.createdAt)
  },

  async listPendingByThread(threadId: string) {
    return db.select().from(toolApprovals)
      .where(and(
        eq(toolApprovals.threadId, threadId),
        eq(toolApprovals.status, 'pending'),
      ))
      .orderBy(toolApprovals.createdAt)
  },
}
