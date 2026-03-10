import postgres from 'postgres'
import { z } from 'zod'
import type { MCPFactory, MCPServer, MCPTool } from '../types'

const DDL_PATTERN = /^\s*(DROP|ALTER|TRUNCATE|CREATE)\b/i
const WRITE_PATTERN = /^\s*(INSERT|UPDATE|DELETE)\b/i
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/

export const postgresqlFactory: MCPFactory = async (connection) => {
  const { host, port, user, password, database } = connection.config as {
    host: string
    port?: number
    user: string
    password: string
    database: string
  }

  const sql = postgres({
    host,
    port: port ?? 5432,
    user,
    password,
    database,
    max: 3,
    connect_timeout: 10,
  })

  // Verify connectivity
  await sql`SELECT 1`

  const tools: Record<string, MCPTool> = {
    query: {
      description: 'Execute SQL query (SELECT/INSERT/UPDATE/DELETE). DDL statements are forbidden.',
      parameters: z.object({
        sql: z.string().describe('SQL statement to execute'),
      }),
      execute: async ({ sql: query }: { sql: string }) => {
        if (DDL_PATTERN.test(query)) {
          return { error: 'DDL statements (DROP/ALTER/TRUNCATE/CREATE) are forbidden' }
        }

        const isWrite = WRITE_PATTERN.test(query)
        const rows = await sql.unsafe(query, [], { prepare: false })

        if (isWrite) {
          return { result: rows, warning: '⚠️ 写操作已执行' }
        }
        return { result: rows.slice(0, 500) }
      },
    },
    listTables: {
      description: 'List all tables in the database.',
      parameters: z.object({
        schema: z.string().optional().default('public').describe('Schema name (default: public)'),
      }),
      execute: async ({ schema }: { schema?: string }) => {
        const s = schema ?? 'public'
        const rows = await sql`
          SELECT table_name, table_type
          FROM information_schema.tables
          WHERE table_schema = ${s}
          ORDER BY table_name
        `
        return { tables: rows }
      },
    },
    describeTable: {
      description: 'Show table structure (columns, types, constraints).',
      parameters: z.object({
        table: z.string().describe('Table name'),
        schema: z.string().optional().default('public').describe('Schema name (default: public)'),
      }),
      execute: async ({ table, schema }: { table: string; schema?: string }) => {
        if (!IDENTIFIER_PATTERN.test(table)) {
          return { error: 'Invalid table name' }
        }
        const s = schema ?? 'public'
        const rows = await sql`
          SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
          FROM information_schema.columns
          WHERE table_schema = ${s} AND table_name = ${table}
          ORDER BY ordinal_position
        `
        return { columns: rows }
      },
    },
  }

  const server: MCPServer = {
    connectionId: connection.id,
    connectionName: connection.name,
    connectionType: 'postgresql',
    tools,
    dispose: async () => {
      await sql.end()
    },
  }

  return server
}
