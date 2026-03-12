import { Hono } from 'hono'
import { incidentRoutes } from './incidents'
import { webhookRoutes } from './webhooks'
import { uploadRoutes } from './upload'
import { projectRoutes } from './projects'
import { skillRoutes } from './skills'
import { serviceMapContextRoutes } from './service-map-context'
import { jobRoutes } from './jobs'
import { chatRoutes } from './chat'
import { notificationSettingsRoutes } from './notification-settings'

export const apiRoutes = new Hono()
  .route('/api/incidents', incidentRoutes)
  .route('/api/projects', projectRoutes)
  .route('/api/skills', skillRoutes)
  .route('/api/service-map', serviceMapContextRoutes)
  .route('/api/webhooks', webhookRoutes)
  .route('/api/jobs', jobRoutes)
  .route('/api/chat', chatRoutes)
  .route('/api/notification-settings', notificationSettingsRoutes)
  .route('/api', uploadRoutes)

export type AppType = typeof apiRoutes
