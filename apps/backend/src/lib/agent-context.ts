import { AsyncLocalStorage } from 'node:async_hooks'

export interface AgentContext {
  threadId: string
  incidentId?: string
}

export const agentContextStorage = new AsyncLocalStorage<AgentContext>()
