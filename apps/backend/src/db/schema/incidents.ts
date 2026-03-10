import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { incidentStatusEnum, processingModeEnum } from './enums'

export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  summary: text('summary'),
  attachments: jsonb('attachments').$type<{ type: 'image' | 'file'; url: string; name: string; mimeType: string }[]>(),
  source: text('source'),
  status: incidentStatusEnum('status').default('new').notNull(),
  processingMode: processingModeEnum('processing_mode'),
  threadId: text('thread_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})
