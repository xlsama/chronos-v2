import { Queue } from 'bullmq'
import { env } from '../env'

function parseRedisConnection(url: string) {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    db: parsed.pathname ? Number(parsed.pathname.slice(1)) || 0 : 0,
  }
}

export const redisConnection = parseRedisConnection(env.REDIS_URL)

export const agentBackgroundQueue = new Queue('agent-background', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
})

export const scheduledQueue = new Queue('scheduled', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
})

export interface AgentBackgroundJobData {
  threadId: string
  incidentId: string
  content: string
  projectId: string | null
  summary?: string | null
}
