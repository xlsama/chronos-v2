import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { severityEnum, incidentStatusEnum, processingModeEnum } from './enums'

export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  source: text('source'),
  sourceId: text('source_id'),
  severity: severityEnum('severity').default('medium').notNull(),
  status: incidentStatusEnum('status').default('new').notNull(),
  processingMode: processingModeEnum('processing_mode'),
  category: text('category'),
  threadId: text('thread_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})
