import { ofetch } from 'ofetch'
import { env } from '../env'
import { logger } from './logger'

interface RerankResult {
  index: number
  relevanceScore: number
}

export async function rerank(
  query: string,
  documents: string[],
  options?: { topN?: number },
): Promise<RerankResult[]> {
  if (documents.length === 0) return []

  try {
    const res = await ofetch(`${env.OPENAI_BASE_URL}/rerank`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: {
        model: env.RERANK_MODEL,
        query,
        documents,
        top_n: options?.topN ?? env.RERANK_TOP_N,
      },
    })
    return res.results.map((r: any) => ({
      index: r.index,
      relevanceScore: r.relevance_score,
    }))
  } catch (err) {
    logger.warn({ err }, 'Rerank failed, falling back to original order')
    const topN = options?.topN ?? env.RERANK_TOP_N
    return documents.slice(0, topN).map((_, i) => ({ index: i, relevanceScore: 1 }))
  }
}
