import { eq, desc, and } from 'drizzle-orm'
import { db } from '../db/index'
import { toolApprovals } from '../db/schema/index'
import type { RiskLevel } from '../lib/tool-classifier'

type ApprovalStatus = 'pending' | 'approved' | 'declined' | 'expired'

interface CreateApprovalInput {
  threadId: string
  incidentId?: string
  toolKey: string
  toolName: string
  connectionName?: string
  connectionType?: string
  riskLevel: RiskLevel
  input: Record<string, unknown>
  description?: string
  expiresAt: Date
}

export const toolApprovalService = {
  async create(input: CreateApprovalInput) {
    const [row] = await db
      .insert(toolApprovals)
      .values(input)
      .returning()
    return row
  },

  async getById(id: string) {
    const [row] = await db.select().from(toolApprovals).where(eq(toolApprovals.id, id))
    return row ?? null
  },

  async updateRunId(approvalId: string, runId: string, threadId: string, incidentId?: string) {
    const [row] = await db
      .update(toolApprovals)
      .set({ runId, threadId, ...(incidentId && { incidentId }) })
      .where(eq(toolApprovals.id, approvalId))
      .returning()
    return row
  },

  async decide(id: string, approved: boolean, reason?: string) {
    const status: ApprovalStatus = approved ? 'approved' : 'declined'
    const [row] = await db
      .update(toolApprovals)
      .set({
        status,
        decidedAt: new Date(),
        ...(reason && { declineReason: reason }),
      })
      .where(eq(toolApprovals.id, id))
      .returning()
    return row
  },

  async list(filters?: { status?: ApprovalStatus; threadId?: string }) {
    const conditions = []
    if (filters?.status) conditions.push(eq(toolApprovals.status, filters.status))
    if (filters?.threadId) conditions.push(eq(toolApprovals.threadId, filters.threadId))

    return db
      .select()
      .from(toolApprovals)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(toolApprovals.createdAt))
      .limit(100)
  },

  async expirePending() {
    const now = new Date()
    return db
      .update(toolApprovals)
      .set({ status: 'expired' })
      .where(and(eq(toolApprovals.status, 'pending')))
      .returning()
      .then((rows) => rows.filter((r) => r.expiresAt <= now))
  },
}
