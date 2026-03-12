import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { incidents } from './incidents'

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: text('thread_id').notNull(),
  incidentId: uuid('incident_id').references(() => incidents.id),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system'
  content: text('content'),
  toolInvocations: jsonb('tool_invocations').$type<Record<string, unknown>[]>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('messages_thread_id_idx').on(table.threadId),
])
