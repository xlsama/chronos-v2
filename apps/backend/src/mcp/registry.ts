import { tool } from 'ai'
import { db } from '../db/index'
import { connections } from '../db/schema/index'
import { decrypt } from '../lib/crypto'
import { logger } from '../lib/logger'
import { slugify } from './utils'
import type { MCPFactory, MCPServer } from './types'

class MCPRegistry {
  private factories = new Map<string, MCPFactory>()
  private servers = new Map<string, MCPServer>()

  registerFactory(type: string, factory: MCPFactory) {
    this.factories.set(type, factory)
  }

  async register(connection: { id: string; name: string; type: string; config: Record<string, unknown> }) {
    const factory = this.factories.get(connection.type)
    if (!factory) {
      logger.warn({ type: connection.type, name: connection.name }, 'No MCP factory for connection type')
      return
    }

    // Unregister existing server for this connection if any
    await this.unregister(connection.id)

    try {
      const server = await factory({
        id: connection.id,
        name: connection.name,
        config: connection.config,
      })
      this.servers.set(connection.id, server)
      logger.info(
        { connectionId: connection.id, name: connection.name, type: connection.type, tools: Object.keys(server.tools) },
        'MCP server registered',
      )
    } catch (err) {
      logger.error({ err, connectionId: connection.id, name: connection.name }, 'Failed to register MCP server')
    }
  }

  async unregister(connectionId: string) {
    const server = this.servers.get(connectionId)
    if (server) {
      try {
        await server.dispose()
      } catch (err) {
        logger.error({ err, connectionId }, 'Failed to dispose MCP server')
      }
      this.servers.delete(connectionId)
      logger.info({ connectionId }, 'MCP server unregistered')
    }
  }

  getAllToolsAsAISDK() {
    const allTools: Record<string, any> = {}
    const usedNames = new Set<string>()

    for (const server of this.servers.values()) {
      const slug = slugify(server.connectionName)
      const prefix = slug || server.connectionId.slice(0, 6)

      for (const [toolName, mcpTool] of Object.entries(server.tools)) {
        let key = `${prefix}_${toolName}`
        if (usedNames.has(key)) {
          key = `${prefix}_${server.connectionId.slice(0, 6)}_${toolName}`
        }
        usedNames.add(key)

        allTools[key] = tool({
          description: `[${server.connectionName}] ${mcpTool.description}`,
          inputSchema: mcpTool.parameters,
          execute: mcpTool.execute,
        })
      }
    }

    return allTools
  }

  async initialize() {
    const rows = await db.select().from(connections)
    logger.info({ count: rows.length }, 'Initializing MCP servers from DB')

    for (const row of rows) {
      try {
        const config = JSON.parse(decrypt(row.config)) as Record<string, unknown>
        await this.register({ id: row.id, name: row.name, type: row.type, config })
      } catch (err) {
        logger.error({ err, connectionId: row.id, name: row.name }, 'Failed to initialize MCP server')
      }
    }
  }

  getServerCount() {
    return this.servers.size
  }
}

export const mcpRegistry = new MCPRegistry()
