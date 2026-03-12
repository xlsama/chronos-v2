export type RiskLevel = 'none' | 'low' | 'medium' | 'high'

const RISK_ORDER: Record<RiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3 }

function maxRisk(...levels: RiskLevel[]): RiskLevel {
  let max: RiskLevel = 'none'
  for (const l of levels) {
    if (RISK_ORDER[l] > RISK_ORDER[max]) max = l
  }
  return max
}

// ── Signal 1: Connection type default risk ──

const CONNECTION_TYPE_RISK: Record<string, RiskLevel> = {
  // Monitoring / logging (read-only)
  grafana: 'none',
  prometheus: 'none',
  datadog: 'none',
  sentry: 'none',
  loki: 'none',
  // Event platforms
  pagerduty: 'low',
  opsgenie: 'low',
  // Databases
  mysql: 'medium',
  postgresql: 'medium',
  mongodb: 'medium',
  clickhouse: 'medium',
  // Cache / message queues
  redis: 'medium',
  kafka: 'medium',
  rabbitmq: 'medium',
  // CI/CD
  jenkins: 'medium',
  airflow: 'medium',
  // API gateways
  apisix: 'medium',
  kong: 'medium',
  // Elasticsearch
  elasticsearch: 'medium',
  // Container orchestration
  kubernetes: 'high',
  docker: 'high',
  argocd: 'high',
  // Remote access
  ssh: 'high',
}

function classifyByConnectionType(connectionType: string): RiskLevel {
  return CONNECTION_TYPE_RISK[connectionType] ?? 'medium'
}

// ── Signal 2: Tool name pattern matching ──

const READ_PATTERN = /^(get|list|describe|show|search|query|select|find|status|logs|metrics|health|check|read|fetch|info|count|exists|ping|version|explain)/i
const WRITE_PATTERN = /^(create|insert|add|update|set|modify|patch|write|restart|scale|deploy|run|execute|publish|send|put|post|enable|disable|trigger|start|stop|pause|resume|apply|rollout)/i
const DESTROY_PATTERN = /^(delete|remove|drop|truncate|purge|destroy|kill|drain|evict|shell|rm|wipe|exec(?!ute))/i

function classifyByToolName(toolName: string): RiskLevel {
  if (DESTROY_PATTERN.test(toolName)) return 'high'
  if (WRITE_PATTERN.test(toolName)) return 'medium'
  if (READ_PATTERN.test(toolName)) return 'none'
  return 'low' // unknown pattern → low
}

// ── Signal 3: SQL content detection (database connections only) ──

const DB_TYPES = new Set(['mysql', 'postgresql', 'mongodb', 'clickhouse'])
const DDL_PATTERN = /\b(DROP|TRUNCATE|ALTER|GRANT|REVOKE)\b/i
const DML_WRITE_PATTERN = /\b(INSERT|UPDATE|REPLACE|CREATE\s+TABLE|DELETE\s+FROM)\b/i
const DML_READ_PATTERN = /\b(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i

function classifyBySQLContent(connectionType: string, input: Record<string, unknown>): RiskLevel {
  if (!DB_TYPES.has(connectionType)) return 'none'

  // Look for SQL in common input fields
  const sql = extractSQL(input)
  if (!sql) return 'none'

  if (DDL_PATTERN.test(sql)) return 'high'
  if (DML_WRITE_PATTERN.test(sql)) return 'medium'
  if (DML_READ_PATTERN.test(sql)) return 'none'
  return 'low'
}

function extractSQL(input: Record<string, unknown>): string | null {
  // Check common SQL field names
  for (const key of ['sql', 'query', 'statement', 'command', 'script']) {
    if (typeof input[key] === 'string') return input[key]
  }
  return null
}

// ── Public API ──

export function classifyToolExecution(
  connectionType: string,
  toolName: string,
  input: Record<string, unknown>,
): RiskLevel {
  const signal1 = classifyByConnectionType(connectionType)
  const signal2 = classifyByToolName(toolName)
  const signal3 = classifyBySQLContent(connectionType, input)
  return maxRisk(signal1, signal2, signal3)
}

export interface ToolPolicy {
  approvalThreshold: RiskLevel
  allowDatabaseWrite: boolean
  allowDatabaseDDL: boolean
  allowK8sMutations: boolean
  allowSSH: boolean
  allowCICDTrigger: boolean
}

export function isBlockedByPolicy(
  connectionType: string,
  toolName: string,
  input: Record<string, unknown>,
  policy: ToolPolicy,
): { blocked: true; reason: string } | { blocked: false } {
  // SSH kill switch
  if (connectionType === 'ssh' && !policy.allowSSH) {
    return { blocked: true, reason: 'SSH 远程执行已被安全策略禁止' }
  }

  // K8s mutations
  if (['kubernetes', 'docker', 'argocd'].includes(connectionType) && !policy.allowK8sMutations) {
    if (!READ_PATTERN.test(toolName)) {
      return { blocked: true, reason: 'Kubernetes/容器变更操作已被安全策略禁止' }
    }
  }

  // CI/CD trigger
  if (['jenkins', 'airflow'].includes(connectionType) && !policy.allowCICDTrigger) {
    if (!READ_PATTERN.test(toolName)) {
      return { blocked: true, reason: 'CI/CD 触发操作已被安全策略禁止' }
    }
  }

  // Database DDL
  if (DB_TYPES.has(connectionType)) {
    const sql = extractSQL(input)
    if (sql && DDL_PATTERN.test(sql) && !policy.allowDatabaseDDL) {
      return { blocked: true, reason: '数据库 DDL 操作 (DROP/ALTER/TRUNCATE) 已被安全策略禁止' }
    }
    // Database write
    if (sql && DML_WRITE_PATTERN.test(sql) && !policy.allowDatabaseWrite) {
      return { blocked: true, reason: '数据库写入操作已被安全策略禁止' }
    }
  }

  return { blocked: false }
}

export function needsApproval(riskLevel: RiskLevel, approvalThreshold: RiskLevel): boolean {
  return RISK_ORDER[riskLevel] >= RISK_ORDER[approvalThreshold]
}

export { RISK_ORDER }
