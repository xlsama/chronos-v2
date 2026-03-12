import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { pinoLogger } from "hono-pino";
import fs from "node:fs";
import path from "node:path";
import { env } from "./env";
import { logger } from "./lib/logger";
import { handleError } from "./lib/errors";
import { apiRoutes } from "./routes/index";
import { initVectorStore } from "./db/vector-store";
import { ensureDataRootsSync } from "./lib/file-storage";

const uploadDir = path.resolve(env.UPLOAD_DIR);
const dataDir = path.resolve(env.DATA_DIR);

// Create runtime storage roots before registering static handlers.
fs.mkdirSync(uploadDir, { recursive: true });
ensureDataRootsSync();

const reqStartTimes = new WeakMap<object, number>();

const app = new Hono();

// Global middleware
app.use("*", cors({ origin: env.CORS_ORIGIN }));
app.use(
  "*",
  pinoLogger({
    pino: logger,
    http:
      env.NODE_ENV === "development"
        ? {
            reqId: () => undefined as unknown as string,
            onReqMessage: false,
            onReqBindings: (c) => {
              reqStartTimes.set(c.req.raw, performance.now());
              return {};
            },
            onResBindings: () => ({}),
            onResMessage: (c) => {
              const start = reqStartTimes.get(c.req.raw);
              const ms = start ? Math.round(performance.now() - start) : 0;
              reqStartTimes.delete(c.req.raw);
              return `${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`;
            },
            onResLevel: (c) => {
              if (c.res.status >= 500) return "error";
              if (c.res.status >= 400) return "warn";
              return "info";
            },
          }
        : undefined,
  }),
);

// Static file serving for uploads
app.use(
  "/uploads/*",
  serveStatic({ root: uploadDir, rewriteRequestPath: (p) => p.replace("/uploads", "") }),
);
app.use(
  "/files/*",
  serveStatic({ root: dataDir, rewriteRequestPath: (p) => p.replace("/files", "") }),
);

// API routes
app.route("/", apiRoutes);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Error handler
app.onError(handleError);

// Initialize PgVector index
initVectorStore().catch((err) => {
  logger.error(err, "Failed to initialize vector store");
});

// Start server
serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(`Server running on http://localhost:${info.port}`);
});

export default app;
