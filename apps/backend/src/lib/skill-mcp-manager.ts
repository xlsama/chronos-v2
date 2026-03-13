import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { skillCatalogService } from '../services/skill-catalog.service'
import { projectServiceCatalog } from '../services/project-service-catalog.service'
import { getSkillsRoot } from './file-storage'
import { logger } from './logger'

interface ActiveMcp {
  client: Client
  transport: StdioClientTransport
  tools: string[]
  serverType: string
}

const activeMcps = new Map<string, ActiveMcp>()

export const skillMcpManager = {
  async activate(skillSlug: string, projectId: string): Promise<string[]> {
    // If already active, return existing tools
    if (activeMcps.has(skillSlug)) {
      logger.info({ skillSlug, projectId }, 'Reusing active MCP server')
      return activeMcps.get(skillSlug)!.tools
    }

    const skill = await skillCatalogService.getBySlug(skillSlug)
    if (!skill) throw new Error(`Skill not found: ${skillSlug}`)

    // Read raw config to get MCP-related fields (not part of simplified SkillRecord)
    let rawConfig: { mcpServers?: string[]; applicableServiceTypes?: string[] } = {}
    try {
      rawConfig = JSON.parse(await readFile(path.join(getSkillsRoot(), skillSlug, 'skill.config.json'), 'utf-8'))
    } catch { /* ignore */ }

    const mcpServers = rawConfig.mcpServers ?? []
    const applicableServiceTypes = rawConfig.applicableServiceTypes ?? []

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

function buildSpawnConfig(serverType: string, config: Record<string, unknown>): { command: string; args: string[]; env: Record<string, string> } | null {
  const type = serverType.toLowerCase()

  if (type === 'mysql' || type === 'postgresql' || type === 'postgres') {
    const host = String(config.host ?? 'localhost')
    const port = String(config.port ?? (type === 'mysql' ? 3306 : 5432))
    const user = String(config.user ?? config.username ?? '')
    const password = String(config.password ?? '')
    const database = String(config.database ?? '')

    if (type === 'mysql') {
      return {
        command: 'npx',
        args: ['-y', '@benborla29/mcp-server-mysql'],
        env: {
          MYSQL_HOST: host,
          MYSQL_PORT: port,
          MYSQL_USER: user,
          MYSQL_PASS: password,
          MYSQL_DB: database,
          // Keep the alternative names too so existing local setups continue to work.
          MYSQL_PASSWORD: password,
          MYSQL_DATABASE: database,
        },
      }
    }
    const url = `postgresql://${user}:${password}@${host}:${port}/${database}`
    return {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', url],
      env: {},
    }
  }

  if (type === 'prometheus') {
    const host = String(config.host ?? 'localhost')
    const port = String(config.port ?? 9090)
    const url = String(config.url ?? `http://${host}:${port}`)
    return {
      command: 'npx',
      args: ['-y', 'prometheus-mcp@latest', 'stdio'],
      env: { PROMETHEUS_URL: url },
    }
  }

  if (type === 'redis') {
    const url = String(config.url ?? `redis://${config.host ?? 'localhost'}:${config.port ?? 6379}`)
    return {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-redis', url],
      env: {},
    }
  }

  if (type === 'kubernetes') {
    return {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-kubernetes'],
      env: config.kubeconfig ? { KUBECONFIG: String(config.kubeconfig) } : {},
    }
  }

  return null
}

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
