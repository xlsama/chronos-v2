import { ofetch } from 'ofetch'
import { z } from 'zod'
import type { MCPFactory, MCPServer, MCPTool } from '../types'

export const grafanaFactory: MCPFactory = async (connection) => {
  const { url, apiKey } = connection.config as {
    url: string
    apiKey: string
  }

  const baseURL = `${url.replace(/\/+$/, '')}/api`

  const fetcher = ofetch.create({
    baseURL,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  })

  // Verify connectivity
  await fetcher('/org')

  const tools: Record<string, MCPTool> = {
    queryDatasource: {
      description: 'Query a Grafana datasource (Prometheus, Loki, etc).',
      parameters: z.object({
        datasourceUid: z.string().describe('Datasource UID'),
        query: z.record(z.string(), z.unknown()).describe('Query object (datasource-specific)'),
        from: z.string().optional().describe('Start time (e.g. "now-1h")'),
        to: z.string().optional().describe('End time (e.g. "now")'),
      }),
      execute: async ({ datasourceUid, query, from, to }: {
        datasourceUid: string
        query: Record<string, unknown>
        from?: string
        to?: string
      }) => {
        const result = await fetcher('/ds/query', {
          method: 'POST',
          body: {
            queries: [{ ...query, datasource: { uid: datasourceUid } }],
            from: from ?? 'now-1h',
            to: to ?? 'now',
          },
        })
        return { result: result.results }
      },
    },
    getAlerts: {
      description: 'List Grafana alerting rules and their states.',
      parameters: z.object({
        state: z.string().optional().describe('Filter by state (e.g. firing, pending, inactive)'),
      }),
      execute: async ({ state }: { state?: string }) => {
        const result = await fetcher('/prometheus/api/v1/rules', {
          query: state ? { type: 'alert', state } : { type: 'alert' },
        })
        const groups = result.data?.groups ?? []
        const alerts: any[] = []
        for (const group of groups) {
          for (const rule of group.rules ?? []) {
            if (rule.type === 'alerting') {
              alerts.push({
                name: rule.name,
                state: rule.state,
                labels: rule.labels,
                annotations: rule.annotations,
                activeAt: rule.alerts?.[0]?.activeAt,
              })
            }
          }
        }
        return { alerts }
      },
    },
    getDashboards: {
      description: 'Search Grafana dashboards.',
      parameters: z.object({
        query: z.string().optional().describe('Search query'),
      }),
      execute: async ({ query }: { query?: string }) => {
        const result = await fetcher('/search', {
          query: { type: 'dash-db', ...(query && { query }) },
        })
        return {
          dashboards: result.map((d: any) => ({
            uid: d.uid,
            title: d.title,
            url: d.url,
            tags: d.tags,
          })),
        }
      },
    },
  }

  const server: MCPServer = {
    connectionId: connection.id,
    connectionName: connection.name,
    connectionType: 'grafana',
    tools,
    dispose: async () => {
      // HTTP client, no cleanup needed
    },
  }

  return server
}
