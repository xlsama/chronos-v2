import { eq, desc } from 'drizzle-orm'
import { db } from '../db/index'
import { serviceMaps } from '../db/schema/index'
import type { ServiceMapGraph } from '../db/schema/service-maps'

export type CreateServiceMapInput = {
  name: string
  description?: string
  graph: ServiceMapGraph
}

export type UpdateServiceMapInput = {
  name?: string
  description?: string
  graph?: ServiceMapGraph
}

export const serviceMapService = {
  async list() {
    return db.select().from(serviceMaps).orderBy(desc(serviceMaps.createdAt))
  },

  async getById(id: string) {
    const [row] = await db.select().from(serviceMaps).where(eq(serviceMaps.id, id))
    return row ?? null
  },

  async create(input: CreateServiceMapInput) {
    const [row] = await db.insert(serviceMaps).values(input).returning()
    return row
  },

  async update(id: string, input: UpdateServiceMapInput) {
    const [row] = await db.update(serviceMaps).set(input).where(eq(serviceMaps.id, id)).returning()
    return row ?? null
  },

  async delete(id: string) {
    const [row] = await db.delete(serviceMaps).where(eq(serviceMaps.id, id)).returning()
    return row ?? null
  },
}
