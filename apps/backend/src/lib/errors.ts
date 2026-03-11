import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { logger } from './logger'

export class AppError extends Error {
  constructor(
    public statusCode: ContentfulStatusCode,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function handleError(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.statusCode)
  }
  logger.error(err, 'Unhandled error')
  return c.json({ error: 'Internal Server Error' }, 500)
}
