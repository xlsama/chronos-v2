import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { serviceMapService } from '../../services/service-map.service'

export const getServiceNeighbors = createTool({
  id: 'get-service-neighbors',
  description:
    'Get the direct upstream and downstream services for a given connection/service from the service map. Useful for understanding blast radius.',
  inputSchema: z.object({
    connectionId: z.string().describe('The connection/node ID to look up neighbors for'),
    serviceMapId: z
      .string()
      .optional()
      .describe('Service map ID (uses first service map if not specified)'),
  }),
  execute: async (inputData) => {
    let serviceMap
    if (inputData.serviceMapId) {
      serviceMap = await serviceMapService.getById(inputData.serviceMapId)
    } else {
      const all = await serviceMapService.list()
      serviceMap = all[0]
    }
    if (!serviceMap) return { error: 'No service map found' }

    const graph = serviceMap.graph as { nodes: any[]; edges: any[] }
    const upstream = graph.edges
      .filter((e: any) => e.target === inputData.connectionId)
      .map((e: any) => {
        const node = graph.nodes.find((n: any) => n.id === e.source)
        return { id: e.source, label: node?.data?.label || e.source, relationship: e.label }
      })
    const downstream = graph.edges
      .filter((e: any) => e.source === inputData.connectionId)
      .map((e: any) => {
        const node = graph.nodes.find((n: any) => n.id === e.target)
        return { id: e.target, label: node?.data?.label || e.target, relationship: e.label }
      })

    return { connectionId: inputData.connectionId, upstream, downstream }
  },
})

export const getServiceMap = createTool({
  id: 'get-service-map',
  description:
    'Get the complete service map with all nodes and edges. Use when you need to understand the full service dependency map.',
  inputSchema: z.object({
    id: z.string().describe('Service map UUID'),
  }),
  execute: async (inputData) => {
    const serviceMap = await serviceMapService.getById(inputData.id)
    if (!serviceMap) return { error: 'Service map not found' }
    return serviceMap
  },
})
