import { logger } from '../lib/logger'
import { env } from '../env'

let digestTimer: ReturnType<typeof setInterval> | null = null

export function startCronJobs() {
  // Runbook digest: runs daily at 02:00 (check every minute, trigger at 02:00)
  // Using setInterval approach to avoid extra dependency
  let lastDigestDate = ''

  digestTimer = setInterval(async () => {
    const now = new Date()
    const hour = now.getHours()
    const dateStr = now.toISOString().slice(0, 10)

    // Run at 02:00, once per day
    if (hour === 2 && dateStr !== lastDigestDate) {
      lastDigestDate = dateStr
      logger.info('Running scheduled runbook-digest job')
      try {
        const res = await fetch(`http://localhost:${env.PORT}/api/jobs/runbook-digest`, {
          method: 'POST',
        })
        if (res.ok) {
          const result = await res.json()
          logger.info({ result }, 'Runbook digest completed')
        } else {
          logger.error({ status: res.status }, 'Runbook digest failed')
        }
      } catch (error) {
        logger.error({ err: error }, 'Runbook digest job error')
      }
    }
  }, 60_000) // Check every minute

  logger.info('Cron jobs started (runbook-digest at 02:00 daily)')
}

export function stopCronJobs() {
  if (digestTimer) {
    clearInterval(digestTimer)
    digestTimer = null
  }
}
