import { pgEnum } from 'drizzle-orm/pg-core'

export const incidentStatusEnum = pgEnum('incident_status', ['new', 'triaging', 'in_progress', 'waiting_human', 'resolved', 'closed'])
export const processingModeEnum = pgEnum('processing_mode', ['automatic', 'semi_automatic'])
export const connectionTypeEnum = pgEnum('connection_type', [
  'mysql', 'postgresql', 'redis', 'mongodb', 'clickhouse',
  'elasticsearch', 'kafka', 'rabbitmq',
  'kubernetes', 'docker', 'argocd',
  'grafana', 'prometheus', 'sentry', 'jenkins',
  'datadog', 'pagerduty', 'opsgenie', 'apisix', 'kong', 'airflow', 'loki', 'ssh',
])
export const connectionStatusEnum = pgEnum('connection_status', ['connected', 'disconnected', 'error'])
export const mcpStatusEnum = pgEnum('mcp_status', ['idle', 'registering', 'registered', 'error'])

export const documentTypeEnum = pgEnum('document_type', ['markdown', 'pdf', 'xlsx', 'csv', 'docx'])
export const documentStatusEnum = pgEnum('document_status', ['pending', 'processing', 'ready', 'error'])

export const riskLevelEnum = pgEnum('risk_level', ['none', 'low', 'medium', 'high'])
export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'declined', 'expired'])
