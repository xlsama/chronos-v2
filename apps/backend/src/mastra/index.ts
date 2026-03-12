import { Mastra } from '@mastra/core'
import { PostgresStore } from '@mastra/pg'
import { env } from '../env'
import { knowledgeAgent } from './agents/knowledge-agent'
import { runbookAgent } from './agents/runbook-agent'
import { incidentHistoryAgent } from './agents/incident-history-agent'

export const mastra = new Mastra({
  agents: { knowledgeAgent, runbookAgent, incidentHistoryAgent },
  storage: new PostgresStore({
    id: 'chronos-storage',
    connectionString: env.DATABASE_URL,
  }),
})
