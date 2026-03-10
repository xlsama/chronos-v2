import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { topologyService } from '../../services/topology.service'

export const getServiceNeighbors = createTool({
  id: 'get-service-neighbors',
  description:
    'Get the direct upstream and downstream services for a given connection/service from the topology graph. Useful for understanding blast radius.',
  inputSchema: z.object({
    connectionId: z.string().describe('The connection/node ID to look up neighbors for'),
    topologyId: z
      .string()
      .optional()
      .describe('Topology ID (uses first topology if not specified)'),
  }),
  execute: async (inputData) => {
    let topo
    if (inputData.topologyId) {
      topo = await topologyService.getById(inputData.topologyId)
    } else {
      const all = await topologyService.list()
      topo = all[0]
    }
    if (!topo) return { error: 'No topology found' }

    const graph = topo.graph as { nodes: any[]; edges: any[] }
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

export const getTopologyGraph = createTool({
  id: 'get-topology-graph',
  description:
    'Get the complete topology graph with all nodes and edges. Use when you need to understand the full service dependency map.',
  inputSchema: z.object({
    id: z.string().describe('Topology UUID'),
  }),
  execute: async (inputData) => {
    const topo = await topologyService.getById(inputData.id)
    if (!topo) return { error: 'Topology not found' }
    return topo
  },
})
