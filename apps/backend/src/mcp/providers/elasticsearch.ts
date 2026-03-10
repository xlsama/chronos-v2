import { ofetch } from 'ofetch'
import { z } from 'zod'
import type { MCPFactory, MCPServer, MCPTool } from '../types'

export const elasticsearchFactory: MCPFactory = async (connection) => {
  const { url, apiKey, username, password } = connection.config as {
    url: string
    apiKey?: string
    username?: string
    password?: string
  }

  const baseURL = url.replace(/\/+$/, '')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) {
    headers['Authorization'] = `ApiKey ${apiKey}`
  } else if (username && password) {
    headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
  }

  const fetcher = ofetch.create({ baseURL, headers, timeout: 30000 })

  // Verify connectivity
  await fetcher('/')

  const tools: Record<string, MCPTool> = {
    search: {
      description: 'Search documents in an Elasticsearch index.',
      parameters: z.object({
        index: z.string().describe('Index name or pattern'),
        query: z.record(z.string(), z.unknown()).describe('Elasticsearch query DSL (JSON object)'),
        size: z.number().optional().default(20).describe('Number of results (default: 20, max: 100)'),
      }),
      execute: async ({ index, query, size }: { index: string; query: Record<string, unknown>; size?: number }) => {
        const result = await fetcher(`/${index}/_search`, {
          method: 'POST',
          body: { query, size: Math.min(size ?? 20, 100) },
        })
        return {
          total: result.hits?.total,
          hits: result.hits?.hits?.map((h: any) => ({
            _index: h._index,
            _id: h._id,
            _source: h._source,
          })),
        }
      },
    },
    getIndices: {
      description: 'List Elasticsearch indices.',
      parameters: z.object({
        pattern: z.string().optional().default('*').describe('Index pattern (default: *)'),
      }),
      execute: async ({ pattern }: { pattern?: string }) => {
        const result = await fetcher(`/_cat/indices/${pattern ?? '*'}`, {
          query: { format: 'json', h: 'index,health,status,docs.count,store.size' },
        })
        return { indices: result }
      },
    },
    clusterHealth: {
      description: 'Get Elasticsearch cluster health status.',
      parameters: z.object({}),
      execute: async () => {
        const result = await fetcher('/_cluster/health')
        return { health: result }
      },
    },
  }

  const server: MCPServer = {
    connectionId: connection.id,
    connectionName: connection.name,
    connectionType: 'elasticsearch',
    tools,
    dispose: async () => {
      // HTTP client, no cleanup needed
    },
  }

  return server
}
