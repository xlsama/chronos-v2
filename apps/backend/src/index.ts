import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { pinoLogger } from "hono-pino";
import path from "node:path";
import { env } from "./env";
import { logger } from "./lib/logger";
import { handleError } from "./lib/errors";
import { apiRoutes } from "./routes/index";
import { registerAllBuilders } from "./mcp";
import { mcpRegistry } from "./mcp/registry";
import { connectionService } from "./services/connection.service";
import { initVectorStore } from "./db/vector-store";

const uploadDir = path.resolve(env.UPLOAD_DIR);

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

// Initialize MCP
registerAllBuilders();
mcpRegistry.initialize((id, status, error) => {
  connectionService.updateMcpStatus(id, status, error).catch((err) => {
    logger.error({ err, connectionId: id }, "Failed to update MCP status");
  });
}).catch((err) => {
  logger.error(err, "Failed to initialize MCP registry");
});

// Start server
serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(`Server running on http://localhost:${info.port}`);
});

export default app;
