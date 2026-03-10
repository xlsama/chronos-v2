import Redis from 'ioredis'
import { z } from 'zod'
import type { MCPFactory, MCPServer, MCPTool } from '../types'

const DANGEROUS_COMMANDS = new Set([
  'FLUSHDB', 'FLUSHALL', 'SHUTDOWN', 'DEBUG',
  'CONFIG', 'SLAVEOF', 'REPLICAOF', 'CLUSTER',
])

export const redisFactory: MCPFactory = async (connection) => {
  const { host, port, password, db } = connection.config as {
    host: string
    port?: number
    password?: string
    db?: number
  }

  const client = new Redis({
    host,
    port: port ?? 6379,
    password,
    db: db ?? 0,
    connectTimeout: 10000,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  })

  await client.connect()
  await client.ping()

  const tools: Record<string, MCPTool> = {
    execute: {
      description: 'Execute a Redis command. Dangerous commands (FLUSHDB/FLUSHALL/SHUTDOWN/CONFIG SET/DEBUG) are blocked.',
      parameters: z.object({
        command: z.string().describe('Redis command (e.g. GET, SET, HGETALL)'),
        args: z.array(z.string()).optional().describe('Command arguments'),
      }),
      execute: async ({ command, args }: { command: string; args?: string[] }) => {
        const cmd = command.toUpperCase()
        if (DANGEROUS_COMMANDS.has(cmd) || (cmd === 'CONFIG' && args?.[0]?.toUpperCase() === 'SET')) {
          return { error: `Command ${cmd} is blocked for safety` }
        }

        const result = await client.call(cmd, ...(args ?? []))
        return { result }
      },
    },
    info: {
      description: 'Get Redis server information.',
      parameters: z.object({
        section: z.string().optional().describe('Info section (e.g. memory, stats, replication)'),
      }),
      execute: async ({ section }: { section?: string }) => {
        const result = section ? await client.info(section) : await client.info()
        return { info: result }
      },
    },
    keys: {
      description: 'Search for keys matching a pattern (limited to 100 results). Use SCAN internally for safety.',
      parameters: z.object({
        pattern: z.string().describe('Key pattern (e.g. user:*, session:*)'),
      }),
      execute: async ({ pattern }: { pattern: string }) => {
        const keys: string[] = []
        let cursor = '0'
        do {
          const [nextCursor, results] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
          cursor = nextCursor
          keys.push(...results)
          if (keys.length >= 100) break
        } while (cursor !== '0')

        return { keys: keys.slice(0, 100), count: keys.length }
      },
    },
  }

  const server: MCPServer = {
    connectionId: connection.id,
    connectionName: connection.name,
    connectionType: 'redis',
    tools,
    dispose: async () => {
      client.disconnect()
    },
  }

  return server
}
