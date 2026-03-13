import "dotenv/config";
import { z } from "zod/v4";

const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "Must be 64 hex characters for AES-256"),
  OPENAI_API_KEY: z.string(),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_MODEL: z.string().default("qwen3.5-plus"),
  OPENAI_MODEL_MINI: z.string().default("qwen3.5-flash"),
  OPENAI_ASR_MODEL: z.string().default("qwen3-asr-flash"),
  EMBEDDING_API_URL: z.string().url().default("https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding"),
  EMBEDDING_MODEL: z.string().default("text-embedding-v4"),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1024),
  EMBEDDING_BATCH_SIZE: z.coerce.number().default(10),
  RERANK_API_URL: z.string().url().default("https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank"),
  RERANK_MODEL: z.string().default("qwen3-rerank"),
  RERANK_TOP_N: z.coerce.number().default(5),
  LOG_LEVEL: z.string().default("info"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("*"),
  UPLOAD_DIR: z.string().default("./uploads"),
  DATA_DIR: z.string().default("./data"),
  SKILLS_DIR: z.string().default("./data/skills"),
});

export const env = envSchema.parse(process.env);
