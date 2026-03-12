import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db'
import { projectServiceMaps } from '../db/schema'
import { AppError } from '../lib/errors'
import { projectService } from '../services/project.service'
import { projectServiceCatalog } from '../services/project-service-catalog.service'

export const serviceMapContextRoutes = new Hono()
  .get('/:projectId/context', async (c) => {
    const project = await projectService.getById(c.req.param('projectId'))
    if (!project) throw new AppError(404, 'Project not found')

    const [services, existingMap] = await Promise.all([
      projectServiceCatalog.list(project.id),
      db.select().from(projectServiceMaps).where(eq(projectServiceMaps.projectId, project.id)),
    ])

    return c.json({
      data: {
        project,
        services,
        graph: existingMap[0]?.graph ?? {
          nodes: services.map((service) => ({
            id: service.id,
            label: service.name,
            type: service.type,
          })),
          edges: [],
        },
      },
    })
  })
