import { describe, it, expect } from 'vitest'
import { classifyToolExecution, isBlockedByPolicy, needsApproval, type RiskLevel } from '../lib/tool-classifier'

describe('classifyToolExecution', () => {
  // Signal 1: Connection type risk
  it('classifies monitoring connections as none', () => {
    expect(classifyToolExecution('grafana', 'get_dashboard', {})).toBe('none')
    expect(classifyToolExecution('prometheus', 'query_range', {})).toBe('none')
    expect(classifyToolExecution('loki', 'get_logs', {})).toBe('none')
  })

  it('classifies database connections with read queries as medium (conn type default)', () => {
    // Signal 1 = medium (mysql), Signal 2 = none (get*), Signal 3 = none (SELECT) → max = medium
    expect(classifyToolExecution('mysql', 'get_tables', {})).toBe('medium')
  })

  // Signal 2: Tool name pattern
  it('classifies read tool names as none (capped by conn type)', () => {
    expect(classifyToolExecution('grafana', 'list_dashboards', {})).toBe('none')
    expect(classifyToolExecution('prometheus', 'query_metrics', {})).toBe('none')
  })

  it('classifies write tool names as medium', () => {
    expect(classifyToolExecution('grafana', 'create_alert', {})).toBe('medium')
  })

  it('classifies destructive tool names as high', () => {
    expect(classifyToolExecution('redis', 'delete_key', {})).toBe('high')
    expect(classifyToolExecution('kubernetes', 'kill_pod', {})).toBe('high')
  })

  // Signal 3: SQL content
  it('detects DDL in SQL as high', () => {
    expect(classifyToolExecution('mysql', 'execute_query', { query: 'DROP TABLE users' })).toBe('high')
    expect(classifyToolExecution('postgresql', 'execute_query', { sql: 'ALTER TABLE orders ADD COLUMN foo int' })).toBe('high')
    expect(classifyToolExecution('mysql', 'execute_query', { query: 'TRUNCATE TABLE logs' })).toBe('high')
  })

  it('detects DML writes in SQL as medium', () => {
    expect(classifyToolExecution('mysql', 'execute_query', { query: 'INSERT INTO orders VALUES (1)' })).toBe('medium')
    expect(classifyToolExecution('mysql', 'execute_query', { query: "UPDATE orders SET status = 'cancelled'" })).toBe('medium')
  })

  it('detects SELECT in SQL as safe (capped by conn type medium)', () => {
    // Signal 1 = medium (mysql), Signal 2 = medium (execute*), Signal 3 = none (SELECT) → medium
    expect(classifyToolExecution('mysql', 'execute_query', { query: 'SELECT * FROM orders' })).toBe('medium')
  })

  // max(signals) behavior
  it('takes max of all signals', () => {
    // ssh (high) + get (none) → high
    expect(classifyToolExecution('ssh', 'get_info', {})).toBe('high')
    // grafana (none) + delete (high) → high
    expect(classifyToolExecution('grafana', 'delete_dashboard', {})).toBe('high')
  })

  it('handles unknown connection type as medium', () => {
    expect(classifyToolExecution('unknown', 'list_items', {})).toBe('medium')
  })
})

describe('isBlockedByPolicy', () => {
  const defaultPolicy = {
    approvalThreshold: 'medium' as RiskLevel,
    allowDatabaseWrite: true,
    allowDatabaseDDL: false,
    allowK8sMutations: true,
    allowSSH: false,
    allowCICDTrigger: true,
  }

  it('blocks SSH when disabled', () => {
    const result = isBlockedByPolicy('ssh', 'execute_command', {}, defaultPolicy)
    expect(result.blocked).toBe(true)
  })

  it('allows SSH when enabled', () => {
    const result = isBlockedByPolicy('ssh', 'execute_command', {}, { ...defaultPolicy, allowSSH: true })
    expect(result.blocked).toBe(false)
  })

  it('blocks DDL when disabled', () => {
    const result = isBlockedByPolicy('mysql', 'execute_query', { query: 'DROP TABLE users' }, defaultPolicy)
    expect(result.blocked).toBe(true)
  })

  it('allows DDL when enabled', () => {
    const result = isBlockedByPolicy('mysql', 'execute_query', { query: 'DROP TABLE users' }, { ...defaultPolicy, allowDatabaseDDL: true })
    expect(result.blocked).toBe(false)
  })

  it('blocks database write when disabled', () => {
    const result = isBlockedByPolicy('mysql', 'execute_query', { query: "UPDATE orders SET status = 'x'" }, { ...defaultPolicy, allowDatabaseWrite: false })
    expect(result.blocked).toBe(true)
  })

  it('blocks K8s mutations when disabled', () => {
    const result = isBlockedByPolicy('kubernetes', 'scale_deployment', {}, { ...defaultPolicy, allowK8sMutations: false })
    expect(result.blocked).toBe(true)
  })

  it('allows K8s read when mutations disabled', () => {
    const result = isBlockedByPolicy('kubernetes', 'list_pods', {}, { ...defaultPolicy, allowK8sMutations: false })
    expect(result.blocked).toBe(false)
  })

  it('blocks CI/CD trigger when disabled', () => {
    const result = isBlockedByPolicy('jenkins', 'trigger_build', {}, { ...defaultPolicy, allowCICDTrigger: false })
    expect(result.blocked).toBe(true)
  })
})

describe('needsApproval', () => {
  it('returns true when risk >= threshold', () => {
    expect(needsApproval('medium', 'medium')).toBe(true)
    expect(needsApproval('high', 'medium')).toBe(true)
    expect(needsApproval('high', 'low')).toBe(true)
  })

  it('returns false when risk < threshold', () => {
    expect(needsApproval('none', 'medium')).toBe(false)
    expect(needsApproval('low', 'medium')).toBe(false)
    expect(needsApproval('low', 'high')).toBe(false)
  })
})
