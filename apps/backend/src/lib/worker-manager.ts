import type { Worker } from 'bullmq'
import { createAgentBackgroundWorker } from '../workers/agent-background.worker'
import { createScheduledWorker } from '../workers/scheduled.worker'
import { scheduledQueue } from './queues'
import { logger } from './logger'

const workers: Worker[] = []

export async function startWorkers() {
  workers.push(createAgentBackgroundWorker())
  workers.push(createScheduledWorker())

  // Register repeatable job for runbook-digest (daily at 02:00)
  await scheduledQueue.add('runbook-digest', {}, {
    repeat: { pattern: '0 2 * * *' },
    jobId: 'runbook-digest-daily',
  })

  logger.info(`[WorkerManager] ${workers.length} workers started`)
}

export async function stopWorkers() {
  logger.info('[WorkerManager] shutting down workers...')
  await Promise.all(workers.map((w) => w.close()))
  logger.info('[WorkerManager] all workers stopped')
}
