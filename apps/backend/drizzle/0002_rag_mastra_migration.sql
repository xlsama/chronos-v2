-- Drop kb_chunks table (replaced by PgVector kb_embeddings index)
DROP TABLE IF EXISTS "kb_chunks";

-- Add embedding_model column to kb_documents
ALTER TABLE "kb_documents" ADD COLUMN "embedding_model" text;

-- Mark existing ready documents for reprocessing with new embedding model
UPDATE "kb_documents" SET "status" = 'pending' WHERE "status" = 'ready';
