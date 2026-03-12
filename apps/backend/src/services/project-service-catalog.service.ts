import { desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { projectServices, projects } from '../db/schema'
import { decrypt, encrypt } from '../lib/crypto'
import { slugifySegment } from '../lib/file-storage'
import { testConnection } from './connection-tester'

export const projectServiceCatalog = {
  async list(projectId: string) {
    const rows = await db.select().from(projectServices).where(eq(projectServices.projectId, projectId)).orderBy(desc(projectServices.createdAt))
    return rows.map(decodeService)
  },

  async listAcrossProjects() {
    const rows = await db.select().from(projectServices).orderBy(desc(projectServices.createdAt))
    return rows.map(decodeService)
  },

  async getById(id: string) {
    const [row] = await db.select().from(projectServices).where(eq(projectServices.id, id))
    return row ? decodeService(row) : null
  },

  async create(input: {
    projectId: string
    name: string
    type: typeof projectServices.$inferInsert.type
    description?: string
    config: Record<string, unknown>
    metadata?: Record<string, unknown>
  }) {
    const [project] = await db.select().from(projects).where(eq(projects.id, input.projectId))
    if (!project) throw new Error('Project not found')

    const [row] = await db.insert(projectServices).values({
      projectId: input.projectId,
      name: input.name,
      slug: slugifySegment(input.name),
      type: input.type,
      description: input.description,
      config: encrypt(JSON.stringify(input.config)),
      metadata: input.metadata ?? {},
    }).returning()

    return decodeService(row)
  },

  async update(id: string, input: {
    name?: string
    description?: string
    config?: Record<string, unknown>
    metadata?: Record<string, unknown>
    status?: typeof projectServices.$inferInsert.status
    healthSummary?: string | null
  }) {
    const changes: Partial<typeof projectServices.$inferInsert> = {
      ...(input.name ? { name: input.name, slug: slugifySegment(input.name) } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.healthSummary !== undefined ? { healthSummary: input.healthSummary } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      ...(input.config ? { config: encrypt(JSON.stringify(input.config)) } : {}),
    }
    const [row] = await db.update(projectServices).set(changes).where(eq(projectServices.id, id)).returning()
    return row ? decodeService(row) : null
  },

  async delete(id: string) {
    const [row] = await db.delete(projectServices).where(eq(projectServices.id, id)).returning()
    return row ? decodeService(row) : null
  },

  async test(id: string) {
    const service = await this.getById(id)
    if (!service) return null
    const result = await testConnection(service.type, service.config)
    const [row] = await db.update(projectServices).set({
      status: result.success ? 'connected' : 'error',
      healthSummary: result.message ?? (result.success ? 'Connection OK' : 'Connection failed'),
      lastCheckedAt: new Date(),
    }).where(eq(projectServices.id, id)).returning()
    return row ? decodeService(row) : null
  },
}

function decodeService(row: typeof projectServices.$inferSelect) {
  return {
    ...row,
    config: JSON.parse(decrypt(row.config)) as Record<string, unknown>,
  }
}
