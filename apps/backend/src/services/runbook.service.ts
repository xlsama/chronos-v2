import { eq, desc, ilike, arrayContains, and, SQL } from 'drizzle-orm'
import { db } from '../db/index'
import { runbooks } from '../db/schema/index'

export type CreateRunbookInput = {
  title: string
  content: string
  incidentId?: string
  tags?: string[]
}

export type UpdateRunbookInput = {
  title?: string
  content?: string
  tags?: string[]
}

export type ListRunbooksQuery = {
  search?: string
  tags?: string[]
  limit?: number
  offset?: number
}

export const runbookService = {
  async list(query: ListRunbooksQuery = {}) {
    const { search, tags, limit = 50, offset = 0 } = query
    const conditions: SQL[] = []
    if (search) conditions.push(ilike(runbooks.title, `%${search}%`))
    if (tags?.length) conditions.push(arrayContains(runbooks.tags, tags))

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const data = await db.select().from(runbooks).where(where).orderBy(desc(runbooks.createdAt)).limit(limit).offset(offset)
    return data
  },

  async getById(id: string) {
    const [row] = await db.select().from(runbooks).where(eq(runbooks.id, id))
    return row ?? null
  },

  async create(input: CreateRunbookInput) {
    const [row] = await db.insert(runbooks).values(input).returning()
    return row
  },

  async update(id: string, input: UpdateRunbookInput) {
    const [row] = await db.update(runbooks).set(input).where(eq(runbooks.id, id)).returning()
    return row ?? null
  },

  async delete(id: string) {
    const [row] = await db.delete(runbooks).where(eq(runbooks.id, id)).returning()
    return row ?? null
  },
}
