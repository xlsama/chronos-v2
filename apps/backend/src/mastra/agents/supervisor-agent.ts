import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { LibSQLStore } from '@mastra/libsql'
import { env } from '../../env'
import { kbAgent } from './kb-agent'
import { runbookAgent } from './runbook-agent'
import { infraAgent } from './infra-agent'
import { postmortemAgent } from './postmortem-agent'
import { updateIncidentStatus } from '../tools/incident-tools'
import { SUPERVISOR_PROMPT } from './prompts/supervisor-prompt'

export const supervisorAgent = new Agent({
  id: 'supervisor-agent',
  name: 'Chronos Supervisor',
  instructions: SUPERVISOR_PROMPT,
  model: {
    id: `openai/${env.OPENAI_MODEL}`,
    ...(env.OPENAI_BASE_URL && { url: env.OPENAI_BASE_URL }),
    apiKey: env.OPENAI_API_KEY,
  },
  agents: { kbAgent, runbookAgent, infraAgent, postmortemAgent },
  tools: { updateIncidentStatus },
  memory: new Memory({
    storage: new LibSQLStore({
      id: 'chronos-memory',
      url: 'file:./data/mastra.db',
    }),
  }),
})
