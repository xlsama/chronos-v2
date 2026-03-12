import { pgTable, text, boolean, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core'
import { riskLevelEnum, approvalStatusEnum } from './enums'
import { incidents } from './incidents'

export const toolPolicies = pgTable('tool_policies', {
  id: text('id').primaryKey().default('global'),
  approvalThreshold: riskLevelEnum('approval_threshold').default('medium').notNull(),
  allowDatabaseWrite: boolean('allow_database_write').default(true).notNull(),
  allowDatabaseDDL: boolean('allow_database_ddl').default(false).notNull(),
  allowK8sMutations: boolean('allow_k8s_mutations').default(true).notNull(),
  allowSSH: boolean('allow_ssh').default(false).notNull(),
  allowCICDTrigger: boolean('allow_cicd_trigger').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})

export const toolApprovals = pgTable('tool_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: text('thread_id').notNull(),
  incidentId: uuid('incident_id').references(() => incidents.id),
  runId: text('run_id'),
  toolKey: text('tool_key').notNull(),
  toolName: text('tool_name').notNull(),
  connectionName: text('connection_name'),
  connectionType: text('connection_type'),
  riskLevel: riskLevelEnum('risk_level').notNull(),
  input: jsonb('input').notNull().$type<Record<string, unknown>>(),
  description: text('description'),
  status: approvalStatusEnum('status').default('pending').notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  declineReason: text('decline_reason'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
