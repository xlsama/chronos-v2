export interface Message {
  id: string
  threadId: string
  incidentId?: string | null
  role: 'user' | 'assistant' | 'system'
  content?: string | null
  toolInvocations?: Record<string, unknown>[] | null
  metadata?: Record<string, unknown> | null
  createdAt: string
}
