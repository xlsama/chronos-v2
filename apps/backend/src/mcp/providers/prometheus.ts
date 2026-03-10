import { ofetch } from 'ofetch'
import { z } from 'zod'
import type { MCPFactory, MCPServer, MCPTool } from '../types'

export const prometheusFactory: MCPFactory = async (connection) => {
  const { url, username, password } = connection.config as {
    url: string
    username?: string
    password?: string
  }

  const baseURL = `${url.replace(/\/+$/, '')}/api/v1`

  const headers: Record<string, string> = {}
  if (username && password) {
    headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
  }

  const fetcher = ofetch.create({ baseURL, headers, timeout: 30000 })

  // Verify connectivity
  await fetcher('/status/buildinfo')

  const tools: Record<string, MCPTool> = {
    query: {
      description: 'Execute an instant PromQL query.',
      parameters: z.object({
        query: z.string().describe('PromQL expression'),
        time: z.string().optional().describe('Evaluation timestamp (RFC3339 or Unix timestamp)'),
      }),
      execute: async ({ query, time }: { query: string; time?: string }) => {
        const result = await fetcher('/query', {
          query: { query, ...(time && { time }) },
        })
        return { status: result.status, data: result.data }
      },
    },
    queryRange: {
      description: 'Execute a range PromQL query.',
      parameters: z.object({
        query: z.string().describe('PromQL expression'),
        start: z.string().describe('Start time (RFC3339 or Unix timestamp)'),
        end: z.string().describe('End time (RFC3339 or Unix timestamp)'),
        step: z.string().optional().default('60s').describe('Query step (default: 60s)'),
      }),
      execute: async ({ query, start, end, step }: { query: string; start: string; end: string; step?: string }) => {
        const result = await fetcher('/query_range', {
          query: { query, start, end, step: step ?? '60s' },
        })
        return { status: result.status, data: result.data }
      },
    },
    alerts: {
      description: 'List active Prometheus alerts.',
      parameters: z.object({}),
      execute: async () => {
        const result = await fetcher('/alerts')
        return {
          alerts: result.data?.alerts?.map((a: any) => ({
            labels: a.labels,
            annotations: a.annotations,
            state: a.state,
            activeAt: a.activeAt,
            value: a.value,
          })),
        }
      },
    },
  }

  const server: MCPServer = {
    connectionId: connection.id,
    connectionName: connection.name,
    connectionType: 'prometheus',
    tools,
    dispose: async () => {
      // HTTP client, no cleanup needed
    },
  }

  return server
}
