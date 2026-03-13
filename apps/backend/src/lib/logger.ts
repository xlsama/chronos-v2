import pino from 'pino'
import { env } from '../env'

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            ignore: 'time,pid,hostname,reqId,req,res,responseTime',
          },
        }
      : undefined,
})

export function truncate(value: unknown, maxLen = 500): unknown {
  if (typeof value === 'string') {
    return value.length > maxLen ? value.slice(0, maxLen) + `...(${value.length} chars)` : value
  }
  if (typeof value === 'object' && value !== null) {
    const str = JSON.stringify(value)
    if (str.length > maxLen) return str.slice(0, maxLen) + `...(${str.length} chars)`
    return value
  }
  return value
}
