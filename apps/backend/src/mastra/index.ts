import { Mastra } from '@mastra/core'
import { supervisorAgent } from './agents/supervisor-agent'

export const mastra = new Mastra({
  agents: {
    'supervisor-agent': supervisorAgent,
  },
})
