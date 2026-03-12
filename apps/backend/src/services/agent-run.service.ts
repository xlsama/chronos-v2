import { desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { agentRuns } from '../db/schema'

export const agentRunService = {
  async listByIncident(incidentId: string) {
    return db.select().from(agentRuns).where(eq(agentRuns.incidentId, incidentId)).orderBy(desc(agentRuns.createdAt))
  },

  async getById(id: string) {
    const [row] = await db.select().from(agentRuns).where(eq(agentRuns.id, id))
    return row ?? null
  },

  async create(input: {
    incidentId: string
    projectId?: string | null
    status?: typeof agentRuns.$inferInsert.status
    stage?: string
    selectedSkills?: string[]
    analysis?: Record<string, unknown>
    context?: Record<string, unknown>
    plannedActions?: Record<string, unknown>[]
    result?: string
    lastError?: string
  }) {
    const [row] = await db.insert(agentRuns).values({
      incidentId: input.incidentId,
      projectId: input.projectId ?? null,
      status: input.status ?? 'queued',
      stage: input.stage ?? 'queued',
      selectedSkills: input.selectedSkills ?? [],
      analysis: input.analysis,
      context: input.context,
      plannedActions: input.plannedActions,
      result: input.result,
      lastError: input.lastError,
    }).returning()
    return row
  },

  async update(id: string, input: Partial<typeof agentRuns.$inferInsert>) {
    const [row] = await db.update(agentRuns).set(input).where(eq(agentRuns.id, id)).returning()
    return row ?? null
  },
}
