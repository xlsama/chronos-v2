import { and, eq, gte } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db'
import { projectDocuments, projects } from '../db/schema'
import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { env } from '../env'
import { projectDocumentService } from '../services/project-document.service'

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: env.OPENAI_BASE_URL,
})

export const jobRoutes = new Hono()
  .post('/runbook-digest', async (c) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const histories = await db.select().from(projectDocuments).where(and(
      eq(projectDocuments.kind, 'incident_history'),
      gte(projectDocuments.createdAt, today),
    ))

    const grouped = new Map<string, typeof histories>()
    for (const history of histories) {
      const bucket = grouped.get(history.projectId) ?? []
      bucket.push(history)
      grouped.set(history.projectId, bucket)
    }

    const created = []
    for (const [projectId, items] of grouped) {
      const project = await db.select().from(projects).where(eq(projects.id, projectId)).then((rows) => rows[0])
      if (!project || items.length === 0) continue

      const { text } = await generateText({
        model: openai.chat(env.OPENAI_MODEL_MINI),
        system: '你是 runbook 学习 Agent。根据同一天的 incident history，总结出一个草稿 runbook，输出中文 Markdown。',
        prompt: items.map((item) => `# ${item.title}\n\n${item.content ?? ''}`).join('\n\n---\n\n'),
        maxOutputTokens: 1400,
      })

      const document = await projectDocumentService.createMarkdownDocument({
        projectId,
        kind: 'runbook',
        title: `${project.name}-${today.toISOString().slice(0, 10)}-daily-digest`,
        content: text,
        publicationStatus: 'draft',
        source: 'job',
        createdBy: 'job',
        metadata: {
          digestDate: today.toISOString().slice(0, 10),
          incidentHistoryIds: items.map((item) => item.id),
        },
      })
      created.push(document)
    }

    return c.json({ data: created })
  })
