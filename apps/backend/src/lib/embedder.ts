import { ofetch } from 'ofetch'
import { env } from '../env'

interface DashScopeEmbeddingResponse {
  output?: {
    embeddings?: Array<{
      embedding: number[]
      text_index: number
    }>
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error('Document processing aborted')
    error.name = 'DocumentProcessAbortedError'
    throw error
  }
}

export async function embedText(text: string): Promise<number[]> {
  const embeddings = await requestEmbeddings([text], 'query')
  return embeddings[0] ?? []
}

export async function embedTexts(texts: string[], options: { signal?: AbortSignal } = {}): Promise<number[][]> {
  if (texts.length === 0) return []

  const batchSize = env.EMBEDDING_BATCH_SIZE
  const allEmbeddings: number[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    throwIfAborted(options.signal)
    const batch = texts.slice(i, i + batchSize)
    const embeddings = await requestEmbeddings(batch, 'document')
    throwIfAborted(options.signal)
    allEmbeddings.push(...embeddings)
  }

  return allEmbeddings
}

async function requestEmbeddings(
  texts: string[],
  textType: 'query' | 'document',
): Promise<number[][]> {
  const response = await ofetch<DashScopeEmbeddingResponse>(env.EMBEDDING_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: {
      model: env.EMBEDDING_MODEL,
      input: {
        texts,
      },
      parameters: {
        text_type: textType,
        dimension: env.EMBEDDING_DIMENSIONS,
      },
    },
  })

  const items = response.output?.embeddings ?? []
  return items
    .slice()
    .sort((a, b) => a.text_index - b.text_index)
    .map((item) => item.embedding)
}
