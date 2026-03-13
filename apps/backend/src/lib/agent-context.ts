import { AsyncLocalStorage } from 'node:async_hooks'

export interface AgentContext {
  threadId: string
  incidentId?: string
  isBackground?: boolean
}

export const agentContextStorage = new AsyncLocalStorage<AgentContext>()

/**
 * Resolve projectId from agent context (incident → projectId).
 * Falls back to the provided inputProjectId if context resolution fails.
 * Guards against LLM passing wrong IDs (e.g. serviceId instead of projectId).
 */
export async function resolveProjectId(inputProjectId?: string): Promise<string | undefined> {
  const ctx = agentContextStorage.getStore()
  if (ctx?.incidentId) {
    // Lazy import to avoid circular dependency
    const { incidentService } = await import('../services/incident.service')
    const incident = await incidentService.getById(ctx.incidentId)
    if (incident?.projectId) return incident.projectId
  }
  return inputProjectId
}
