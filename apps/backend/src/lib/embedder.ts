import { embed, embedMany } from 'ai'
import { ModelRouterEmbeddingModel } from '@mastra/core/llm'
import { env } from '../env'

export const embeddingModel = new ModelRouterEmbeddingModel({
  providerId: 'dashscope',
  modelId: env.EMBEDDING_MODEL,
  url: env.OPENAI_BASE_URL!,
  apiKey: env.OPENAI_API_KEY,
})

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  })
  return embedding
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const batchSize = env.EMBEDDING_BATCH_SIZE
  const allEmbeddings: number[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: batch,
    })
    allEmbeddings.push(...embeddings)
  }

  return allEmbeddings
}
