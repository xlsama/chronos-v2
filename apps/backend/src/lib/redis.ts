import Redis from 'ioredis'
import { env } from '../env'
import { logger } from './logger'

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error')
})

redis.on('connect', () => {
  logger.info('Redis connected')
})

// Dedicated pub/sub connections
let publisher: Redis | null = null
let subscriber: Redis | null = null

export function getPublisher() {
  if (!publisher) {
    publisher = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true })
    publisher.on('error', (err) => logger.error({ err }, 'Redis publisher error'))
  }
  return publisher
}

export function getSubscriber() {
  if (!subscriber) {
    subscriber = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true })
    subscriber.on('error', (err) => logger.error({ err }, 'Redis subscriber error'))
  }
  return subscriber
}

export function chatChannel(threadId: string) {
  return `chat:${threadId}`
}

export async function publishChatEvent(threadId: string, event: string, data: unknown) {
  const pub = getPublisher()
  await pub.publish(chatChannel(threadId), JSON.stringify({ event, data }))
}
