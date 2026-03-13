import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { projectServiceCatalog } from '../../services/project-service-catalog.service'
import { db } from '../../db'
import { projectServiceMaps } from '../../db/schema'
import { eq } from 'drizzle-orm'

export const listProjectServices = createTool({
  id: 'listProjectServices',
  description: '列出项目下所有已注册的基础设施服务（数据库、缓存、监控等）。返回服务名称、类型、描述、连接状态和补充元数据。',
  inputSchema: z.object({
    projectId: z.string().uuid().describe('项目 UUID'),
  }),
  outputSchema: z.object({
    services: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      description: z.string().nullable().optional(),
      status: z.string(),
      healthSummary: z.string().nullable(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })),
  }),
  execute: async (input) => {
    const services = await projectServiceCatalog.list(input.projectId)
    return {
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        description: s.description,
        status: s.status,
        healthSummary: s.healthSummary,
        metadata: s.metadata,
      })),
    }
  },
})

export const getServiceDetails = createTool({
  id: 'getServiceDetails',
  description: '获取指定服务的详细信息，包括连接配置（敏感信息已脱敏）和健康状态。',
  inputSchema: z.object({
    serviceId: z.string().describe('服务 ID'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    service: z.any().optional(),
  }),
  execute: async (input) => {
    const service = await projectServiceCatalog.getById(input.serviceId)
    if (!service) return { found: false }
    // Mask sensitive config values
    const maskedConfig: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(service.config)) {
      if (/password|secret|token|key/i.test(key) && typeof value === 'string') {
        maskedConfig[key] = '***'
      } else {
        maskedConfig[key] = value
      }
    }
    return {
      found: true,
      service: {
        id: service.id,
        name: service.name,
        type: service.type,
        description: service.description,
        status: service.status,
        healthSummary: service.healthSummary,
        config: maskedConfig,
        metadata: service.metadata,
      },
    }
  },
})

export const getServiceMap = createTool({
  id: 'getServiceMap',
  description: '获取项目的服务拓扑图（依赖关系图），展示服务之间的连接和依赖关系。',
  inputSchema: z.object({
    projectId: z.string().uuid().describe('项目 UUID'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    graph: z.any().optional(),
  }),
  execute: async (input) => {
    const [map] = await db.select().from(projectServiceMaps).where(eq(projectServiceMaps.projectId, input.projectId))
    if (!map) return { found: false }
    return { found: true, graph: map.graph }
  },
})
