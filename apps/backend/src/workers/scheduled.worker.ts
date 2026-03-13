import { Worker, type Job } from 'bullmq'
import { redisConnection } from '../lib/queues'
import { logger } from '../lib/logger'
import { env } from '../env'

async function processScheduledJob(job: Job) {
  switch (job.name) {
    case 'runbook-digest': {
      logger.info({ jobId: job.id }, '[Scheduled] running runbook-digest')
      const res = await fetch(`http://localhost:${env.PORT}/api/jobs/runbook-digest`, {
        method: 'POST',
      })
      if (res.ok) {
        const result = await res.json()
        logger.info({ result, jobId: job.id }, '[Scheduled] runbook-digest completed')
      } else {
        throw new Error(`Runbook digest failed with status ${res.status}`)
      }
      break
    }
    default:
      logger.warn({ jobName: job.name }, '[Scheduled] unknown job name')
  }
}

export function createScheduledWorker() {
  const worker = new Worker('scheduled', processScheduledJob, {
    connection: redisConnection,
    concurrency: 1,
  })

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, name: job.name }, '[Queue] scheduled job completed')
  })

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, name: job?.name, err }, '[Queue] scheduled job failed')
  })

  return worker
}
