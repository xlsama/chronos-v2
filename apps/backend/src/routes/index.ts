import { Hono } from 'hono'
import { incidentRoutes } from './incidents'
import { chatRoutes } from './chat'
import { runbookRoutes } from './runbooks'
import { connectionRoutes } from './connections'
import { serviceMapRoutes } from './service-maps'
import { webhookRoutes } from './webhooks'
import { uploadRoutes } from './upload'
import { transcribeRoutes } from './transcribe'
import { notificationSettingsRoutes } from './notification-settings'
import { knowledgeBaseRoutes } from './knowledge-base'
import { toolPolicyRoutes } from './tool-policies'
import { approvalRoutes } from './approvals'

export const apiRoutes = new Hono()
  .route('/api/incidents', incidentRoutes)
  .route('/api/chat', chatRoutes)
  .route('/api/runbooks', runbookRoutes)
  .route('/api/connections', connectionRoutes)
  .route('/api/service-maps', serviceMapRoutes)
  .route('/api/webhooks', webhookRoutes)
  .route('/api/notification-settings', notificationSettingsRoutes)
  .route('/api/kb', knowledgeBaseRoutes)
  .route('/api/tool-policies', toolPolicyRoutes)
  .route('/api/approvals', approvalRoutes)
  .route('/api', uploadRoutes)
  .route('/api', transcribeRoutes)

export type AppType = typeof apiRoutes
