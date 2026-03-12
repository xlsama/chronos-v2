import { Agent } from '@mastra/core/agent'
import { createOpenAI } from '@ai-sdk/openai'
import { Memory } from '@mastra/memory'
import { env } from '../../env'
import {
  updateIncidentStatus,
  listSkills,
  loadSkill,
  activateSkillMcp,
  executeMcpTool,
  deactivateSkillMcp,
  listProjectServices,
  getServiceDetails,
  getServiceMap,
  saveIncidentHistory,
  createRunbook,
} from '../tools'
import { knowledgeAgent } from './knowledge-agent'
import { runbookAgent } from './runbook-agent'
import { incidentHistoryAgent } from './incident-history-agent'
import { buildSupervisorPrompt } from './prompts/supervisor-prompt'

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL })

export function createSupervisorAgent(context?: {
  incidentContent?: string
  incidentSummary?: string
  analysis?: Record<string, unknown>
  selectedSkills?: string[]
  projectId?: string
  projectName?: string
}) {
  return new Agent({
    id: 'supervisorAgent',
    name: 'Supervisor Agent',
    instructions: buildSupervisorPrompt(context),
    model: openai.chat(env.OPENAI_MODEL),
    tools: {
      updateIncidentStatus,
      listSkills,
      loadSkill,
      activateSkillMcp,
      executeMcpTool,
      deactivateSkillMcp,
      listProjectServices,
      getServiceDetails,
      getServiceMap,
      saveIncidentHistory,
      createRunbook,
    },
    agents: { knowledgeAgent, runbookAgent, incidentHistoryAgent },
    memory: new Memory(),
  })
}
