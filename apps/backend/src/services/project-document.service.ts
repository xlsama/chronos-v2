import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../db'
import { projectDocuments, projects } from '../db/schema'
import { pgVector } from '../db/vector-store'
import { env } from '../env'
import { chunkMarkdown, chunkTabularText, chunkText } from '../lib/chunker'
import { embedText, embedTexts } from '../lib/embedder'
import { extractText } from '../lib/extractors'
import { deleteStoredFile, readStoredText, resolveStoredPath, slugifySegment, toPublicFileUrl, writeMarkdownProjectFile, writeUploadedProjectFile } from '../lib/file-storage'
import { logger } from '../lib/logger'
import { rerank } from '../lib/reranker'

type DocumentKind = 'knowledge' | 'runbook' | 'incident_history'
type SourceKind = 'upload' | 'markdown' | 'agent' | 'job'
type PublicationStatus = 'active' | 'draft' | 'published' | 'archived'

export interface SearchDocumentResult {
  documentId: string
  projectId: string
  projectName: string
  title: string
  content: string
  filePath: string
  kind: DocumentKind
  similarity: number
  rerankScore?: number
  publicationStatus: PublicationStatus
}

function castDocumentKind(kind: string): DocumentKind {
  return kind as DocumentKind
}

export const projectDocumentService = {
  async list(projectId: string, options: { kind?: DocumentKind; publicationStatus?: PublicationStatus } = {}) {
    const conditions = [eq(projectDocuments.projectId, projectId)]
    if (options.kind) conditions.push(eq(projectDocuments.kind, options.kind))
    if (options.publicationStatus) conditions.push(eq(projectDocuments.publicationStatus, options.publicationStatus))

    const rows = await db.select().from(projectDocuments).where(and(...conditions)).orderBy(desc(projectDocuments.createdAt))
    return rows.map(withPublicUrl)
  },

  async listAcrossProjects(options: { kind: DocumentKind; publicationStatus?: PublicationStatus }) {
    const conditions = [eq(projectDocuments.kind, options.kind)]
    if (options.publicationStatus) conditions.push(eq(projectDocuments.publicationStatus, options.publicationStatus))
    const rows = await db.select().from(projectDocuments).where(and(...conditions)).orderBy(desc(projectDocuments.createdAt))
    return rows.map(withPublicUrl)
  },

  async getById(id: string) {
    const [row] = await db.select().from(projectDocuments).where(eq(projectDocuments.id, id))
    return row ? withPublicUrl(row) : null
  },

  async createMarkdownDocument(input: {
    projectId: string
    kind: DocumentKind
    title: string
    content: string
    tags?: string[]
    description?: string
    publicationStatus?: PublicationStatus
    source?: SourceKind
    createdBy?: string
    metadata?: Record<string, unknown>
  }) {
    const project = await getProjectOrThrow(input.projectId)
    const stored = await writeMarkdownProjectFile({
      projectSlug: project.slug,
      kind: input.kind,
      title: input.title,
      content: input.content,
    })

    const [row] = await db.insert(projectDocuments).values({
      projectId: input.projectId,
      kind: input.kind,
      title: input.title,
      slug: slugifySegment(input.title),
      description: input.description,
      tags: input.tags ?? [],
      content: input.content,
      filePath: stored.relativePath,
      fileName: stored.fileName,
      mimeType: 'text/markdown',
      extension: stored.extension,
      checksum: stored.checksum,
      source: input.source ?? 'markdown',
      publicationStatus: input.publicationStatus ?? defaultPublicationStatus(input.kind),
      createdBy: input.createdBy,
      metadata: input.metadata ?? {},
    }).returning()

    void this.reprocess(row.id)
    return withPublicUrl(row)
  },

  async createUploadedDocument(input: {
    projectId: string
    kind: DocumentKind
    title: string
    file: File
    tags?: string[]
    description?: string
    publicationStatus?: PublicationStatus
    createdBy?: string
    metadata?: Record<string, unknown>
  }) {
    const project = await getProjectOrThrow(input.projectId)
    const buffer = Buffer.from(await input.file.arrayBuffer())
    const stored = await writeUploadedProjectFile({
      projectSlug: project.slug,
      kind: input.kind,
      title: input.title,
      originalName: input.file.name,
      buffer,
    })

    const [row] = await db.insert(projectDocuments).values({
      projectId: input.projectId,
      kind: input.kind,
      title: input.title,
      slug: slugifySegment(input.title),
      description: input.description,
      tags: input.tags ?? [],
      filePath: stored.relativePath,
      fileName: stored.fileName,
      mimeType: input.file.type || 'application/octet-stream',
      extension: stored.extension,
      checksum: stored.checksum,
      source: 'upload',
      publicationStatus: input.publicationStatus ?? defaultPublicationStatus(input.kind),
      createdBy: input.createdBy,
      metadata: input.metadata ?? {},
    }).returning()

    void this.reprocess(row.id)
    return withPublicUrl(row)
  },

  async updateDocument(id: string, input: {
    title?: string
    content?: string
    description?: string
    tags?: string[]
    publicationStatus?: PublicationStatus
    metadata?: Record<string, unknown>
  }) {
    const existing = await this.getById(id)
    if (!existing) return null

    let content = existing.content ?? null
    let checksum = existing.checksum
    let filePath = existing.filePath
    let fileName = existing.fileName
    let extension = existing.extension
    if (typeof input.content === 'string' && existing.extension === 'md') {
      await db.update(projectDocuments).set({ status: 'pending' }).where(eq(projectDocuments.id, id))
      const stored = await writeMarkdownProjectFile({
        projectSlug: await getProjectSlug(existing.projectId),
        kind: castDocumentKind(existing.kind),
        title: input.title ?? existing.title,
        content: input.content,
      })
      content = input.content
      checksum = stored.checksum
      filePath = stored.relativePath
      fileName = stored.fileName
      extension = stored.extension
    }

    const [row] = await db.update(projectDocuments).set({
      ...input,
      ...(input.title ? { slug: slugifySegment(input.title) } : {}),
      ...(content !== null ? { content } : {}),
      ...(checksum ? { checksum } : {}),
      ...(filePath ? { filePath } : {}),
      ...(fileName ? { fileName } : {}),
      ...(extension ? { extension } : {}),
      ...(input.metadata ? { metadata: { ...(existing.metadata ?? {}), ...input.metadata } } : {}),
    }).where(eq(projectDocuments.id, id)).returning()

    if (typeof input.content === 'string') {
      void this.reprocess(id)
    }

    return row ? withPublicUrl(row) : null
  },

  async deleteDocument(id: string) {
    const existing = await this.getById(id)
    if (!existing) return null
    await pgVector.deleteVectors({ indexName: 'document_embeddings', filter: { documentId: id } })
    await deleteStoredFile(existing.filePath)
    const [row] = await db.delete(projectDocuments).where(eq(projectDocuments.id, id)).returning()
    return row ? withPublicUrl(row) : null
  },

  async reprocess(documentId: string) {
    const [document] = await db.select().from(projectDocuments).where(eq(projectDocuments.id, documentId))
    if (!document) return null

    try {
      await db.update(projectDocuments).set({ status: 'processing', parserError: null }).where(eq(projectDocuments.id, documentId))
      const text = await extractDocumentText(document.filePath, document.extension, document.content)
      const chunks = await createChunks(document.extension, text)
      const embeddings = chunks.length > 0 ? await embedTexts(chunks.map((chunk) => chunk.content)) : []

      await pgVector.deleteVectors({ indexName: 'document_embeddings', filter: { documentId } })

      if (chunks.length > 0) {
        await pgVector.upsert({
          indexName: 'document_embeddings',
          vectors: embeddings,
          metadata: chunks.map((chunk) => ({
            text: chunk.content,
            documentId,
            projectId: document.projectId,
            kind: document.kind,
            title: document.title,
            filePath: document.filePath,
            publicationStatus: document.publicationStatus,
            chunkIndex: chunk.index,
          })),
          ids: chunks.map((chunk) => `${documentId}_${chunk.index}`),
        })
      }

      const [row] = await db.update(projectDocuments).set({
        content: text,
        chunkCount: chunks.length,
        embeddingModel: env.EMBEDDING_MODEL,
        status: 'ready',
      }).where(eq(projectDocuments.id, documentId)).returning()
      return row ? withPublicUrl(row) : null
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parser error'
      logger.error({ err: error, documentId }, 'Failed to process project document')
      await db.update(projectDocuments).set({ status: 'error', parserError: message }).where(eq(projectDocuments.id, documentId))
      return null
    }
  },

  async search(query: string, options: {
    kind: DocumentKind
    projectId?: string
    publicationStatuses?: PublicationStatus[]
    limit?: number
  }): Promise<SearchDocumentResult[]> {
    const embedding = await embedText(query)
    const filter: Record<string, unknown> = { kind: options.kind }
    if (options.projectId) filter.projectId = options.projectId
    if (options.publicationStatuses?.length) filter.publicationStatus = { $in: options.publicationStatuses }

    const vectorResults = await pgVector.query({
      indexName: 'document_embeddings',
      queryVector: embedding,
      topK: (options.limit ?? 5) * 3,
      includeVector: false,
      filter: filter as any,
    })

    if (vectorResults.length === 0) return []

    const reranked = await rerank(query, vectorResults.map((result) => String(result.metadata?.text ?? '')), {
      topN: options.limit ?? 5,
    })

    const documentIds = [...new Set(reranked.map((item) => String(vectorResults[item.index].metadata?.documentId ?? '')))]
    const documents = documentIds.length > 0
      ? await db.select().from(projectDocuments).where(inArray(projectDocuments.id, documentIds))
      : []

    const projectIds = [...new Set(documents.map((document) => document.projectId))]
    const projectRows = projectIds.length > 0
      ? await db.select().from(projects).where(inArray(projects.id, projectIds))
      : []

    const documentMap = new Map(documents.map((document) => [document.id, document]))
    const projectMap = new Map(projectRows.map((project) => [project.id, project]))

    return reranked.map((item) => {
      const original = vectorResults[item.index]
      const documentId = String(original.metadata?.documentId ?? '')
      const document = documentMap.get(documentId)
      const project = document ? projectMap.get(document.projectId) : undefined

      return {
        documentId,
        projectId: document?.projectId ?? '',
        projectName: project?.name ?? '',
        title: document?.title ?? '',
        content: String(original.metadata?.text ?? ''),
        filePath: String(original.metadata?.filePath ?? ''),
        kind: castDocumentKind(String(original.metadata?.kind ?? options.kind)),
        publicationStatus: (document?.publicationStatus ?? 'active') as PublicationStatus,
        similarity: original.score ?? 0,
        rerankScore: item.relevanceScore,
      }
    })
  },
}

async function getProjectOrThrow(projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
  if (!project) {
    throw new Error('Project not found')
  }
  return project
}

async function getProjectSlug(projectId: string) {
  return (await getProjectOrThrow(projectId)).slug
}

function defaultPublicationStatus(kind: DocumentKind): PublicationStatus {
  return kind === 'runbook' ? 'draft' : 'active'
}

function withPublicUrl<T extends { filePath: string }>(row: T) {
  return {
    ...row,
    fileUrl: toPublicFileUrl(row.filePath),
  }
}

async function extractDocumentText(relativePath: string, extension: string | null, inlineContent?: string | null) {
  if (extension === 'md' && inlineContent) {
    return inlineContent
  }

  if (extension === 'md') {
    return readStoredText(relativePath)
  }

  if (extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'gif' || extension === 'webp') {
    return ''
  }

  if (!extension) {
    return inlineContent ?? ''
  }

  return extractText(resolveStoredPath(relativePath), extension)
}

async function createChunks(extension: string | null, text: string) {
  if (!text.trim()) return []
  if (extension === 'md') return chunkMarkdown(text)
  if (extension === 'xlsx' || extension === 'csv') return chunkTabularText(text)
  return chunkText(text)
}
