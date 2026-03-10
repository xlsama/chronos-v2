import Redis from 'ioredis'
import { env } from '../env'

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

export const publisher = redis

export function createSubscriber() {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
  })
}
