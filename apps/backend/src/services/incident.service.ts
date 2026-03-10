import { eq, desc, and, SQL } from 'drizzle-orm'
import { db } from '../db/index'
import { incidents } from '../db/schema/index'

export type CreateIncidentInput = {
  title: string
  description?: string
  source?: string
  sourceId?: string
  severity?: 'critical' | 'high' | 'medium' | 'low'
  category?: string
  metadata?: Record<string, unknown>
}

export type UpdateIncidentInput = {
  title?: string
  description?: string
  severity?: 'critical' | 'high' | 'medium' | 'low'
  status?: 'new' | 'triaging' | 'in_progress' | 'waiting_human' | 'resolved' | 'closed'
  processingMode?: 'automatic' | 'semi_automatic' | null
  category?: string
  threadId?: string
  metadata?: Record<string, unknown>
}

export type ListIncidentsQuery = {
  status?: string
  severity?: string
  limit?: number
  offset?: number
}

export const incidentService = {
  async list(query: ListIncidentsQuery = {}) {
    const { status, severity, limit = 50, offset = 0 } = query
    const conditions: SQL[] = []
    if (status) conditions.push(eq(incidents.status, status as any))
    if (severity) conditions.push(eq(incidents.severity, severity as any))

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const data = await db.select().from(incidents).where(where).orderBy(desc(incidents.createdAt)).limit(limit).offset(offset)
    return data
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
