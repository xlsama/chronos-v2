import { PgVector } from "@mastra/pg";
import { env } from "../env";
import { logger } from "../lib/logger";

export const pgVector = new PgVector({
  id: "kb-vector",
  connectionString: env.DATABASE_URL,
});

type VectorDeleteParams = {
  indexName: string;
  filter: Record<string, unknown>;
};

export async function deleteVectorsIfIndexExists(params: VectorDeleteParams) {
  try {
    await pgVector.deleteVectors(params as Parameters<typeof pgVector.deleteVectors>[0]);
  } catch (error) {
    if (isMissingRelationError(error, params.indexName)) {
      logger.warn(
        { err: error, ...params },
        "Vector index relation missing, skipping deleteVectors cleanup",
      );
      return;
    }

    throw error;
  }
}

export async function initVectorStore() {
  await pgVector.createIndex({
    indexName: "kb_embeddings",
    dimension: env.EMBEDDING_DIMENSIONS,
    metric: "cosine",
    indexConfig: {
      type: "hnsw",
      hnsw: { m: 16, efConstruction: 64 },
    },
  });

  await pgVector.createIndex({
    indexName: "document_embeddings",
    dimension: env.EMBEDDING_DIMENSIONS,
    metric: "cosine",
    indexConfig: {
      type: "hnsw",
      hnsw: { m: 16, efConstruction: 64 },
    },
  });
}

function isMissingRelationError(error: unknown, relationName: string) {
  const candidates = collectErrorCandidates(error);

  return candidates.some((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;

    const code = "code" in candidate ? candidate.code : undefined;
    const message = "message" in candidate ? candidate.message : undefined;
    const details = "details" in candidate ? candidate.details : undefined;
    const indexName =
      details && typeof details === "object" && "indexName" in details
        ? details.indexName
        : undefined;

    return (
      code === "42P01" ||
      (typeof indexName === "string" && indexName === relationName) ||
      (typeof message === "string" &&
        message.includes("does not exist") &&
        message.includes(relationName))
    );
  });
}

function collectErrorCandidates(error: unknown) {
  const candidates: unknown[] = [];
  let current: unknown = error;

  while (current && typeof current === "object" && !candidates.includes(current)) {
    candidates.push(current);
    current = "cause" in current ? current.cause : undefined;
  }

  return candidates;
}
