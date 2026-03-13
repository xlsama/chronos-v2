import { logger } from '../lib/logger'

// Cron jobs are now managed by BullMQ repeatable jobs.
// See lib/worker-manager.ts for registration and workers/scheduled.worker.ts for execution.

export function startCronJobs() {
  logger.info('Cron jobs managed by BullMQ (runbook-digest repeatable job at 02:00 daily)')
}

export function stopCronJobs() {
  // No-op: BullMQ workers handle shutdown via worker-manager
}
