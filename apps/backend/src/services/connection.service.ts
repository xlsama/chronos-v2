import { eq, desc } from 'drizzle-orm'
import { db } from '../db/index'
import { connections } from '../db/schema/index'
import { encrypt, decrypt } from '../lib/crypto'
import { logger } from '../lib/logger'
import { mcpRegistry } from '../mcp/registry'

import type { connectionTypeEnum, mcpStatusEnum } from '../db/schema/enums'

export type CreateConnectionInput = {
  name: string
  type: (typeof connectionTypeEnum.enumValues)[number]
  config: Record<string, unknown>
  kbProjectId?: string | null
  importSource?: 'manual' | 'kb'
  importMetadata?: {
    sourceDocuments: Array<{ id: string; title: string }>
    warnings: string[]
    confidence: number | null
    sourceExcerpt: string | null
    importedAt: string
  } | null
}

export type UpdateConnectionInput = {
  name?: string
  config?: Record<string, unknown>
  status?: 'connected' | 'disconnected' | 'error'
}

// Mask sensitive config data for API responses
function maskConfig(configStr: string): Record<string, unknown> {
  try {
    const config = JSON.parse(decrypt(configStr))
    const masked: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(config)) {
      if (['password', 'secret', 'token', 'apiKey', 'api_key', 'appKey', 'adminKey', 'privateKey'].some(s => key.toLowerCase().includes(s.toLowerCase()))) {
        masked[key] = '••••••••'
      } else {
        masked[key] = value
      }
    }
    return masked
  } catch {
    return {}
  }
}

async function updateMcpStatus(id: string, status: (typeof mcpStatusEnum.enumValues)[number], error?: string) {
  await db.update(connections).set({
    mcpStatus: status,
    mcpError: error ?? null,
  }).where(eq(connections.id, id))
}

function registerMcpAsync(connection: { id: string; name: string; type: string; config: Record<string, unknown> }) {
  updateMcpStatus(connection.id, 'registering').then(() =>
    mcpRegistry.register(connection)
  ).then(() =>
    updateMcpStatus(connection.id, 'registered')
  ).catch((err) => {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.error({ err, connectionId: connection.id }, 'Async MCP registration failed')
    updateMcpStatus(connection.id, 'error', errorMsg)
  })
}

export const connectionService = {
  async list() {
    const data = await db.select().from(connections).orderBy(desc(connections.createdAt))
    return data.map(row => ({
      ...row,
      config: maskConfig(row.config),
    }))
  },

  async getById(id: string) {
    const [row] = await db.select().from(connections).where(eq(connections.id, id))
    if (!row) return null
    return { ...row, config: maskConfig(row.config) }
  },

  async getRawById(id: string) {
    const [row] = await db.select().from(connections).where(eq(connections.id, id))
    if (!row) return null
    return { ...row, config: JSON.parse(decrypt(row.config)) as Record<string, unknown> }
  },

  async create(input: CreateConnectionInput) {
    const encryptedConfig = encrypt(JSON.stringify(input.config))
    const [row] = await db.insert(connections).values({
      name: input.name,
      type: input.type,
      config: encryptedConfig,
      kbProjectId: input.kbProjectId ?? null,
      importSource: input.importSource ?? 'manual',
      importMetadata: input.importMetadata ?? null,
    }).returning()

    // Register MCP server asynchronously (fire-and-forget)
    registerMcpAsync({
      id: row.id,
      name: row.name,
      type: row.type,
      config: input.config,
    })

    return { ...row, config: maskConfig(row.config) }
  },

  async update(id: string, input: UpdateConnectionInput) {
    // Merge config with existing if partial update
    if (input.config) {
      const [existing] = await db.select().from(connections).where(eq(connections.id, id))
      if (existing) {
        const existingConfig = JSON.parse(decrypt(existing.config))
        const mergedConfig = { ...existingConfig, ...input.config }
        input.config = mergedConfig
      }
    }

    const updateData: Record<string, unknown> = {}
    if (input.name) updateData.name = input.name
    if (input.status) updateData.status = input.status
    if (input.config) updateData.config = encrypt(JSON.stringify(input.config))

    const [row] = await db.update(connections).set(updateData).where(eq(connections.id, id)).returning()
    if (!row) return null

    // Re-register MCP server asynchronously if name or config changed
    if (input.name || input.config) {
      const config = input.config ?? JSON.parse(decrypt(row.config)) as Record<string, unknown>
      await mcpRegistry.unregister(id)
      registerMcpAsync({ id: row.id, name: row.name, type: row.type, config })
    }

    return { ...row, config: maskConfig(row.config) }
  },

  async delete(id: string) {
    await mcpRegistry.unregister(id)
    const [row] = await db.delete(connections).where(eq(connections.id, id)).returning()
    return row ?? null
  },

  async updateStatus(id: string, status: 'connected' | 'disconnected' | 'error') {
    await db.update(connections).set({
      status,
      lastTestedAt: new Date(),
    }).where(eq(connections.id, id))
  },

  updateMcpStatus,

  async getAllActive() {
    return db.select().from(connections).where(eq(connections.status, 'connected'))
  },
}
