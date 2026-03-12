import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { agentRunStatusEnum } from './enums'
import { incidents } from './incidents'
import { projects } from './projects'

export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  incidentId: uuid('incident_id').notNull().references(() => incidents.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  status: agentRunStatusEnum('status').default('queued').notNull(),
  stage: text('stage').default('queued').notNull(),
  selectedSkills: text('selected_skills').array().default([]).notNull(),
  analysis: jsonb('analysis').$type<Record<string, unknown>>(),
  context: jsonb('context').$type<Record<string, unknown>>(),
  plannedActions: jsonb('planned_actions').$type<Record<string, unknown>[]>(),
  result: text('result'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})
