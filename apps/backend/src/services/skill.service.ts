import { eq, desc, ilike, and, SQL } from 'drizzle-orm'
import { db } from '../db/index'
import { skills } from '../db/schema/index'

export type CreateSkillInput = {
  name: string
  summary: string
  content: string
  category?: string
  tags?: string[]
}

export type UpdateSkillInput = {
  name?: string
  summary?: string
  content?: string
  category?: string
  tags?: string[]
}

export const skillService = {
  async list(query: { search?: string; category?: string; limit?: number; offset?: number } = {}) {
    const { search, category, limit = 50, offset = 0 } = query
    const conditions: SQL[] = []
    if (search) conditions.push(ilike(skills.name, `%${search}%`))
    if (category) conditions.push(eq(skills.category, category))

    const where = conditions.length > 0 ? and(...conditions) : undefined
    // List returns without full content
    const data = await db.select({
      id: skills.id,
      name: skills.name,
      summary: skills.summary,
      category: skills.category,
      tags: skills.tags,
      createdAt: skills.createdAt,
      updatedAt: skills.updatedAt,
    }).from(skills).where(where).orderBy(desc(skills.createdAt)).limit(limit).offset(offset)
    return data
  },

  async getById(id: string) {
    const [row] = await db.select().from(skills).where(eq(skills.id, id))
    return row ?? null
  },

  async create(input: CreateSkillInput) {
    const [row] = await db.insert(skills).values(input).returning()
    return row
  },

  async update(id: string, input: UpdateSkillInput) {
    const [row] = await db.update(skills).set(input).where(eq(skills.id, id)).returning()
    return row ?? null
  },

  async delete(id: string) {
    const [row] = await db.delete(skills).where(eq(skills.id, id)).returning()
    return row ?? null
  },
}
