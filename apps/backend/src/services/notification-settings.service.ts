import { eq } from 'drizzle-orm'
import { db } from '../db'
import { notificationSettings } from '../db/schema'
import { decrypt, encrypt } from '../lib/crypto'

export const notificationSettingsService = {
  async getByPlatform(platform: string) {
    const [row] = await db.select().from(notificationSettings).where(eq(notificationSettings.platform, platform))
    return row ? decodeSettings(row) : null
  },

  async upsert(input: { platform: string; webhookUrl: string; signKey?: string; enabled: boolean }) {
    const [row] = await db.insert(notificationSettings).values({
      platform: input.platform,
      webhookUrl: encrypt(input.webhookUrl),
      signKey: input.signKey ? encrypt(input.signKey) : null,
      enabled: input.enabled,
    }).onConflictDoUpdate({
      target: notificationSettings.platform,
      set: {
        webhookUrl: encrypt(input.webhookUrl),
        signKey: input.signKey ? encrypt(input.signKey) : null,
        enabled: input.enabled,
      },
    }).returning()

    return decodeSettings(row)
  },
}

function decodeSettings(row: typeof notificationSettings.$inferSelect) {
  return {
    ...row,
    webhookUrl: decrypt(row.webhookUrl),
    signKey: row.signKey ? decrypt(row.signKey) : null,
  }
}
