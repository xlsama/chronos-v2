import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { incidents } from './incidents'

export const toolApprovals = pgTable('tool_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: text('thread_id').notNull(),
  incidentId: uuid('incident_id').references(() => incidents.id),
  toolName: text('tool_name').notNull(),
  toolArgs: jsonb('tool_args').$type<Record<string, unknown>>(),
  riskLevel: text('risk_level').notNull(),
  reason: text('reason'),
  status: text('status').notNull().default('pending'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
