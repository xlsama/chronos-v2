import { db } from '../db/index'
import { toolPolicies } from '../db/schema/index'
import type { RiskLevel } from '../lib/tool-classifier'

const DEFAULT_POLICY = {
  id: 'global',
  approvalThreshold: 'medium' as RiskLevel,
  allowDatabaseWrite: true,
  allowDatabaseDDL: false,
  allowK8sMutations: true,
  allowSSH: false,
  allowCICDTrigger: true,
}

export const toolPolicyService = {
  async getGlobal() {
    const rows = await db.select().from(toolPolicies).limit(1)
    return rows[0] ?? DEFAULT_POLICY
  },

  async upsert(data: {
    approvalThreshold?: RiskLevel
    allowDatabaseWrite?: boolean
    allowDatabaseDDL?: boolean
    allowK8sMutations?: boolean
    allowSSH?: boolean
    allowCICDTrigger?: boolean
  }) {
    const [row] = await db
      .insert(toolPolicies)
      .values({ id: 'global', ...data })
      .onConflictDoUpdate({
        target: toolPolicies.id,
        set: { ...data, updatedAt: new Date() },
      })
      .returning()
    return row
  },
}
