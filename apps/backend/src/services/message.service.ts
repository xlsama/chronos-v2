import { eq, asc } from 'drizzle-orm'
import { db } from '../db/index'
import { messages } from '../db/schema/index'

export type CreateMessageInput = {
  threadId: string
  incidentId?: string
  role: string
  content?: string
  toolInvocations?: unknown
  metadata?: Record<string, unknown>
}

export const messageService = {
  async listByThreadId(threadId: string) {
    return db
      .select()
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(asc(messages.createdAt))
  },

  async create(input: CreateMessageInput) {
    const [row] = await db.insert(messages).values(input).returning()
    return row
  },

  async createMany(inputs: CreateMessageInput[]) {
    if (inputs.length === 0) return []
    return db.insert(messages).values(inputs).returning()
  },
}
