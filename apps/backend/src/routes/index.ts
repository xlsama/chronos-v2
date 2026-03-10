import { Hono } from 'hono'
import { incidentRoutes } from './incidents'
import { chatRoutes } from './chat'
import { runbookRoutes } from './runbooks'
import { skillRoutes } from './skills'
import { connectionRoutes } from './connections'
import { serviceMapRoutes } from './service-maps'
import { webhookRoutes } from './webhooks'
import { uploadRoutes } from './upload'
import { notificationSettingsRoutes } from './notification-settings'

export const apiRoutes = new Hono()
  .route('/api/incidents', incidentRoutes)
  .route('/api/chat', chatRoutes)
  .route('/api/runbooks', runbookRoutes)
  .route('/api/skills', skillRoutes)
  .route('/api/connections', connectionRoutes)
  .route('/api/service-maps', serviceMapRoutes)
  .route('/api/webhooks', webhookRoutes)
  .route('/api/notification-settings', notificationSettingsRoutes)
  .route('/api', uploadRoutes)

export type AppType = typeof apiRoutes
