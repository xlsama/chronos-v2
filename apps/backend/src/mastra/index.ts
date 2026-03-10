import { Mastra } from '@mastra/core'
import { opsAgent } from './agents/ops-agent'

export const mastra = new Mastra({
  agents: { 'ops-agent': opsAgent },
})
