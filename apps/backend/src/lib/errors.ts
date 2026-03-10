import type { Context } from 'hono'
import { logger } from './logger'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function handleError(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.statusCode as any)
  }
  logger.error(err, 'Unhandled error')
  return c.json({ error: 'Internal Server Error' }, 500)
}
