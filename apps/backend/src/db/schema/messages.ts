import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { incidents } from './incidents'

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: text('thread_id').notNull(),
  incidentId: uuid('incident_id').references(() => incidents.id),
  role: text('role').notNull(),
  content: text('content'),
  toolInvocations: jsonb('tool_invocations'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('messages_thread_id_idx').on(table.threadId),
])
