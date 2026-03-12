import { desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { messages } from '../db/schema'

export const messageService = {
  async listByThread(threadId: string) {
    return db.select().from(messages).where(eq(messages.threadId, threadId)).orderBy(messages.createdAt)
  },

  async save(input: {
    threadId: string
    incidentId?: string
    role: string
    content?: string
    toolInvocations?: Record<string, unknown>[]
    metadata?: Record<string, unknown>
  }) {
    const [row] = await db.insert(messages).values(input).returning()
    return row
  },

  async getLatestByThread(threadId: string, limit = 20) {
    return db.select().from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .then((rows) => rows.reverse())
  },
}
