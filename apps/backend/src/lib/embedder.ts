import { embed, embedMany } from 'ai'
import { ModelRouterEmbeddingModel } from '@mastra/core/llm'
import { env } from '../env'

export const embeddingModel = new ModelRouterEmbeddingModel({
  providerId: 'dashscope',
  modelId: env.EMBEDDING_MODEL,
  url: env.OPENAI_BASE_URL!,
  apiKey: env.OPENAI_API_KEY,
})

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error('Document processing aborted')
    error.name = 'DocumentProcessAbortedError'
    throw error
  }
}

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  })
  return embedding
}

export async function embedTexts(texts: string[], options: { signal?: AbortSignal } = {}): Promise<number[][]> {
  if (texts.length === 0) return []

  const batchSize = env.EMBEDDING_BATCH_SIZE
  const allEmbeddings: number[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    throwIfAborted(options.signal)
    const batch = texts.slice(i, i + batchSize)
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: batch,
    })
    throwIfAborted(options.signal)
    allEmbeddings.push(...embeddings)
  }

  return allEmbeddings
}
