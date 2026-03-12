import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { incidentSourceEnum, incidentStatusEnum, processingModeEnum } from './enums'
import { projects } from './projects'

export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  summary: text('summary'),
  attachments: jsonb('attachments').$type<{ type: 'image' | 'file'; url: string; name: string; mimeType: string }[]>(),
  source: incidentSourceEnum('source').default('manual').notNull(),
  status: incidentStatusEnum('status').default('new').notNull(),
  processingMode: processingModeEnum('processing_mode'),
  threadId: text('thread_id'),
  analysis: jsonb('analysis').$type<Record<string, unknown>>(),
  selectedSkills: text('selected_skills').array().default([]).notNull(),
  finalSummaryDraft: text('final_summary_draft'),
  resolutionNotes: text('resolution_notes'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})
