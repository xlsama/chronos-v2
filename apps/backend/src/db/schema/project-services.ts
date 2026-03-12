import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { connectionStatusEnum, connectionTypeEnum } from './enums'
import { projects } from './projects'

export const projectServices = pgTable('project_services', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  type: connectionTypeEnum('type').notNull(),
  description: text('description'),
  config: text('config').notNull(),
  status: connectionStatusEnum('status').default('disconnected').notNull(),
  healthSummary: text('health_summary'),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})
