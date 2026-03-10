import { eq, desc } from 'drizzle-orm'
import { db } from '../db/index'
import { topology } from '../db/schema/index'

export type CreateTopologyInput = {
  name: string
  description?: string
  graph: { nodes: unknown[]; edges: unknown[] }
}

export type UpdateTopologyInput = {
  name?: string
  description?: string
  graph?: { nodes: unknown[]; edges: unknown[] }
}

export const topologyService = {
  async list() {
    return db.select().from(topology).orderBy(desc(topology.createdAt))
  },

  async getById(id: string) {
    const [row] = await db.select().from(topology).where(eq(topology.id, id))
    return row ?? null
  },

  async create(input: CreateTopologyInput) {
    const [row] = await db.insert(topology).values(input).returning()
    return row
  },

  async update(id: string, input: UpdateTopologyInput) {
    const [row] = await db.update(topology).set(input).where(eq(topology.id, id)).returning()
    return row ?? null
  },

  async delete(id: string) {
    const [row] = await db.delete(topology).where(eq(topology.id, id)).returning()
    return row ?? null
  },
}
