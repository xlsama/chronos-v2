import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { connectionTypeEnum, connectionStatusEnum, mcpStatusEnum } from './enums'
import { kbProjects } from './knowledge-base'

export const connections = pgTable('connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: connectionTypeEnum('type').notNull(),
  config: text('config').notNull(),  // AES-256-GCM encrypted JSON
  status: connectionStatusEnum('status').default('disconnected').notNull(),
  mcpStatus: mcpStatusEnum('mcp_status').default('idle').notNull(),
  mcpError: text('mcp_error'),
  lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
  kbProjectId: uuid('kb_project_id').references(() => kbProjects.id, { onDelete: 'set null' }),
  importSource: text('import_source').$type<'manual' | 'kb'>().default('manual').notNull(),
  importMetadata: jsonb('import_metadata').$type<{
    sourceDocuments: Array<{ id: string; title: string }>
    warnings: string[]
    confidence: number | null
    sourceExcerpt: string | null
    importedAt: string
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})
