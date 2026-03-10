import { eq } from 'drizzle-orm'
import { db } from '../db/index'
import { notificationSettings } from '../db/schema/index'
import { encrypt, decrypt } from '../lib/crypto'

const MASK = '••••••••'

export type UpsertNotificationSettingsInput = {
  webhookUrl: string
  signKey?: string
  enabled?: boolean
}

export const notificationSettingsService = {
  async get(platform: string) {
    const [row] = await db.select().from(notificationSettings).where(eq(notificationSettings.platform, platform))
    if (!row) return null
    return { ...row, signKey: row.signKey ? MASK : '' }
  },

  async getRaw(platform: string) {
    const [row] = await db.select().from(notificationSettings).where(eq(notificationSettings.platform, platform))
    if (!row) return null
    return { ...row, signKey: row.signKey ? decrypt(row.signKey) : null }
  },

  async upsert(platform: string, input: UpsertNotificationSettingsInput) {
    // Determine signKey value
    let signKeyValue: string | null | undefined
    if (input.signKey === MASK) {
      // Masked value → don't update signKey
      signKeyValue = undefined
    } else if (!input.signKey) {
      // Empty or undefined → remove signKey
      signKeyValue = null
    } else {
      // New value → encrypt
      signKeyValue = encrypt(input.signKey)
    }

    const [existing] = await db.select().from(notificationSettings).where(eq(notificationSettings.platform, platform))

    if (existing) {
      const updateData: Record<string, unknown> = {
        webhookUrl: input.webhookUrl,
        enabled: input.enabled ?? true,
      }
      if (signKeyValue !== undefined) {
        updateData.signKey = signKeyValue
      }
      const [row] = await db.update(notificationSettings).set(updateData).where(eq(notificationSettings.platform, platform)).returning()
      return { ...row, signKey: row.signKey ? MASK : '' }
    }

    const [row] = await db.insert(notificationSettings).values({
      platform,
      webhookUrl: input.webhookUrl,
      enabled: input.enabled ?? true,
      signKey: signKeyValue === undefined ? null : signKeyValue,
    }).returning()
    return { ...row, signKey: row.signKey ? MASK : '' }
  },

  async delete(platform: string) {
    const [row] = await db.delete(notificationSettings).where(eq(notificationSettings.platform, platform)).returning()
    return row ?? null
  },
}
