import { Hono } from 'hono'
import { agentBackgroundQueue, scheduledQueue } from '../lib/queues'

const queues = { 'agent-background': agentBackgroundQueue, scheduled: scheduledQueue }

export const queueRoutes = new Hono()
  .get('/', async (c) => {
    const stats = await Promise.all(
      Object.entries(queues).map(async ([name, queue]) => {
        const counts = await queue.getJobCounts()
        return { name, ...counts }
      }),
    )
    return c.json({ data: stats })
  })
  .get('/:name/jobs', async (c) => {
    const name = c.req.param('name') as keyof typeof queues
    const queue = queues[name]
    if (!queue) return c.json({ error: 'Queue not found' }, 404)

    const status = (c.req.query('status') ?? 'failed') as 'completed' | 'failed' | 'delayed' | 'active' | 'waiting'
    const jobs = await queue.getJobs([status], 0, 20)
    return c.json({
      data: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        data: j.data,
        status: j.finishedOn ? 'completed' : j.failedReason ? 'failed' : 'active',
        failedReason: j.failedReason,
        attemptsMade: j.attemptsMade,
        createdAt: j.timestamp,
        finishedAt: j.finishedOn,
      })),
    })
  })
  .post('/:name/retry', async (c) => {
    const name = c.req.param('name') as keyof typeof queues
    const queue = queues[name]
    if (!queue) return c.json({ error: 'Queue not found' }, 404)

    const failed = await queue.getJobs(['failed'], 0, 100)
    let retried = 0
    for (const job of failed) {
      await job.retry()
      retried++
    }
    return c.json({ data: { retried } })
  })
