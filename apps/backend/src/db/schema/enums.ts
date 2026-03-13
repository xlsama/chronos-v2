import { pgEnum } from 'drizzle-orm/pg-core'

export const incidentStatusEnum = pgEnum('incident_status', ['new', 'triaging', 'in_progress', 'waiting_human', 'resolved', 'closed'])
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
export const documentStatusEnum = pgEnum('document_status', ['pending', 'processing', 'ready', 'error', 'cancelling', 'cancelled'])

export const documentKindEnum = pgEnum('document_kind', ['knowledge', 'runbook', 'incident_history'])
export const documentSourceEnum = pgEnum('document_source', ['upload', 'markdown', 'agent', 'job'])
export const publicationStatusEnum = pgEnum('publication_status', ['active', 'draft', 'published', 'archived'])
export const incidentSourceEnum = pgEnum('incident_source', ['manual', 'webhook'])
