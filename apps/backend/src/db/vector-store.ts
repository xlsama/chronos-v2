import { PgVector } from '@mastra/pg'
import { env } from '../env'

export const pgVector = new PgVector({
  id: 'kb-vector',
  connectionString: env.DATABASE_URL,
})

export async function initVectorStore() {
  await pgVector.createIndex({
    indexName: 'kb_embeddings',
    dimension: env.EMBEDDING_DIMENSIONS,
    metric: 'cosine',
    indexConfig: {
      type: 'hnsw',
      hnsw: { m: 16, efConstruction: 64 },
    },
  })
}
