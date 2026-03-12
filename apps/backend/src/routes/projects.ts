import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { AppError } from '../lib/errors'
import { projectDocumentService } from '../services/project-document.service'
import { projectService } from '../services/project.service'
import { projectServiceCatalog } from '../services/project-service-catalog.service'

const projectInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  contextSummary: z.string().optional(),
})

const markdownDocumentSchema = z.object({
  title: z.string().min(1),
  content: z.string().default(''),
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
  publicationStatus: z.enum(['active', 'draft', 'published', 'archived']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const serviceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['mysql', 'postgresql', 'redis', 'mongodb', 'clickhouse', 'elasticsearch', 'kafka', 'rabbitmq', 'kubernetes', 'docker', 'argocd', 'grafana', 'prometheus', 'sentry', 'jenkins', 'datadog', 'pagerduty', 'opsgenie', 'apisix', 'kong', 'airflow', 'loki', 'ssh']),
  description: z.string().optional(),
  config: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const projectRoutes = new Hono()
  .get('/', async (c) => {
    const data = await projectService.list()
    return c.json({ data })
  })
  .post('/', zValidator('json', projectInputSchema), async (c) => {
    const data = await projectService.create(c.req.valid('json'))
    return c.json({ data }, 201)
  })
  .get('/documents', zValidator('query', z.object({
    kind: z.enum(['knowledge', 'runbook', 'incident_history']),
    publicationStatus: z.enum(['active', 'draft', 'published', 'archived']).optional(),
  })), async (c) => {
    const query = c.req.valid('query')
    const data = await projectDocumentService.listAcrossProjects({
      kind: query.kind,
      publicationStatus: query.publicationStatus,
    })
    return c.json({ data })
  })
  .get('/services', async (c) => {
    const data = await projectServiceCatalog.listAcrossProjects()
    return c.json({ data })
  })
  .get('/:projectId', async (c) => {
    const project = await projectService.getById(c.req.param('projectId'))
    if (!project) throw new AppError(404, 'Project not found')
    return c.json({ data: project })
  })
  .put('/:projectId', zValidator('json', projectInputSchema.partial()), async (c) => {
    const project = await projectService.update(c.req.param('projectId'), c.req.valid('json'))
    if (!project) throw new AppError(404, 'Project not found')
    return c.json({ data: project })
  })
  .delete('/:projectId', async (c) => {
    const project = await projectService.delete(c.req.param('projectId'))
    if (!project) throw new AppError(404, 'Project not found')
    return c.json({ data: project })
  })
  .get('/:projectId/knowledge', async (c) => {
    const data = await projectDocumentService.list(c.req.param('projectId'), { kind: 'knowledge' })
    return c.json({ data })
  })
  .post('/:projectId/knowledge', async (c) => {
    const contentType = c.req.header('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      const body = await c.req.parseBody()
      const file = body.file
      if (!(file instanceof File)) throw new AppError(400, 'File is required')
      const title = String(body.title || file.name.replace(/\.[^.]+$/, ''))
      const tags = typeof body.tags === 'string' ? body.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : []
      const data = await projectDocumentService.createUploadedDocument({
        projectId: c.req.param('projectId'),
        kind: 'knowledge',
        title,
        file,
        tags,
        description: typeof body.description === 'string' ? body.description : undefined,
      })
      return c.json({ data }, 201)
    }

    const body = await c.req.json()
    const parsed = markdownDocumentSchema.parse(body)
    const data = await projectDocumentService.createMarkdownDocument({
      projectId: c.req.param('projectId'),
      kind: 'knowledge',
      ...parsed,
    })
    return c.json({ data }, 201)
  })
  .get('/:projectId/runbooks', zValidator('query', z.object({
    publicationStatus: z.enum(['active', 'draft', 'published', 'archived']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
  })), async (c) => {
    const query = c.req.valid('query')
    const result = await projectDocumentService.listPaginated(c.req.param('projectId'), {
      kind: 'runbook',
      publicationStatus: query.publicationStatus,
      page: query.page,
      pageSize: query.pageSize,
    })
    return c.json({
      data: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    })
  })
  .post('/:projectId/runbooks', zValidator('json', markdownDocumentSchema), async (c) => {
    const data = await projectDocumentService.createMarkdownDocument({
      projectId: c.req.param('projectId'),
      kind: 'runbook',
      ...c.req.valid('json'),
    })
    return c.json({ data }, 201)
  })
  .get('/:projectId/incident-history', async (c) => {
    const data = await projectDocumentService.list(c.req.param('projectId'), {
      kind: 'incident_history',
    })
    return c.json({ data })
  })
  .post('/:projectId/incident-history', zValidator('json', markdownDocumentSchema), async (c) => {
    const data = await projectDocumentService.createMarkdownDocument({
      projectId: c.req.param('projectId'),
      kind: 'incident_history',
      ...c.req.valid('json'),
    })
    return c.json({ data }, 201)
  })
  .get('/:projectId/services', async (c) => {
    const data = await projectServiceCatalog.list(c.req.param('projectId'))
    return c.json({ data })
  })
  .post('/:projectId/services', zValidator('json', serviceSchema), async (c) => {
    const data = await projectServiceCatalog.create({
      projectId: c.req.param('projectId'),
      ...c.req.valid('json'),
    })
    return c.json({ data }, 201)
  })
  .get('/documents/:documentId', async (c) => {
    const data = await projectDocumentService.getById(c.req.param('documentId'))
    if (!data) throw new AppError(404, 'Document not found')
    return c.json({ data })
  })
  .put('/documents/:documentId', zValidator('json', markdownDocumentSchema.partial()), async (c) => {
    const data = await projectDocumentService.updateDocument(c.req.param('documentId'), c.req.valid('json'))
    if (!data) throw new AppError(404, 'Document not found')
    return c.json({ data })
  })
  .delete('/documents/:documentId', async (c) => {
    const data = await projectDocumentService.deleteDocument(c.req.param('documentId'))
    if (!data) throw new AppError(404, 'Document not found')
    return c.json({ data })
  })
  .put('/services/:serviceId', zValidator('json', serviceSchema.partial()), async (c) => {
    const data = await projectServiceCatalog.update(c.req.param('serviceId'), c.req.valid('json'))
    if (!data) throw new AppError(404, 'Service not found')
    return c.json({ data })
  })
  .delete('/services/:serviceId', async (c) => {
    const data = await projectServiceCatalog.delete(c.req.param('serviceId'))
    if (!data) throw new AppError(404, 'Service not found')
    return c.json({ data })
  })
  .post('/services/:serviceId/test', async (c) => {
    const data = await projectServiceCatalog.test(c.req.param('serviceId'))
    if (!data) throw new AppError(404, 'Service not found')
    return c.json({ data })
  })
