import { ofetch } from 'ofetch'
import { env } from '../env'
import { logger } from './logger'

interface RerankResult {
  index: number
  relevanceScore: number
}

interface DashScopeRerankResponse {
  output?: {
    results?: Array<{
      index: number
      relevance_score: number
    }>
  }
  request_id?: string
}

export async function rerank(
  query: string,
  documents: string[],
  options?: { topN?: number },
): Promise<RerankResult[]> {
  if (documents.length === 0) return []
  const topN = options?.topN ?? env.RERANK_TOP_N

  try {
    const res = await ofetch<DashScopeRerankResponse>(env.RERANK_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: {
        model: env.RERANK_MODEL,
        input: {
          query,
          documents,
        },
        parameters: {
          top_n: topN,
          return_documents: false,
        },
      },
    })

    const results = res.output?.results ?? []
    return results.map((r) => ({
      index: r.index,
      relevanceScore: r.relevance_score,
    }))
  } catch (err) {
    logger.warn(
      {
        err,
        url: env.RERANK_API_URL,
        status: extractStatus(err),
        requestId: extractRequestId(err),
      },
      'Rerank failed, falling back to original order'
    )
    return documents.slice(0, topN).map((_, i) => ({ index: i, relevanceScore: 1 }))
  }
}

function extractStatus(err: unknown): number | null {
  const response = extractResponse(err)
  return typeof response?.status === 'number' ? response.status : null
}

function extractRequestId(err: unknown): string | null {
  const response = extractResponse(err)
  const data = response?._data as { request_id?: string } | undefined
  return typeof data?.request_id === 'string' ? data.request_id : null
}

function extractResponse(err: unknown): { status?: number; _data?: unknown } | null {
  if (!err || typeof err !== 'object' || !('response' in err)) return null
  const response = (err as { response?: { status?: number; _data?: unknown } }).response
  return response ?? null
}
