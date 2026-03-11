import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core'
import { documentTypeEnum, documentStatusEnum } from './enums'

export const kbProjects = pgTable('kb_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  tags: text('tags').array().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})

export const kbDocuments = pgTable('kb_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => kbProjects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  type: documentTypeEnum('type').notNull(),
  content: text('content'),
  originalUrl: text('original_url'),
  status: documentStatusEnum('status').default('pending').notNull(),
  errorMessage: text('error_message'),
  chunkCount: integer('chunk_count').default(0).notNull(),
  embeddingModel: text('embedding_model'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})
