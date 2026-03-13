export interface PolicyDecision {
  needsApproval: boolean
  riskLevel: 'none' | 'low' | 'medium' | 'high'
  reason?: string
}

const WRITE_SQL_PATTERN = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i

const INSTALL_PATTERNS = [
  /\bnpm\s+install\b/,
  /\byarn\s+add\b/,
  /\bpnpm\s+add\b/,
  /\bpip\s+install\b/,
  /\bapt-get\s+install\b/,
  /\bapt\s+install\b/,
  /\bapk\s+add\b/,
  /\byum\s+install\b/,
  /\bdnf\s+install\b/,
]

function extractSqlFromArgs(args: Record<string, unknown>): string | undefined {
  // MCP tool args may be nested: { args: { sql: "..." } } or flat: { sql: "..." }
  const nestedArgs = args.args
  const payload = (nestedArgs && typeof nestedArgs === 'object' && !Array.isArray(nestedArgs))
    ? nestedArgs as Record<string, unknown>
    : args

  const candidate = payload.query ?? payload.sql ?? payload.statement
  return typeof candidate === 'string' ? candidate.trim() : undefined
}

export function evaluatePolicy(
  toolName: string,
  args: Record<string, unknown>,
  context?: { skillRiskLevel?: string },
): PolicyDecision {
  // 1. runContainerCommand → always high
  if (toolName === 'runContainerCommand') {
    const command = typeof args.command === 'string' ? args.command : ''

    // Check for install commands (extra specific reason)
    if (INSTALL_PATTERNS.some((p) => p.test(command))) {
      return {
        needsApproval: true,
        riskLevel: 'high',
        reason: `Shell 命令包含软件安装操作: ${command.slice(0, 200)}`,
      }
    }

    return {
      needsApproval: true,
      riskLevel: 'high',
      reason: `执行 Shell 命令: ${command.slice(0, 200)}`,
    }
  }

  // 2. executeMcpTool
  if (toolName === 'executeMcpTool') {
    // High-risk skill → all operations require approval
    if (context?.skillRiskLevel === 'high') {
      return {
        needsApproval: true,
        riskLevel: 'high',
        reason: `高风险 Skill 的 MCP 操作: ${typeof args.toolName === 'string' ? args.toolName : 'unknown'}`,
      }
    }

    // Check SQL write operations
    const sql = extractSqlFromArgs(args)
    if (sql && WRITE_SQL_PATTERN.test(sql)) {
      return {
        needsApproval: true,
        riskLevel: 'high',
        reason: `MCP 写操作: ${sql.slice(0, 200)}`,
      }
    }

    // Read-only MCP → no approval needed
    return { needsApproval: false, riskLevel: 'none' }
  }

  // 3. updateIncidentStatus → only when resolving
  if (toolName === 'updateIncidentStatus') {
    if (args.status === 'resolved' || args.status === 'closed') {
      return {
        needsApproval: true,
        riskLevel: 'medium',
        reason: `关闭事件 (${args.status})`,
      }
    }
    return { needsApproval: false, riskLevel: 'none' }
  }

  // 4. Default → no approval
  return { needsApproval: false, riskLevel: 'none' }
}
