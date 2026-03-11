import { Agent } from '@mastra/core/agent'
import { env } from '../../env'
import { searchRunbooks, getRunbook } from '../tools/runbook-tools'
import { RUNBOOK_AGENT_PROMPT } from './prompts/runbook-agent-prompt'

export const runbookAgent = new Agent({
  id: 'runbook-agent',
  name: 'Runbook Agent',
  description: `搜索运行手册，查找适用于当前事件的历史解决方案。
返回：匹配的 Runbook 列表（含关键步骤摘要）、综合建议。
委派此 Agent 时，请在提示中包含事件摘要和已知的受影响服务。`,
  instructions: RUNBOOK_AGENT_PROMPT,
  model: {
    id: `openai/${env.OPENAI_MODEL_MINI}`,
    ...(env.OPENAI_BASE_URL && { url: env.OPENAI_BASE_URL }),
    apiKey: env.OPENAI_API_KEY,
  },
  tools: { searchRunbooks, getRunbook },
})
