import { eq } from 'drizzle-orm'
import path from 'node:path'
import { db } from '../db/index'
import { kbDocuments } from '../db/schema/index'
import { pgVector } from '../db/vector-store'
import { env } from '../env'
import { extractText } from './extractors'
import { chunkText, chunkMarkdown, chunkTabularText } from './chunker'
import { embedTexts } from './embedder'
import { logger } from './logger'

export async function processDocument(documentId: string) {
  try {
    await db.update(kbDocuments).set({ status: 'processing' }).where(eq(kbDocuments.id, documentId))

    const [doc] = await db.select().from(kbDocuments).where(eq(kbDocuments.id, documentId))
    if (!doc) throw new Error('Document not found')

    // Extract text
    let text: string
    if (doc.type === 'markdown') {
      text = doc.content ?? ''
    } else if (doc.originalUrl) {
      const filePath = path.resolve(env.UPLOAD_DIR, path.basename(doc.originalUrl))
      text = await extractText(filePath, doc.type)
      await db.update(kbDocuments).set({ content: text }).where(eq(kbDocuments.id, documentId))
    } else {
      throw new Error('No content or file to process')
    }

    if (!text.trim()) {
      await db.update(kbDocuments).set({ status: 'ready', chunkCount: 0 }).where(eq(kbDocuments.id, documentId))
      return
    }

    // Chunk — select strategy by type
    const isTabular = doc.type === 'xlsx' || doc.type === 'csv'
    const isMarkdown = doc.type === 'markdown'
    const chunks = isTabular
      ? chunkTabularText(text)
      : isMarkdown
        ? await chunkMarkdown(text)
        : await chunkText(text)

    if (chunks.length === 0) {
      await db.update(kbDocuments).set({ status: 'ready', chunkCount: 0 }).where(eq(kbDocuments.id, documentId))
      return
    }

    // Embed
    const embeddings = await embedTexts(chunks.map((c) => c.content))

    // Upsert to PgVector (deterministic IDs for idempotent reprocessing)
    await pgVector.upsert({
      indexName: 'kb_embeddings',
      vectors: embeddings,
      metadata: chunks.map((chunk) => ({
        text: chunk.content,
        chunkIndex: chunk.index,
        documentId,
        projectId: doc.projectId,
      })),
      ids: chunks.map((_, i) => `${documentId}_${i}`),
    })

    // Update document status
    await db
      .update(kbDocuments)
      .set({
        status: 'ready',
        chunkCount: chunks.length,
        embeddingModel: env.EMBEDDING_MODEL,
      })
      .where(eq(kbDocuments.id, documentId))

    logger.info({ documentId, chunkCount: chunks.length }, 'Document processed successfully')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await db.update(kbDocuments).set({ status: 'error', errorMessage: message }).where(eq(kbDocuments.id, documentId))
    logger.error({ err, documentId }, 'Failed to process document')
  }
}
