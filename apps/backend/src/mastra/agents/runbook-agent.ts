import { Agent } from '@mastra/core/agent'
import { createOpenAI } from '@ai-sdk/openai'
import { env } from '../../env'
import { searchRunbooks, getRunbook } from '../tools'
import { RUNBOOK_AGENT_PROMPT } from './prompts/runbook-agent-prompt'

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL })

export const runbookAgent = new Agent({
  id: 'runbookAgent',
  name: 'Runbook Agent',
  description: 'Runbook 搜索 Agent - 搜索已发布的操作手册，提供标准操作流程和解决方案',
  instructions: RUNBOOK_AGENT_PROMPT,
  model: openai.chat(env.OPENAI_MODEL),
  tools: { searchRunbooks, getRunbook },
})
