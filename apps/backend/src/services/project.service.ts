import { count, desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { projectDocuments, projects, projectServices } from '../db/schema'
import { slugifySegment } from '../lib/file-storage'
import { logger } from '../lib/logger'

export const GLOBAL_PROJECT_SLUG = '_global'
export const GLOBAL_PROJECT_NAME = '全局'
const GLOBAL_PROJECT_DESCRIPTION = '全局共享项目，用于存放跨项目的 Runbook 和知识库文档'

export async function ensureGlobalProject() {
  const [existing] = await db.select().from(projects).where(eq(projects.slug, GLOBAL_PROJECT_SLUG))
  if (existing) {
    if (existing.name === GLOBAL_PROJECT_NAME && existing.description === GLOBAL_PROJECT_DESCRIPTION) {
      return existing
    }

    const [row] = await db.update(projects).set({
      name: GLOBAL_PROJECT_NAME,
      description: GLOBAL_PROJECT_DESCRIPTION,
    }).where(eq(projects.id, existing.id)).returning()

    return row ?? existing
  }

  const [row] = await db.insert(projects).values({
    name: GLOBAL_PROJECT_NAME,
    slug: GLOBAL_PROJECT_SLUG,
    description: GLOBAL_PROJECT_DESCRIPTION,
    tags: ['global', 'system'],
  }).returning()
  logger.info({ id: row.id }, 'Global project created')
  return row
}

export const projectService = {
  async list() {
    const rows = await db.select().from(projects).orderBy(desc(projects.createdAt))
    const [documentCounts, serviceCounts] = await Promise.all([
      db.select({ projectId: projectDocuments.projectId, total: count() }).from(projectDocuments).groupBy(projectDocuments.projectId),
      db.select({ projectId: projectServices.projectId, total: count() }).from(projectServices).groupBy(projectServices.projectId),
    ])

    const documentMap = new Map(documentCounts.map((row) => [row.projectId, row.total]))
    const serviceMap = new Map(serviceCounts.map((row) => [row.projectId, row.total]))

    return rows.map((row) => ({
      ...row,
      documentCount: documentMap.get(row.id) ?? 0,
      serviceCount: serviceMap.get(row.id) ?? 0,
    }))
  },

  async getById(id: string) {
    const [row] = await db.select().from(projects).where(eq(projects.id, id))
    return row ?? null
  },

  async create(input: { name: string; description?: string; tags?: string[]; contextSummary?: string }) {
    const slug = slugifySegment(input.name)
    const [row] = await db.insert(projects).values({
      ...input,
      slug,
      tags: input.tags ?? [],
    }).returning()
    return row
  },

  async update(id: string, input: { name?: string; description?: string; tags?: string[]; contextSummary?: string }) {
    const [row] = await db.update(projects).set({
      ...input,
      ...(input.name ? { slug: slugifySegment(input.name) } : {}),
    }).where(eq(projects.id, id)).returning()
    return row ?? null
  },

  async delete(id: string) {
    const [row] = await db.delete(projects).where(eq(projects.id, id)).returning()
    return row ?? null
  },
}
