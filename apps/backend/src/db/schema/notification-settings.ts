import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const notificationSettings = pgTable('notification_settings', {
  platform: text('platform').primaryKey(),  // 'feishu'
  enabled: boolean('enabled').default(true).notNull(),
  webhookUrl: text('webhook_url').notNull(),
  signKey: text('sign_key'),  // AES-256-GCM encrypted, nullable
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})
