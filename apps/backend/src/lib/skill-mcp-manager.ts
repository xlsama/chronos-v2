import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { skillCatalogService } from '../services/skill-catalog.service'
import { projectServiceCatalog } from '../services/project-service-catalog.service'
import { logger } from './logger'

interface ActiveMcp {
  client: Client
  transport: StdioClientTransport
  tools: string[]
  serverType: string
}

interface SpawnConfig {
  command: string
  args: string[]
  env: Record<string, string>
}

const activeMcps = new Map<string, ActiveMcp>()

// ── Spawn Config Registry ──────────────────────────────────────────

type SpawnConfigBuilder = (config: Record<string, unknown>) => SpawnConfig

const spawnRegistry: Record<string, SpawnConfigBuilder> = {
  // ── Databases ──────────────────────────────────────────────────
  mysql: (config) => ({
    command: 'npx',
    args: ['-y', '@benborla29/mcp-server-mysql'],
    env: {
      MYSQL_HOST: String(config.host ?? 'localhost'),
      MYSQL_PORT: String(config.port ?? 3306),
      MYSQL_USER: String(config.user ?? config.username ?? ''),
      MYSQL_PASS: String(config.password ?? ''),
      MYSQL_DB: String(config.database ?? ''),
      MYSQL_PASSWORD: String(config.password ?? ''),
      MYSQL_DATABASE: String(config.database ?? ''),
    },
  }),

  postgresql: (config) => {
    const host = String(config.host ?? 'localhost')
    const port = String(config.port ?? 5432)
    const user = String(config.user ?? config.username ?? '')
    const password = String(config.password ?? '')
    const database = String(config.database ?? '')
    const url = `postgresql://${user}:${password}@${host}:${port}/${database}`
    return {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', url],
      env: {},
    }
  },

  mongodb: (config) => {
    const host = String(config.host ?? 'localhost')
    const port = String(config.port ?? 27017)
    const user = config.user ?? config.username
    const password = config.password
    const database = config.database ?? ''
    let connectionString: string
    if (config.connectionString) {
      connectionString = String(config.connectionString)
    } else if (user && password) {
      connectionString = `mongodb://${user}:${password}@${host}:${port}/${database}`
    } else {
      connectionString = `mongodb://${host}:${port}/${database}`
    }
    return {
      command: 'npx',
      args: ['-y', 'mongodb-mcp-server', '--connectionString', connectionString],
      env: {},
    }
  },

  clickhouse: (config) => ({
    command: 'uvx',
    args: ['@clickhouse/mcp-server'],
    env: {
      CLICKHOUSE_URL: String(config.url ?? `http://${config.host ?? 'localhost'}:${config.port ?? 8123}`),
      ...(config.user || config.username ? { CLICKHOUSE_USER: String(config.user ?? config.username) } : {}),
      ...(config.password ? { CLICKHOUSE_PASSWORD: String(config.password) } : {}),
    },
  }),

  // ── Cache / KV ─────────────────────────────────────────────────
  redis: (config) => {
    const url = String(config.url ?? `redis://${config.host ?? 'localhost'}:${config.port ?? 6379}`)
    return {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-redis', url],
      env: {},
    }
  },

  // ── Search / Log ───────────────────────────────────────────────
  elasticsearch: (config) => ({
    command: 'npx',
    args: ['-y', '@elastic/mcp-server-elasticsearch'],
    env: {
      ES_URL: String(config.url ?? ''),
      ...(config.apiKey ? { ES_API_KEY: String(config.apiKey) } : {}),
    },
  }),

  // ── Monitoring ─────────────────────────────────────────────────
  prometheus: (config) => {
    const url = String(config.url ?? `http://${config.host ?? 'localhost'}:${config.port ?? 9090}`)
    return {
      command: 'npx',
      args: ['-y', 'prometheus-mcp@latest', 'stdio'],
      env: { PROMETHEUS_URL: url },
    }
  },

  grafana: (config) => ({
    command: 'npx',
    args: ['-y', '@leval/mcp-grafana'],
    env: {
      GRAFANA_URL: String(config.url ?? ''),
      ...(config.token ? { GRAFANA_API_KEY: String(config.token) } : {}),
    },
  }),

  loki: (config) => ({
    command: 'npx',
    args: ['-y', 'simple-loki-mcp'],
    env: {
      LOKI_URL: String(config.url ?? ''),
      ...(config.apiKey ? { LOKI_API_KEY: String(config.apiKey) } : {}),
    },
  }),

  sentry: (config) => ({
    command: 'npx',
    args: ['-y', '@sentry/mcp-server'],
    env: {
      ...(config.token ? { SENTRY_AUTH_TOKEN: String(config.token) } : {}),
    },
  }),

  datadog: (config) => ({
    command: 'npx',
    args: ['-y', '@winor30/mcp-server-datadog'],
    env: {
      DD_API_KEY: String(config.apiKey ?? ''),
      ...(config.appKey ? { DD_APP_KEY: String(config.appKey) } : {}),
      DD_SITE: String(config.site ?? 'datadoghq.com'),
    },
  }),

  // ── Messaging ──────────────────────────────────────────────────
  kafka: (config) => ({
    command: 'npx',
    args: ['-y', '@confluentinc/mcp-confluent'],
    env: {
      ...(config.brokers ? { KAFKA_BOOTSTRAP_SERVERS: String(config.brokers) } : {}),
      ...(config.apiKey ? { CONFLUENT_CLOUD_API_KEY: String(config.apiKey) } : {}),
      ...(config.apiSecret ? { CONFLUENT_CLOUD_API_SECRET: String(config.apiSecret) } : {}),
    },
  }),

  rabbitmq: (config) => {
    const host = String(config.host ?? 'localhost')
    const port = String(config.port ?? 5672)
    const user = config.user ?? config.username
    const password = config.password
    const url = user && password
      ? `amqp://${user}:${password}@${host}:${port}`
      : `amqp://${host}:${port}`
    return {
      command: 'uvx',
      args: ['mcp-server-rabbitmq'],
      env: { RABBITMQ_URL: url },
    }
  },

  // ── Container / Orchestration ──────────────────────────────────
  kubernetes: (config) => {
    const env: Record<string, string> = {}
    if (config.kubeconfig) env.KUBECONFIG = String(config.kubeconfig)
    return {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-kubernetes'],
      env,
    }
  },

  docker: (config) => ({
    command: 'npx',
    args: ['-y', 'mcp-docker-server'],
    env: {
      ...(config.socketPath ? { DOCKER_HOST: `unix://${config.socketPath}` } : {}),
      ...(config.url ? { DOCKER_HOST: String(config.url) } : {}),
    },
  }),

  argocd: (config) => ({
    command: 'npx',
    args: ['-y', 'argocd-mcp@latest'],
    env: {
      ARGOCD_BASE_URL: String(config.url ?? ''),
      ...(config.token ? { ARGOCD_API_TOKEN: String(config.token) } : {}),
    },
  }),

  // ── CI/CD / Workflow ───────────────────────────────────────────
  airflow: (config) => ({
    command: 'uvx',
    args: ['mcp-server-airflow'],
    env: {
      AIRFLOW_URL: String(config.url ?? ''),
      ...(config.username ? { AIRFLOW_USERNAME: String(config.username) } : {}),
      ...(config.password ? { AIRFLOW_PASSWORD: String(config.password) } : {}),
    },
  }),

  // ── API Gateway ────────────────────────────────────────────────
  kong: (config) => ({
    command: 'npx',
    args: ['-y', '@kong/mcp-konnect'],
    env: {
      KONNECT_ACCESS_TOKEN: String(config.accessToken ?? ''),
      KONNECT_REGION: String(config.region ?? 'us'),
    },
  }),

  apisix: (config) => {
    const host = String(config.host ?? 'localhost')
    const port = String(config.adminApiPort ?? 9180)
    return {
      command: 'npx',
      args: ['-y', 'apisix-mcp'],
      env: {
        APISIX_ADMIN_URL: `http://${host}:${port}`,
        ...(config.adminKey ? { APISIX_ADMIN_KEY: String(config.adminKey) } : {}),
      },
    }
  },

  // ── SSH ────────────────────────────────────────────────────────
  ssh: (config) => ({
    command: 'npx',
    args: ['-y', '@idletoaster/ssh-mcp-server'],
    env: {
      SSH_HOST: String(config.host ?? ''),
      SSH_PORT: String(config.port ?? 22),
      ...(config.username ? { SSH_USER: String(config.username) } : {}),
      ...(config.privateKey ? { SSH_PRIVATE_KEY: String(config.privateKey) } : {}),
    },
  }),
}

