import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { documentKindEnum, documentSourceEnum, documentStatusEnum, publicationStatusEnum } from './enums'
import { projects } from './projects'

export const projectDocuments = pgTable('project_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  kind: documentKindEnum('kind').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  tags: text('tags').array().default([]).notNull(),
  content: text('content'),
  filePath: text('file_path').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type'),
  extension: text('extension'),
  source: documentSourceEnum('source').default('upload').notNull(),
  status: documentStatusEnum('status').default('pending').notNull(),
  publicationStatus: publicationStatusEnum('publication_status').default('active').notNull(),
  chunkCount: integer('chunk_count').default(0).notNull(),
  embeddingModel: text('embedding_model'),
  parserError: text('parser_error'),
  createdBy: text('created_by'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})
