import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { connectionTypeEnum, connectionStatusEnum, mcpStatusEnum } from './enums'

export const connections = pgTable('connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: connectionTypeEnum('type').notNull(),
  config: text('config').notNull(),  // AES-256-GCM encrypted JSON
  status: connectionStatusEnum('status').default('disconnected').notNull(),
  mcpStatus: mcpStatusEnum('mcp_status').default('idle').notNull(),
  mcpError: text('mcp_error'),
  lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})
