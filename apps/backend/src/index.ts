import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { pinoLogger } from 'hono-pino'
import { env } from './env'
import { logger } from './lib/logger'
import { handleError } from './lib/errors'
import { apiRoutes } from './routes/index'
import { registerAllFactories } from './mcp'
import { mcpRegistry } from './mcp/registry'

const app = new Hono()

// Global middleware
app.use('*', cors({ origin: env.CORS_ORIGIN }))
app.use('*', pinoLogger({ pino: logger }))

// API routes
app.route('/', apiRoutes)

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

// Error handler
app.onError(handleError)

// Initialize MCP
registerAllFactories()
mcpRegistry.initialize().catch((err) => {
  logger.error(err, 'Failed to initialize MCP registry')
})

// Start server
serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(`Server running on http://localhost:${info.port}`)
})

export default app