// postgres alias
spawnRegistry.postgres = spawnRegistry.postgresql

function buildSpawnConfig(serverType: string, config: Record<string, unknown>): SpawnConfig | null {
  const builder = spawnRegistry[serverType.toLowerCase()]
  return builder ? builder(config) : null
}

// ── MCP Args Normalization ─────────────────────────────────────────

function normalizeMcpArgs(serverType: string, toolName: string, args: Record<string, unknown>) {
  const normalizedArgs = { ...args }
  const type = serverType.toLowerCase()

  if (toolName === 'query') {
    if ((type === 'postgresql' || type === 'postgres') && typeof normalizedArgs.query === 'string' && typeof normalizedArgs.sql !== 'string') {
      normalizedArgs.sql = normalizedArgs.query
    }

    if (type === 'mysql' && typeof normalizedArgs.sql === 'string' && typeof normalizedArgs.query !== 'string') {
      normalizedArgs.query = normalizedArgs.sql
    }
  }

  return normalizedArgs
}

// ── Skill MCP Manager ──────────────────────────────────────────────

export const skillMcpManager = {
  async activate(skillSlug: string, projectId: string): Promise<string[]> {
    // If already active, return existing tools
    if (activeMcps.has(skillSlug)) {
      logger.info({ skillSlug, projectId }, 'Reusing active MCP server')
      return activeMcps.get(skillSlug)!.tools
    }

    const skill = await skillCatalogService.getBySlug(skillSlug)
    if (!skill) throw new Error(`Skill not found: ${skillSlug}`)

    const mcpServers = skill.mcpServers ?? []
    const applicableServiceTypes = skill.applicableServiceTypes ?? []

    if (mcpServers.length === 0) throw new Error(`Skill ${skillSlug} has no MCP servers configured`)

    // Get project services and match with skill requirements
    const services = await projectServiceCatalog.list(projectId)
    const matchedServices = services.filter((s) =>
      applicableServiceTypes.length === 0 || applicableServiceTypes.includes(s.type),
    )

    // For now, use the first MCP server definition
    const serverType = mcpServers[0]
    const matchedService = matchedServices[0]

    if (!matchedService) {
      throw new Error(`No matching service found for skill ${skillSlug} (needs: ${applicableServiceTypes.join(', ')})`)
    }

    // Build MCP server spawn config based on service type and config
    const spawnConfig = buildSpawnConfig(serverType, matchedService.config)
    if (!spawnConfig) {
      throw new Error(`Unsupported MCP server type: ${serverType}`)
    }

    logger.info(
      {
        skillSlug,
        projectId,
        serverType,
        serviceId: matchedService.id,
        serviceType: matchedService.type,
        host: matchedService.config.host ?? matchedService.config.url ?? null,
        port: matchedService.config.port ?? null,
        database: matchedService.config.database ?? null,
      },
      'Activating MCP server'
    )

    const mergedEnv: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) mergedEnv[k] = v
    }
    Object.assign(mergedEnv, spawnConfig.env)

    const transport = new StdioClientTransport({
      command: spawnConfig.command,
      args: spawnConfig.args,
      env: mergedEnv,
    })

    const client = new Client({ name: `chronos-${skillSlug}`, version: '1.0.0' })

    try {
      await client.connect(transport)
      const { tools: mcpTools } = await client.listTools()
      const toolNames = mcpTools.map((t) => `${skillSlug}_${t.name}`)

      activeMcps.set(skillSlug, { client, transport, tools: toolNames, serverType })
      logger.info({ skillSlug, tools: toolNames }, 'MCP server activated')
      return toolNames
    } catch (error) {
      logger.error({ err: error, skillSlug }, 'Failed to activate MCP server')
      throw error
    }
  },

  async executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    // toolName format: {skillSlug}_{mcpToolName}
    const underscoreIndex = toolName.indexOf('_')
    if (underscoreIndex === -1) throw new Error(`Invalid tool name format: ${toolName}`)

    const skillSlug = toolName.substring(0, underscoreIndex)
    const mcpToolName = toolName.substring(underscoreIndex + 1)

    const active = activeMcps.get(skillSlug)
    if (!active) throw new Error(`MCP server not active for skill: ${skillSlug}. Call activateSkillMcp first.`)

    try {
      const normalizedArgs = normalizeMcpArgs(active.serverType, mcpToolName, args)
      const result = await active.client.callTool({ name: mcpToolName, arguments: normalizedArgs })
      logger.info({ toolName, args: normalizedArgs }, 'MCP tool execution succeeded')
      return result
    } catch (error) {
      logger.error({ err: error, toolName, args }, 'MCP tool execution failed')
      throw error
    }
  },

  async deactivate(skillSlug: string): Promise<void> {
    const active = activeMcps.get(skillSlug)
    if (!active) return

    try {
      await active.transport.close()
    } catch (error) {
      logger.warn({ err: error, skillSlug }, 'Error closing MCP transport')
    }
    activeMcps.delete(skillSlug)
    logger.info({ skillSlug }, 'MCP server deactivated')
  },

  async deactivateAll(): Promise<void> {
    for (const slug of activeMcps.keys()) {
      await this.deactivate(slug)
    }
  },
}
