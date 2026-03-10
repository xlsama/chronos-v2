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

const uploadDir = path.resolve(env.UPLOAD_DIR);

const app = new Hono();

// Global middleware
app.use("*", cors({ origin: env.CORS_ORIGIN }));
app.use("*", pinoLogger({ pino: logger }));

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

// Initialize MCP
registerAllBuilders();
mcpRegistry.initialize().catch((err) => {
  logger.error(err, "Failed to initialize MCP registry");
});

// Start server
serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(`Server running on http://localhost:${info.port}`);
});

export default app;
