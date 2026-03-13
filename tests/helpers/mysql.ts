import mysql, { type Connection, type ConnectionOptions } from 'mysql2/promise'

export async function connectMySqlWithRetry(
  config: ConnectionOptions,
  options?: { retries?: number; delayMs?: number },
): Promise<Connection> {
  const retries = options?.retries ?? 10
  const delayMs = options?.delayMs ?? 2_000

  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await mysql.createConnection(config)
    } catch (error) {
      lastError = error
      if (attempt === retries) break
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to connect to MySQL after retries')
}
