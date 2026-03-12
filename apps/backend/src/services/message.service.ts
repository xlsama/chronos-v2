import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { messages } from "../db/schema";

const messageRoleOrder = sql<number>`case
  when ${messages.role} = 'user' then 0
  when ${messages.role} = 'assistant' then 1
  else 2
end`;

export const messageService = {
  async listByThread(threadId: string) {
    return db
      .select()
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(asc(messages.createdAt), asc(messageRoleOrder), asc(messages.id));
  },

  async save(input: {
    threadId: string;
    incidentId?: string;
    role: string;
    content?: string;
    toolInvocations?: Record<string, unknown>[];
    metadata?: Record<string, unknown>;
  }) {
    const [row] = await db.insert(messages).values(input).returning();
    return row;
  },

  async getLatestByThread(threadId: string, limit = 20) {
    return db
      .select()
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(desc(messages.createdAt), desc(messageRoleOrder), desc(messages.id))
      .limit(limit)
      .then((rows) => rows.reverse());
  },
};
