import { Agent } from '@mastra/core/agent'
import { env } from '../../env'
import { createRunbook, searchRunbooks } from '../tools/runbook-tools'
import { POSTMORTEM_AGENT_PROMPT } from './prompts/postmortem-agent-prompt'

export const postmortemAgent = new Agent({
  id: 'postmortem-agent',
  name: 'Postmortem Agent',
  description: `事件解决后，总结整个处理过程并生成运行手册。
委派此 Agent 时，请在提示中包含：事件内容、诊断结果、执行的操作、根因、修复方案。
返回：新创建的 Runbook ID 和摘要。`,
  instructions: POSTMORTEM_AGENT_PROMPT,
  model: {
    id: `openai/${env.OPENAI_MODEL_MINI}`,
    ...(env.OPENAI_BASE_URL && { url: env.OPENAI_BASE_URL }),
    apiKey: env.OPENAI_API_KEY,
  },
  tools: { createRunbook, searchRunbooks },
})
