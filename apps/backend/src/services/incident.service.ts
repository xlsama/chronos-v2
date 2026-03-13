import { eq, desc, and, count, SQL } from 'drizzle-orm'
import { db } from '../db/index'
import { incidents } from '../db/schema/index'
import { incidentStatusEnum } from '../db/schema/enums'

type IncidentStatusValue = (typeof incidentStatusEnum.enumValues)[number]

export type CreateIncidentInput = {
  content: string
  projectId?: string | null
  attachments?: { type: 'image' | 'file'; url: string; name: string; mimeType: string }[] | null
  source?: 'manual' | 'webhook'
  summary?: string | null
  status?: IncidentStatusValue
  analysis?: Record<string, unknown> | null
  selectedSkills?: string[]
  finalSummaryDraft?: string | null
  metadata?: Record<string, unknown>
}

export type UpdateIncidentInput = {
  projectId?: string | null
  status?: IncidentStatusValue
  threadId?: string
  summary?: string | null
  analysis?: Record<string, unknown> | null
  selectedSkills?: string[]
  finalSummaryDraft?: string | null
  resolutionNotes?: string | null
  metadata?: Record<string, unknown>
}

export type ListIncidentsQuery = {
  status?: IncidentStatusValue
  limit?: number
  offset?: number
}

export const incidentService = {
  async list(query: ListIncidentsQuery = {}) {
    const { status, limit = 50, offset = 0 } = query
    const conditions: SQL[] = []
    if (status) conditions.push(eq(incidents.status, status))

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const [items, [{ total }]] = await Promise.all([
      db.select().from(incidents).where(where).orderBy(desc(incidents.createdAt)).limit(limit).offset(offset),
      db.select({ total: count() }).from(incidents).where(where),
    ])
    return { items, total }
  },

  async getById(id: string) {
    const [row] = await db.select().from(incidents).where(eq(incidents.id, id))
    return row ?? null
  },

  async create(input: CreateIncidentInput) {
    const [row] = await db.insert(incidents).values(input).returning()
    return row
  },

  async update(id: string, input: UpdateIncidentInput) {
    const [row] = await db.update(incidents).set(input).where(eq(incidents.id, id)).returning()
    return row ?? null
  },
}
