import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { serviceMapService } from '../../services/service-map.service'
import { db } from '../../db/index'
import { connections } from '../../db/schema/index'
import { kbProjects } from '../../db/schema/knowledge-base'
import { slugify } from '../../mcp/utils'

// ── Types ──────────────────────────────────────────────────

interface ServiceNodeData {
  label: string
  serviceType: string
  description?: string
  tags?: string[]
  connectionId?: string
  kbProjectId?: string
}

interface ServiceMapNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: ServiceNodeData
}

interface ServiceEdgeData {
  relationType?: string
  protocol?: string
  description?: string
  critical?: boolean
}

interface ServiceMapEdge {
  id: string
  source: string
  target: string
  label?: string
  data?: ServiceEdgeData
}

interface ServiceMapGraph {
  nodes: ServiceMapNode[]
  edges: ServiceMapEdge[]
}

// ── Helpers ────────────────────────────────────────────────

async function resolveServiceMap(serviceMapId?: string) {
  if (serviceMapId) {
    return serviceMapService.getById(serviceMapId)
  }
  const all = await serviceMapService.list()
  return all[0] ?? null
}

function castGraph(raw: unknown): ServiceMapGraph {
  return raw as ServiceMapGraph
}

function matchNodes(graph: ServiceMapGraph, query: string): ServiceMapNode[] {
  const q = query.toLowerCase()
  return graph.nodes.filter((n) => {
    if (n.id.toLowerCase() === q) return true
    if (n.data.label.toLowerCase().includes(q)) return true
    if (n.data.tags?.some((t: string) => t.toLowerCase().includes(q))) return true
    return false
  })
}

// ── Tools ──────────────────────────────────────────────────

export const getServiceContext = createTool({
  id: 'get-service-context',
  description:
    'Search for a service node by ID/label/tag and return its full context: node info, linked Connection (with MCP tool prefix), linked KB project, and upstream/downstream neighbors with relationship types. Use this to understand a service and its dependencies.',
  inputSchema: z.object({
    query: z.string().describe('Search by node ID, label, or tag'),
    serviceMapId: z
      .string()
      .optional()
      .describe('Service map ID (uses first service map if not specified)'),
  }),
  execute: async ({ query, serviceMapId }) => {
    const serviceMap = await resolveServiceMap(serviceMapId)
    if (!serviceMap) return { error: 'No service map found' }

    const graph = castGraph(serviceMap.graph)
    const matched = matchNodes(graph, query)
    if (matched.length === 0) return { error: `No service node matching "${query}"` }

    // Collect all connectionIds and kbProjectIds from matched nodes
    const connectionIds = [...new Set(matched.map((n) => n.data.connectionId).filter(Boolean))] as string[]
    const kbProjectIds = [...new Set(matched.map((n) => n.data.kbProjectId).filter(Boolean))] as string[]

    // Batch fetch connections and KB projects
    const [connectionRows, kbProjectRows] = await Promise.all([
      connectionIds.length > 0
        ? Promise.all(connectionIds.map((id) => db.select().from(connections).where(eq(connections.id, id)).then((r) => r[0])))
        : Promise.resolve([]),
      kbProjectIds.length > 0
        ? Promise.all(kbProjectIds.map((id) => db.select().from(kbProjects).where(eq(kbProjects.id, id)).then((r) => r[0])))
        : Promise.resolve([]),
    ])

    const connectionMap = new Map(connectionRows.filter(Boolean).map((c) => [c!.id, c!]))
    const kbProjectMap = new Map(kbProjectRows.filter(Boolean).map((p) => [p!.id, p!]))

    const results = matched.map((node) => {
      const conn = node.data.connectionId ? connectionMap.get(node.data.connectionId) : undefined
      const kbProject = node.data.kbProjectId ? kbProjectMap.get(node.data.kbProjectId) : undefined

      const upstream = graph.edges
        .filter((e: ServiceMapEdge) => e.target === node.id)
        .map((e: ServiceMapEdge) => {
          const src = graph.nodes.find((n: ServiceMapNode) => n.id === e.source)
          return {
            nodeId: e.source,
            label: src?.data.label ?? e.source,
            serviceType: src?.data.serviceType,
            relationType: e.data?.relationType ?? e.label,
            protocol: e.data?.protocol,
            critical: e.data?.critical,
          }
        })

      const downstream = graph.edges
        .filter((e: ServiceMapEdge) => e.source === node.id)
        .map((e: ServiceMapEdge) => {
          const tgt = graph.nodes.find((n: ServiceMapNode) => n.id === e.target)
          return {
            nodeId: e.target,
            label: tgt?.data.label ?? e.target,
            serviceType: tgt?.data.serviceType,
            relationType: e.data?.relationType ?? e.label,
            protocol: e.data?.protocol,
            critical: e.data?.critical,
          }
        })

      return {
        node: {
          id: node.id,
          label: node.data.label,
          serviceType: node.data.serviceType,
          description: node.data.description,
          tags: node.data.tags,
        },
        connection: conn
          ? {
              id: conn.id,
              name: conn.name,
              type: conn.type,
              status: conn.status,
              mcpStatus: conn.mcpStatus,
              mcpToolPrefix: slugify(conn.name),
            }
          : null,
        kbProject: kbProject
          ? {
              id: kbProject.id,
              name: kbProject.name,
              description: kbProject.description,
            }
          : null,
        upstream,
        downstream,
      }
    })

    return {
      serviceMapId: serviceMap.id,
      serviceMapName: serviceMap.name,
      results,
    }
  },
})

