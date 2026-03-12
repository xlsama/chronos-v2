import { Agent } from '@mastra/core/agent'
import { createOpenAI } from '@ai-sdk/openai'
import { env } from '../../env'
import { searchIncidentHistory, getIncidentHistoryDetail } from '../tools'
import { INCIDENT_HISTORY_AGENT_PROMPT } from './prompts/incident-history-agent-prompt'

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL })

export const incidentHistoryAgent = new Agent({
  id: 'incidentHistoryAgent',
  name: 'Incident History Agent',
  description: '历史事件搜索 Agent - 搜索类似的过往事件，提供历史解决方案和经验教训',
  instructions: INCIDENT_HISTORY_AGENT_PROMPT,
  model: openai.chat(env.OPENAI_MODEL_MINI),
  tools: { searchIncidentHistory, getIncidentHistoryDetail },
})
