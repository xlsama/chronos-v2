import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { agentRuns } from './agent-runs'
import { approvalModeEnum, approvalStatusEnum, riskLevelEnum } from './enums'
import { incidents } from './incidents'
import { projects } from './projects'
import { projectServices } from './project-services'

export const workflowApprovals = pgTable('workflow_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentRunId: uuid('agent_run_id').notNull().references(() => agentRuns.id, { onDelete: 'cascade' }),
  incidentId: uuid('incident_id').notNull().references(() => incidents.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  skillSlug: text('skill_slug').notNull(),
  toolKey: text('tool_key').notNull(),
  toolName: text('tool_name').notNull(),
  serviceId: uuid('service_id').references(() => projectServices.id, { onDelete: 'set null' }),
  serviceName: text('service_name'),
  riskLevel: riskLevelEnum('risk_level').notNull(),
  approvalMode: approvalModeEnum('approval_mode').default('manual').notNull(),
  input: jsonb('input').$type<Record<string, unknown>>().default({}).notNull(),
  description: text('description'),
  status: approvalStatusEnum('status').default('pending').notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  declineReason: text('decline_reason'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
