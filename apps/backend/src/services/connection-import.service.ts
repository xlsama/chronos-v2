import { generateText, Output } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod/v4'
import { db } from '../db/index'
import { connections } from '../db/schema'
import { env } from '../env'
import { logger } from '../lib/logger'
import { kbService } from './knowledge-base.service'
import { connectionService } from './connection.service'

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: env.OPENAI_BASE_URL,
})

const MAX_DOC_CHARS = 12_000
const MAX_TOTAL_CHARS = 48_000

const supportedConfigKeys = {
  mysql: ['host', 'port', 'database', 'username', 'password'],
  postgresql: ['host', 'port', 'database', 'username', 'password'],
  redis: ['host', 'port', 'password', 'db'],
  mongodb: ['host', 'port', 'database', 'username', 'password'],
  clickhouse: ['host', 'port', 'database', 'username', 'password'],
  elasticsearch: ['url', 'apiKey', 'username', 'password'],
  kafka: ['brokers', 'username', 'password', 'mechanism'],
  rabbitmq: ['host', 'port', 'vhost', 'username', 'password'],
  kubernetes: ['kubeconfig'],
  docker: ['socketPath'],
  argocd: ['url', 'authToken'],
  grafana: ['url', 'apiKey'],
  prometheus: ['url'],
  sentry: ['authToken'],
  jenkins: ['url', 'username', 'apiToken'],
} as const

const previewExtractionSchema = z.object({
  warnings: z.array(z.string()).default([]),
  imports: z.array(z.object({
    name: z.string().min(1),
    type: z.enum([
      'mysql', 'postgresql', 'redis', 'mongodb', 'clickhouse',
      'elasticsearch', 'kafka', 'rabbitmq',
      'kubernetes', 'docker', 'argocd',
      'grafana', 'prometheus', 'sentry', 'jenkins',
    ]),
    config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
    sourceDocumentIds: z.array(z.string()).default([]),
    sourceExcerpt: z.string().nullable().optional(),
    warnings: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1).nullable().optional(),
  })).default([]),
})

export const connectionImportCandidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum([
    'mysql', 'postgresql', 'redis', 'mongodb', 'clickhouse',
    'elasticsearch', 'kafka', 'rabbitmq',
    'kubernetes', 'docker', 'argocd',
    'grafana', 'prometheus', 'sentry', 'jenkins',
  ]),
  config: z.record(z.string(), z.string()),
  missingFields: z.array(z.string()),
  warnings: z.array(z.string()),
  confidence: z.number().min(0).max(1).nullable(),
  sourceDocuments: z.array(z.object({
    id: z.string(),
    title: z.string(),
  })),
  sourceExcerpt: z.string().nullable(),
  hasAllRequiredFields: z.boolean(),
  duplicateConnectionIds: z.array(z.string()),
  duplicateConnectionNames: z.array(z.string()),
})

type ConnectionType = keyof typeof supportedConfigKeys
type PreviewCandidate = z.infer<typeof connectionImportCandidateSchema>

function uniqueStrings(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}

function clampConfidence(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null
  return Math.max(0, Math.min(1, value))
}

function normalizeConfigValue(value: string | number | boolean) {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value).trim()
}

function getMissingFields(type: ConnectionType, config: Record<string, string>) {
  switch (type) {
    case 'redis':
      return ['host', 'port', 'password'].filter((key) => !config[key])
    case 'elasticsearch': {
      const missing = config.url ? [] : ['url']
      if (!config.apiKey && !(config.username && config.password)) {
        missing.push('apiKey')
      }
      return missing
    }
    case 'kafka': {
      const missing = config.brokers ? [] : ['brokers']
      if ((config.username && !config.password) || (!config.username && config.password)) {
        missing.push(config.username ? 'password' : 'username')
      }
      return missing
    }
    case 'rabbitmq':
      return ['host', 'port', 'username', 'password'].filter((key) => !config[key])
    default:
      return supportedConfigKeys[type].filter((key) => !config[key])
  }
}

function buildSupportedKeysPrompt() {
  return Object.entries(supportedConfigKeys)
    .map(([type, keys]) => `- ${type}: ${keys.join(', ')}`)
    .join('\n')
}

async function getProjectDocuments(projectId: string) {
  const [project, documents, existingConnections] = await Promise.all([
    kbService.getProjectById(projectId),
    kbService.listDocuments(projectId),
    db.select({
      id: connections.id,
      name: connections.name,
      type: connections.type,
    }).from(connections),
  ])

  if (!project) return null

  const readyDocuments = documents.filter((document) => (
    document.status === 'ready' && typeof document.content === 'string' && document.content.trim()
  ))

  return { project, documents, readyDocuments, existingConnections }
}

function buildPrompt(documents: Array<{ id: string; title: string; content: string }>) {
  return documents.map((document) => [
    `[[DOC_ID:${document.id}]]`,
    `[[DOC_TITLE:${document.title}]]`,
    document.content,
  ].join('\n')).join('\n\n---\n\n')
}

