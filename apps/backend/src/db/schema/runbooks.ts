import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { incidents } from './incidents'

export const runbooks = pgTable('runbooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  incidentId: uuid('incident_id').references(() => incidents.id, { onDelete: 'set null' }),
  tags: text('tags').array().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})
