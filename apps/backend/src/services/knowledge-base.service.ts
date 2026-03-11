import { eq, desc, ilike, and, sql, SQL, count, inArray } from 'drizzle-orm'
import { db } from '../db/index'
import { kbProjects, kbDocuments } from '../db/schema/index'
import { pgVector } from '../db/vector-store'
import { embedText } from '../lib/embedder'
import { rerank } from '../lib/reranker'

// ── Project ──────────────────────────────────────────────────

export type CreateProjectInput = {
  name: string
  description?: string
  tags?: string[]
}

export type UpdateProjectInput = {
  name?: string
  description?: string
  tags?: string[]
}

// ── Document ─────────────────────────────────────────────────

export type CreateDocumentInput = {
  projectId: string
  title: string
  type: 'markdown' | 'pdf' | 'xlsx' | 'csv' | 'docx'
  content?: string
  originalUrl?: string
}

export type UpdateDocumentInput = {
  title?: string
  content?: string
}

// ── Search ───────────────────────────────────────────────────

export interface SearchResult {
  chunkContent: string
  similarity: number
  rerankScore?: number
  documentId: string
  documentTitle: string
  projectId: string
  projectName: string
}

export const kbService = {
  // ── Projects ─────────────────────────────────────────────

  async listProjects(query: { search?: string } = {}) {
    const { search } = query
    const conditions: SQL[] = []
    if (search) conditions.push(ilike(kbProjects.name, `%${search}%`))
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const projects = await db.select().from(kbProjects).where(where).orderBy(desc(kbProjects.createdAt))

    // Attach document count
    const counts = await db
      .select({ projectId: kbDocuments.projectId, count: count() })
      .from(kbDocuments)
      .groupBy(kbDocuments.projectId)

    const countMap = new Map(counts.map((c) => [c.projectId, c.count]))
    return projects.map((p) => ({ ...p, documentCount: countMap.get(p.id) ?? 0 }))
  },

  async getProjectById(id: string) {
    const [row] = await db.select().from(kbProjects).where(eq(kbProjects.id, id))
    return row ?? null
  },

  async createProject(input: CreateProjectInput) {
    const [row] = await db.insert(kbProjects).values(input).returning()
    return row
  },

  async updateProject(id: string, input: UpdateProjectInput) {
    const [row] = await db.update(kbProjects).set(input).where(eq(kbProjects.id, id)).returning()
    return row ?? null
  },

  async deleteProject(id: string) {
    // Delete all vectors for this project's documents
    const docs = await db.select({ id: kbDocuments.id }).from(kbDocuments).where(eq(kbDocuments.projectId, id))
    for (const doc of docs) {
      await this.deleteDocumentVectors(doc.id)
    }
    const [row] = await db.delete(kbProjects).where(eq(kbProjects.id, id)).returning()
    return row ?? null
  },

  // ── Documents ────────────────────────────────────────────

  async listDocuments(projectId: string) {
    return db
      .select()
      .from(kbDocuments)
      .where(eq(kbDocuments.projectId, projectId))
      .orderBy(desc(kbDocuments.createdAt))
  },

  async getDocumentById(id: string) {
    const [row] = await db.select().from(kbDocuments).where(eq(kbDocuments.id, id))
    return row ?? null
  },

  async createDocument(input: CreateDocumentInput) {
    const [row] = await db.insert(kbDocuments).values(input).returning()
    return row
  },

  async updateDocument(id: string, input: UpdateDocumentInput) {
    const [row] = await db.update(kbDocuments).set(input).where(eq(kbDocuments.id, id)).returning()
    return row ?? null
  },

  async deleteDocument(id: string) {
    await this.deleteDocumentVectors(id)
    const [row] = await db.delete(kbDocuments).where(eq(kbDocuments.id, id)).returning()
    return row ?? null
  },

  async deleteDocumentVectors(documentId: string) {
    await pgVector.deleteVectors({
      indexName: 'kb_embeddings',
      filter: { documentId },
    })
  },

  // ── Vector Search ────────────────────────────────────────

  async searchByVector(
    query: string,
    options: { projectId?: string; projectIds?: string[]; limit?: number } = {},
  ): Promise<SearchResult[]> {
    const { projectId, projectIds, limit = 5 } = options
    const queryEmbedding = await embedText(query)

    // Build metadata filter
    const filter = projectIds?.length
      ? { projectId: { $in: projectIds } }
      : projectId
        ? { projectId }
        : undefined

    // Retrieve 3x candidates for reranking
    const candidateLimit = limit * 3
    const results = await pgVector.query({
      indexName: 'kb_embeddings',
      queryVector: queryEmbedding,
      topK: candidateLimit,
      filter,
      includeVector: false,
    })

    if (results.length === 0) return []

    // Rerank
    const reranked = await rerank(
      query,
      results.map((r) => (r.metadata?.text as string) ?? ''),
      { topN: limit },
    )

    // Batch-fetch document and project info to avoid N+1
    const docIds = [...new Set(reranked.map((r) => results[r.index].metadata?.documentId as string))]
    const docs = docIds.length > 0 ? await db.select().from(kbDocuments).where(inArray(kbDocuments.id, docIds)) : []
    const projIds = [...new Set(docs.map((d) => d.projectId))]
    const projs = projIds.length > 0 ? await db.select().from(kbProjects).where(inArray(kbProjects.id, projIds)) : []

    const docMap = new Map(docs.map((d) => [d.id, d]))
    const projMap = new Map(projs.map((p) => [p.id, p]))

    return reranked.map((r) => {
      const original = results[r.index]
      const meta = original.metadata ?? {}
      const doc = docMap.get(meta.documentId as string)
      const proj = doc ? projMap.get(doc.projectId) : undefined
      return {
        chunkContent: (meta.text as string) ?? '',
        similarity: original.score ?? 0,
        rerankScore: r.relevanceScore,
        documentId: (meta.documentId as string) ?? '',
        documentTitle: doc?.title ?? '',
        projectId: (meta.projectId as string) ?? '',
        projectName: proj?.name ?? '',
      }
    })
  },
}
