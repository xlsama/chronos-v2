import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const notificationSettings = pgTable('notification_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: text('platform').notNull().unique(),
  webhookUrl: text('webhook_url').notNull(),
  signKey: text('sign_key'),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})
