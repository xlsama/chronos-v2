export type RiskLevel = 'none' | 'low' | 'medium' | 'high'
export type ApprovalStatus = 'pending' | 'approved' | 'declined' | 'expired'

export interface ToolPolicy {
  id: string
  approvalThreshold: RiskLevel
  allowDatabaseWrite: boolean
  allowDatabaseDDL: boolean
  allowK8sMutations: boolean
  allowSSH: boolean
  allowCICDTrigger: boolean
}

export interface ToolApproval {
  id: string
  threadId: string
  incidentId?: string | null
  runId?: string | null
  toolKey: string
  toolName: string
  connectionName?: string | null
  connectionType?: string | null
  riskLevel: RiskLevel
  input: Record<string, unknown>
  description?: string | null
  status: ApprovalStatus
  decidedAt?: string | null
  declineReason?: string | null
  expiresAt: string
  createdAt: string
}
