import { Agent } from '@mastra/core/agent'
import { env } from '../../env'
import { searchMcpTools, executeMcpTool } from '../tools/mcp-tools'
import { listConnections } from '../tools/connection-tools'
import { findAffectedServices, getServiceMap } from '../tools/service-map-tools'
import { INFRA_AGENT_PROMPT } from './prompts/infra-agent-prompt'

export const infraAgent = new Agent({
  id: 'infra-agent',
  name: 'Infrastructure Agent',
  description: `执行实际的基础设施操作来诊断和修复问题。拥有 MCP 工具访问能力。
委派此 Agent 时，必须在提示中包含：
1. 诊断计划（具体步骤）
2. 受影响服务的 MCP 工具前缀列表（如 order_mysql, prod_redis）
3. 参考的 Runbook 步骤（如有）
返回：执行的操作列表、诊断结果、根因分析、修复方案。`,
  instructions: INFRA_AGENT_PROMPT,
  model: {
    id: `openai/${env.OPENAI_MODEL}`,
    ...(env.OPENAI_BASE_URL && { url: env.OPENAI_BASE_URL }),
    apiKey: env.OPENAI_API_KEY,
  },
  tools: { searchMcpTools, executeMcpTool, listConnections, findAffectedServices, getServiceMap },
})
