import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { dynamicTool, jsonSchema, type JSONSchema7, type Tool } from 'ai'
import { db } from '../db/index'
import { connections } from '../db/schema/index'
import { decrypt } from '../lib/crypto'
import { logger } from '../lib/logger'
import { slugify } from './utils'
import type { SpawnConfigBuilder, MCPClientConnection } from './types'

export type McpStatusChangeCallback = (id: string, status: 'registering' | 'registered' | 'error', error?: string) => void

class MCPRegistry {
  private builders = new Map<string, SpawnConfigBuilder>()
  private clients = new Map<string, MCPClientConnection>()

  registerBuilder(type: string, builder: SpawnConfigBuilder) {
    this.builders.set(type, builder)
  }

  async register(connection: { id: string; name: string; type: string; config: Record<string, unknown> }) {
    const builder = this.builders.get(connection.type)
    if (!builder) {
      logger.warn({ type: connection.type, name: connection.name }, 'No MCP builder for connection type')
      return
    }

    await this.unregister(connection.id)

    const spawnConfig = builder(connection.config)
    const transport = new StdioClientTransport({
      command: spawnConfig.command,
      args: spawnConfig.args,
      env: { ...process.env, ...spawnConfig.env } as Record<string, string>,
    })
    const client = new Client({ name: 'chronos', version: '1.0.0' })
    await client.connect(transport)

    const { tools } = await client.listTools()

    const mcpConnection: MCPClientConnection = {
      connectionId: connection.id,
      connectionName: connection.name,
      connectionType: connection.type,
      client,
      transport,
      tools,
      dispose: async () => {
        await client.close()
      },
    }

    this.clients.set(connection.id, mcpConnection)
    logger.info(
      { connectionId: connection.id, name: connection.name, type: connection.type, tools: tools.map(t => t.name) },
      'MCP client connected',
    )
  }

  async unregister(connectionId: string) {
    const conn = this.clients.get(connectionId)
    if (conn) {
      try {
        await conn.dispose()
      } catch (err) {
        logger.error({ err, connectionId }, 'Failed to dispose MCP client')
      }
      this.clients.delete(connectionId)
      logger.info({ connectionId }, 'MCP client disconnected')
    }
  }

  hasClient(connectionId: string) {
    return this.clients.has(connectionId)
  }

  getAllToolsAsAISDK() {
    const allTools: Record<string, Tool<unknown, unknown> & { type: 'dynamic' }> = {}
    const usedNames = new Set<string>()

    for (const conn of this.clients.values()) {
      const slug = slugify(conn.connectionName)
      const prefix = slug || conn.connectionId.slice(0, 6)

      for (const mcpTool of conn.tools) {
        let key = `${prefix}_${mcpTool.name}`
        if (usedNames.has(key)) {
          key = `${prefix}_${conn.connectionId.slice(0, 6)}_${mcpTool.name}`
        }
        usedNames.add(key)

        allTools[key] = dynamicTool({
          description: `[${conn.connectionName}] ${mcpTool.description || mcpTool.name}`,
          inputSchema: jsonSchema(mcpTool.inputSchema as JSONSchema7),
          execute: async (input) => {
            const result = await conn.client.callTool({
              name: mcpTool.name,
              arguments: input as Record<string, unknown>,
            })
            return result.content
          },
        })
      }
    }

    return allTools
  }

  async initialize(onStatusChange?: McpStatusChangeCallback) {
    const rows = await db.select().from(connections)
    logger.info({ count: rows.length }, 'Initializing MCP clients from DB')

    for (const row of rows) {
      try {
        const config = JSON.parse(decrypt(row.config)) as Record<string, unknown>
        onStatusChange?.(row.id, 'registering')
        await this.register({ id: row.id, name: row.name, type: row.type, config })
        onStatusChange?.(row.id, 'registered')
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        onStatusChange?.(row.id, 'error', errorMsg)
        logger.error({ err, connectionId: row.id, name: row.name }, 'Failed to initialize MCP client')
      }
    }
  }

  getClientCount() {
    return this.clients.size
  }
}

export const mcpRegistry = new MCPRegistry()
