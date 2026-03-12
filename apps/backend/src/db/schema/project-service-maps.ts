import { jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { projects } from './projects'

export const projectServiceMaps = pgTable('project_service_maps', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }).unique(),
  graph: jsonb('graph').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})
