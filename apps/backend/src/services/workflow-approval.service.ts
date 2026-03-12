import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { workflowApprovals } from '../db/schema'

export const workflowApprovalService = {
  async list(filters?: { incidentId?: string; status?: typeof workflowApprovals.$inferSelect.status }) {
    const conditions = []
    if (filters?.incidentId) conditions.push(eq(workflowApprovals.incidentId, filters.incidentId))
    if (filters?.status) conditions.push(eq(workflowApprovals.status, filters.status))

    return db.select().from(workflowApprovals).where(
      conditions.length > 0 ? and(...conditions) : undefined,
    ).orderBy(desc(workflowApprovals.createdAt))
  },

  async getById(id: string) {
    const [row] = await db.select().from(workflowApprovals).where(eq(workflowApprovals.id, id))
    return row ?? null
  },

  async create(input: typeof workflowApprovals.$inferInsert) {
    const [row] = await db.insert(workflowApprovals).values(input).returning()
    return row
  },

  async decide(id: string, approved: boolean, reason?: string) {
    const [row] = await db.update(workflowApprovals).set({
      status: approved ? 'approved' : 'declined',
      declineReason: approved ? null : reason,
      decidedAt: new Date(),
    }).where(eq(workflowApprovals.id, id)).returning()
    return row ?? null
  },
}
