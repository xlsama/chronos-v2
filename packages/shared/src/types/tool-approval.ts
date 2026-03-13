import type { ApprovalStatus, RiskLevel } from './enums'

export interface ToolApproval {
  id: string
  threadId: string
  incidentId?: string | null
  toolName: string
  toolArgs?: Record<string, unknown> | null
  riskLevel: RiskLevel
  reason?: string | null
  status: ApprovalStatus
  resolvedAt?: string | null
  createdAt: string
}

export interface ApprovalRequiredEvent {
  id: string
  toolName: string
  toolArgs?: Record<string, unknown> | null
  riskLevel: RiskLevel
  reason?: string | null
  createdAt: string
}

export interface ResolveApprovalRequest {
  action: 'approve' | 'decline'
}