function normalizePreviewCandidate(
  raw: z.infer<typeof previewExtractionSchema>['imports'][number],
  documentsById: Map<string, { id: string; title: string }>,
  existingConnections: Array<{ id: string; name: string; type: string }>,
): PreviewCandidate {
  const type = raw.type as ConnectionType
  const allowedKeys = new Set<string>(supportedConfigKeys[type])
  const config = Object.fromEntries(
    Object.entries(raw.config)
      .map(([key, value]) => [key, normalizeConfigValue(value)] as const)
      .filter(([key, value]) => allowedKeys.has(key) && value !== ''),
  )

  const sourceDocuments = uniqueStrings(raw.sourceDocumentIds)
    .map((documentId) => documentsById.get(documentId))
    .filter((document): document is { id: string; title: string } => Boolean(document))

  const duplicates = existingConnections.filter((connection) => (
    connection.type === type && connection.name.trim().toLowerCase() === raw.name.trim().toLowerCase()
  ))

  const warnings = uniqueStrings([
    ...raw.warnings,
    ...(duplicates.length > 0 ? ['已存在同名同类型连接，建议导入后人工复核'] : []),
  ])

  const missingFields = uniqueStrings(getMissingFields(type, config))

  return {
    id: crypto.randomUUID(),
    name: raw.name.trim(),
    type,
    config,
    missingFields,
    warnings,
    confidence: clampConfidence(raw.confidence),
    sourceDocuments,
    sourceExcerpt: raw.sourceExcerpt?.trim() || null,
    hasAllRequiredFields: missingFields.length === 0,
    duplicateConnectionIds: duplicates.map((connection) => connection.id),
    duplicateConnectionNames: duplicates.map((connection) => connection.name),
  }
}

export const connectionImportService = {
  async preview(projectId: string) {
    const projectData = await getProjectDocuments(projectId)
    if (!projectData) return null

    const { project, documents, readyDocuments, existingConnections } = projectData
    const warnings: string[] = []

    if (readyDocuments.length === 0) {
      return {
        kbProjectId: project.id,
        projectName: project.name,
        totalDocumentCount: documents.length,
        readyDocumentCount: 0,
        warnings: ['当前知识库项目没有可分析的已处理文档'],
        imports: [],
      }
    }

    let totalChars = 0
    const documentsForPrompt: Array<{ id: string; title: string; content: string }> = []
    for (const document of readyDocuments) {
      const content = (document.content ?? '').trim()
      if (!content) continue

      if (totalChars >= MAX_TOTAL_CHARS) {
        warnings.push('知识库内容较大，分析时仅使用了部分文档内容')
        break
      }

      const remaining = MAX_TOTAL_CHARS - totalChars
      const truncated = content.slice(0, Math.min(MAX_DOC_CHARS, remaining))
      if (truncated.length < content.length) {
        warnings.push(`文档《${document.title}》内容过长，分析时已截断`)
      }

      documentsForPrompt.push({
        id: document.id,
        title: document.title,
        content: truncated,
      })
      totalChars += truncated.length
    }

    const documentsById = new Map(documentsForPrompt.map((document) => [document.id, {
      id: document.id,
      title: document.title,
    }]))

    const prompt = buildPrompt(documentsForPrompt)

    logger.info({
      projectId,
      readyDocumentCount: readyDocuments.length,
      promptDocumentCount: documentsForPrompt.length,
      totalChars,
      model: env.OPENAI_MODEL_MINI,
    }, 'Previewing connection import from knowledge base')

    const { output } = await generateText({
      model: openai.chat(env.OPENAI_MODEL_MINI),
      system: [
        '你是 Chronos 的连接导入分析器。',
        '你的任务是从知识库文档中提取可以直接创建的连接配置候选。',
        '只返回 Chronos 当前支持的连接类型，并且 config 字段只允许使用对应类型支持的 key。',
        '不要猜测或臆造信息；不确定的字段留空，并放到 warnings 里。',
        'sourceDocumentIds 只能引用输入中出现的 DOC_ID。',
        '如果知识库中描述了多个环境或多个服务，请拆分成多条 imports。',
        '支持的类型与字段如下：',
        buildSupportedKeysPrompt(),
      ].join('\n'),
      prompt,
      output: Output.object({
        schema: previewExtractionSchema,
      }),
      maxOutputTokens: 4_000,
    })

    const imports = output.imports
      .map((item) => normalizePreviewCandidate(item, documentsById, existingConnections))
      .filter((candidate) => candidate.name !== '')

    const dedupedImports = Object.values(Object.fromEntries(
      imports.map((candidate) => [`${candidate.type}:${candidate.name.toLowerCase()}`, candidate]),
    ))

    const mergedWarnings = uniqueStrings([
      ...warnings,
      ...output.warnings,
      ...(dedupedImports.length === 0 ? ['未在知识库中识别到可导入的服务连接'] : []),
    ])

    return {
      kbProjectId: project.id,
      projectName: project.name,
      totalDocumentCount: documents.length,
      readyDocumentCount: readyDocuments.length,
      warnings: mergedWarnings,
      imports: dedupedImports,
    }
  },

  async commit(projectId: string, imports: PreviewCandidate[], selectedIds: string[]) {
    const project = await kbService.getProjectById(projectId)
    if (!project) return null

    const selected = new Set(selectedIds)
    const created: Awaited<ReturnType<typeof connectionService.create>>[] = []
    const failed: Array<{ candidateId: string; name: string; reason: string }> = []
    const skipped: Array<{ candidateId: string; name: string; reason: string }> = []

    for (const candidate of imports) {
      if (!selected.has(candidate.id)) {
        skipped.push({
          candidateId: candidate.id,
          name: candidate.name,
          reason: '未选择导入',
        })
        continue
      }

      try {
        const createdConnection = await connectionService.create({
          name: candidate.name,
          type: candidate.type,
          config: candidate.config,
          kbProjectId: projectId,
          importSource: 'kb',
          importMetadata: {
            sourceDocuments: candidate.sourceDocuments,
            warnings: candidate.warnings,
            confidence: candidate.confidence,
            sourceExcerpt: candidate.sourceExcerpt,
            importedAt: new Date().toISOString(),
          },
        })
        created.push(createdConnection)
      } catch (error) {
        const reason = error instanceof Error ? error.message : '导入失败'
        failed.push({
          candidateId: candidate.id,
          name: candidate.name,
          reason,
        })
      }
    }

    return { created, failed, skipped }
  },
}
