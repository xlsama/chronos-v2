import { Agent } from '@mastra/core/agent'
import { createOpenAI } from '@ai-sdk/openai'
import { env } from '../../env'
import { SUMMARIZE_AGENT_PROMPT } from './prompts/summarize-agent-prompt'

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL })

export const summarizeAgent = new Agent({
  id: 'summarizeAgent',
  name: 'Summarize Agent',
  description: '最终报告总结 Agent - 在事件解决后整理结构化 Markdown 总结报告',
  instructions: SUMMARIZE_AGENT_PROMPT,
  model: openai.chat(env.OPENAI_MODEL_MINI),
})
