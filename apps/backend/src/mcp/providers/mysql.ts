import mysql from 'mysql2/promise'
import { z } from 'zod'
import type { MCPFactory, MCPServer, MCPTool } from '../types'

const DDL_PATTERN = /^\s*(DROP|ALTER|TRUNCATE|CREATE)\b/i
const WRITE_PATTERN = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i
const TABLE_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/

export const mysqlFactory: MCPFactory = async (connection) => {
  const { host, port, user, password, database } = connection.config as {
    host: string
    port?: number
    user: string
    password: string
    database: string
  }

  const pool = mysql.createPool({
    host,
    port: port ?? 3306,
    user,
    password,
    database,
    connectionLimit: 3,
    connectTimeout: 10000,
  })

  // Verify connectivity
  const conn = await pool.getConnection()
  conn.release()

  const tools: Record<string, MCPTool> = {
    query: {
      description: 'Execute SQL query (SELECT/INSERT/UPDATE/DELETE). DDL statements are forbidden.',
      parameters: z.object({
        sql: z.string().describe('SQL statement to execute'),
      }),
      execute: async ({ sql }: { sql: string }) => {
        if (DDL_PATTERN.test(sql)) {
          return { error: 'DDL statements (DROP/ALTER/TRUNCATE/CREATE) are forbidden' }
        }

        const isWrite = WRITE_PATTERN.test(sql)
        const querySql = !isWrite ? `${sql.replace(/;\s*$/, '')} LIMIT 500` : sql

        const [rows] = await pool.query({ sql: querySql, timeout: 30000 })

        if (isWrite) {
          return { result: rows, warning: '⚠️ 写操作已执行' }
        }
        return { result: rows }
      },
    },
    showTables: {
      description: 'List all tables in the database.',
      parameters: z.object({}),
      execute: async () => {
        const [rows] = await pool.query('SHOW TABLES')
        return { tables: rows }
      },
    },
    describeTable: {
      description: 'Show table structure (columns, types, keys).',
      parameters: z.object({
        table: z.string().describe('Table name'),
      }),
      execute: async ({ table }: { table: string }) => {
        if (!TABLE_NAME_PATTERN.test(table)) {
          return { error: 'Invalid table name' }
        }
        const [rows] = await pool.query(`DESCRIBE \`${table}\``)
        return { columns: rows }
      },
    },
    showProcesslist: {
      description: 'Show current connections and running queries.',
      parameters: z.object({}),
      execute: async () => {
        const [rows] = await pool.query('SHOW PROCESSLIST')
        return { processes: rows }
      },
    },
  }

  const server: MCPServer = {
    connectionId: connection.id,
    connectionName: connection.name,
    connectionType: 'mysql',
    tools,
    dispose: async () => {
      await pool.end()
    },
  }

  return server
}
