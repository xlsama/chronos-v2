import { AsyncLocalStorage } from 'node:async_hooks'

export interface AgentIdentity {
  id: string
  name?: string
}

export interface AgentContext {
  threadId: string
  incidentId?: string
  isBackground?: boolean
  agentStack?: AgentIdentity[]
}

export const agentContextStorage = new AsyncLocalStorage<AgentContext>()

export const SUPERVISOR_AGENT: AgentIdentity = {
  id: 'supervisorAgent',
  name: 'Supervisor Agent',
}

export function createAgentContext(input: {
  threadId: string
  incidentId?: string
  isBackground?: boolean
  agent?: AgentIdentity
}): AgentContext {
  const currentAgent = input.agent ?? SUPERVISOR_AGENT
  return {
    threadId: input.threadId,
    incidentId: input.incidentId,
    isBackground: input.isBackground,
    agentStack: [currentAgent],
  }
}

export function getCurrentAgent(ctx = agentContextStorage.getStore()): AgentIdentity | undefined {
  return ctx?.agentStack?.[ctx.agentStack.length - 1]
}

export function pushCurrentAgent(agent: AgentIdentity) {
  const ctx = agentContextStorage.getStore()
  if (!ctx) return
  ctx.agentStack ??= []
  ctx.agentStack.push(agent)
}

export function popCurrentAgent(agentId?: string) {
  const ctx = agentContextStorage.getStore()
  if (!ctx?.agentStack?.length) return

  if (!agentId) {
    if (ctx.agentStack.length > 1) ctx.agentStack.pop()
    return
  }

  const top = ctx.agentStack[ctx.agentStack.length - 1]
  if (top?.id === agentId && ctx.agentStack.length > 1) {
    ctx.agentStack.pop()
    return
  }

  const index = ctx.agentStack.findLastIndex((agent) => agent.id === agentId)
  if (index > 0) {
    ctx.agentStack.splice(index, 1)
  }
}

export function getAgentLogContext(): Record<string, unknown> {
  const ctx = agentContextStorage.getStore()
  if (!ctx) return {}

  const { agentStack, ...rest } = ctx
  const currentAgent = getCurrentAgent(ctx)

  return {
    ...rest,
    ...(currentAgent?.id ? { agentId: currentAgent.id } : {}),
    ...(currentAgent?.name ? { agentName: currentAgent.name } : {}),
  }
}

export function agentLogLabel(label: string): string {
  const currentAgent = getCurrentAgent()
  const agentPrefix = currentAgent?.id ? `[Agent:${currentAgent.id}] ` : ''
  const scopedLabel = `${agentPrefix}${label}`
  return process.env.NODE_ENV === 'development' ? `\n\n${scopedLabel}\n` : scopedLabel
}

export function toolLogLabel(toolName: string, action: string): string {
  return agentLogLabel(`[Tool:${toolName}] ${action}`)
}

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