export const findAffectedServices = createTool({
  id: 'find-affected-services',
  description:
    'Given a faulty service node, BFS traverse reverse edges to find all services that depend on it (directly or transitively). Returns affected services sorted by hop count. Use this to understand blast radius of an outage.',
  inputSchema: z.object({
    nodeId: z.string().describe('The faulty node ID to start from'),
    serviceMapId: z
      .string()
      .optional()
      .describe('Service map ID (uses first service map if not specified)'),
    depth: z
      .number()
      .optional()
      .default(3)
      .describe('Max traversal depth (default 3)'),
  }),
  execute: async ({ nodeId, serviceMapId, depth = 3 }) => {
    const serviceMap = await resolveServiceMap(serviceMapId)
    if (!serviceMap) return { error: 'No service map found' }

    const graph = castGraph(serviceMap.graph)
    const sourceNode = graph.nodes.find((n: ServiceMapNode) => n.id === nodeId)
    if (!sourceNode) return { error: `Node "${nodeId}" not found in service map` }

    // BFS reverse: who depends on me → who is affected
    const visited = new Set<string>([nodeId])
    const affected: Array<{
      id: string
      label: string
      serviceType: string
      hops: number
      path: string[]
      critical: boolean
    }> = []

    let queue: Array<{ id: string; hops: number; path: string[] }> = [
      { id: nodeId, hops: 0, path: [nodeId] },
    ]

    while (queue.length > 0) {
      const next: typeof queue = []
      for (const current of queue) {
        if (current.hops >= depth) continue

        // Find edges where current node is the target (reverse: who calls/depends-on me)
        const reverseEdges = graph.edges.filter((e: ServiceMapEdge) => e.target === current.id)
        for (const edge of reverseEdges) {
          if (visited.has(edge.source)) continue
          visited.add(edge.source)

          const node = graph.nodes.find((n: ServiceMapNode) => n.id === edge.source)
          const newPath = [...current.path, edge.source]

          affected.push({
            id: edge.source,
            label: node?.data.label ?? edge.source,
            serviceType: node?.data.serviceType ?? 'unknown',
            hops: current.hops + 1,
            path: newPath,
            critical: edge.data?.critical ?? false,
          })

          next.push({ id: edge.source, hops: current.hops + 1, path: newPath })
        }
      }
      queue = next
    }

    // Sort by hops ascending, critical first within same hop
    affected.sort((a, b) => {
      if (a.hops !== b.hops) return a.hops - b.hops
      if (a.critical !== b.critical) return a.critical ? -1 : 1
      return 0
    })

    return {
      source: {
        id: sourceNode.id,
        label: sourceNode.data.label,
      },
      affected,
    }
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
