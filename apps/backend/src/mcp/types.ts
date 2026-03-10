import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

export interface MCPSpawnConfig {
  command: string
  args: string[]
  env: Record<string, string>
}

export type SpawnConfigBuilder = (config: Record<string, unknown>) => MCPSpawnConfig

export interface MCPClientConnection {
  connectionId: string
  connectionName: string
  connectionType: string
  client: Client
  transport: StdioClientTransport
  tools: { name: string; description?: string; inputSchema: Record<string, unknown> }[]
  dispose: () => Promise<void>
}
