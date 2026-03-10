import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const topology = pgTable('topology', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  graph: jsonb('graph').notNull().$type<{ nodes: unknown[]; edges: unknown[] }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})
