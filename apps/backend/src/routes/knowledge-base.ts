import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { eq } from 'drizzle-orm'
import path from 'node:path'
import fs from 'node:fs/promises'
import { db } from '../db/index'
import { kbDocuments } from '../db/schema/index'
import { kbService } from '../services/knowledge-base.service'
import { processDocument } from '../lib/document-processor'
import { AppError } from '../lib/errors'
import { env } from '../env'

const uploadDir = path.resolve(env.UPLOAD_DIR)

export const knowledgeBaseRoutes = new Hono()

  // ── Projects ─────────────────────────────────────────────────

  .get('/projects', zValidator('query', z.object({
    search: z.string().optional(),
  })), async (c) => {
    const query = c.req.valid('query')
    const data = await kbService.listProjects(query)
    return c.json({ data })
  })

  .post('/projects', zValidator('json', z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    const project = await kbService.createProject(input)
    return c.json({ data: project }, 201)
  })

  .get('/projects/:id', async (c) => {
    const project = await kbService.getProjectById(c.req.param('id'))
    if (!project) throw new AppError(404, 'Project not found')
    return c.json({ data: project })
  })

  .put('/projects/:id', zValidator('json', z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    const project = await kbService.updateProject(c.req.param('id'), input)
    if (!project) throw new AppError(404, 'Project not found')
    return c.json({ data: project })
  })

  .delete('/projects/:id', async (c) => {
    const project = await kbService.deleteProject(c.req.param('id'))
    if (!project) throw new AppError(404, 'Project not found')
    return c.json({ data: project })
  })

  // ── Documents ────────────────────────────────────────────────

  .get('/projects/:projectId/documents', async (c) => {
    const data = await kbService.listDocuments(c.req.param('projectId'))
    return c.json({ data })
  })

  .post('/projects/:projectId/documents', async (c) => {
    const contentType = c.req.header('content-type') ?? ''
    const projectId = c.req.param('projectId')

    // Verify project exists
    const project = await kbService.getProjectById(projectId)
    if (!project) throw new AppError(404, 'Project not found')

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const body = await c.req.parseBody()
      const file = body['file']
      if (!(file instanceof File)) throw new AppError(400, 'No file provided')

      const ext = path.extname(file.name).slice(1).toLowerCase()
      const validTypes = ['pdf', 'xlsx', 'csv', 'docx']
      if (!validTypes.includes(ext)) throw new AppError(400, `Unsupported file type: ${ext}`)

      // Save file
      await fs.mkdir(uploadDir, { recursive: true })
      const filename = `${crypto.randomUUID()}.${ext}`
      const filepath = path.join(uploadDir, filename)
      const buffer = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(filepath, buffer)

      const title = (body['title'] as string) || file.name.replace(/\.[^.]+$/, '')
      const doc = await kbService.createDocument({
        projectId,
        title,
        type: ext as 'pdf' | 'xlsx' | 'csv' | 'docx',
        originalUrl: `/uploads/${filename}`,
      })

      // Fire-and-forget processing
      processDocument(doc.id)
      return c.json({ data: doc }, 201)
    } else {
      // JSON (markdown)
      const body = await c.req.json()
      const { title, content } = body
      if (!title) throw new AppError(400, 'Title is required')

      const doc = await kbService.createDocument({
        projectId,
        title,
        type: 'markdown',
        content: content ?? '',
      })

      // Fire-and-forget processing
      processDocument(doc.id)
      return c.json({ data: doc }, 201)
    }
  })

  .get('/documents/:id', async (c) => {
    const doc = await kbService.getDocumentById(c.req.param('id'))
    if (!doc) throw new AppError(404, 'Document not found')
    return c.json({ data: doc })
  })

  .put('/documents/:id', zValidator('json', z.object({
    title: z.string().min(1).optional(),
    content: z.string().optional(),
  })), async (c) => {
    const input = c.req.valid('json')
    const doc = await kbService.updateDocument(c.req.param('id'), input)
    if (!doc) throw new AppError(404, 'Document not found')
    return c.json({ data: doc })
  })

  .delete('/documents/:id', async (c) => {
    const doc = await kbService.deleteDocument(c.req.param('id'))
    if (!doc) throw new AppError(404, 'Document not found')
    return c.json({ data: doc })
  })

  .post('/documents/:id/reprocess', async (c) => {
    const doc = await kbService.getDocumentById(c.req.param('id'))
    if (!doc) throw new AppError(404, 'Document not found')
    processDocument(doc.id)
    return c.json({ data: { message: 'Reprocessing started' } })
  })

  // ── Reembed ─────────────────────────────────────────────────

  .post('/projects/:projectId/reembed', async (c) => {
    const projectId = c.req.param('projectId')
    const project = await kbService.getProjectById(projectId)
    if (!project) throw new AppError(404, 'Project not found')

    const docs = await kbService.listDocuments(projectId)
    let count = 0
    for (const doc of docs) {
      await db.update(kbDocuments).set({ status: 'pending' }).where(eq(kbDocuments.id, doc.id))
      processDocument(doc.id)
      count++
    }
    return c.json({ data: { message: `Reembedding ${count} documents` } })
  })

  .post('/reembed-all', async (c) => {
    const docs = await db.select({ id: kbDocuments.id }).from(kbDocuments)
    for (const doc of docs) {
      await db.update(kbDocuments).set({ status: 'pending' }).where(eq(kbDocuments.id, doc.id))
      processDocument(doc.id)
    }
    return c.json({ data: { message: `Reembedding ${docs.length} documents` } })
  })

  // ── Search ───────────────────────────────────────────────────

  .post('/search', zValidator('json', z.object({
    query: z.string().min(1),
    projectId: z.string().uuid().optional(),
    limit: z.number().max(50).optional(),
  })), async (c) => {
    const { query, projectId, limit } = c.req.valid('json')
    const results = await kbService.searchByVector(query, { projectId, limit })
    return c.json({ data: results })
  })
