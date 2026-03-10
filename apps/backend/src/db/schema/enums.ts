import { pgEnum } from 'drizzle-orm/pg-core'

export const severityEnum = pgEnum('severity', ['critical', 'high', 'medium', 'low'])
export const incidentStatusEnum = pgEnum('incident_status', ['new', 'triaging', 'in_progress', 'waiting_human', 'resolved', 'closed'])
export const processingModeEnum = pgEnum('processing_mode', ['automatic', 'semi_automatic'])
export const connectionTypeEnum = pgEnum('connection_type', ['mysql', 'postgresql', 'redis', 'grafana', 'elasticsearch', 'kubernetes', 'prometheus'])
export const connectionStatusEnum = pgEnum('connection_status', ['connected', 'disconnected', 'error'])
