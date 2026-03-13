import path from 'node:path'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { dockerComposeUp, dockerComposeDown } from '../helpers/docker'
import {
  sendAlert,
  waitForIncidentResolution,
  waitForIncidentFinalSummary,
  getFullText,
  saveIncidentSummary,
  getIncidentHistory,
} from '../helpers/chronos-api'
import { seed, type SeedResult } from './seed'
import { cleanup } from './cleanup'

const CASE_DIR = path.resolve(import.meta.dirname)

let meta: SeedResult

describe('Case 1: Redis 限流配置异常导致 API 全面 429', () => {
  beforeAll(async () => {
    dockerComposeUp(CASE_DIR)
    meta = await seed()
  })

  afterAll(async () => {
    await cleanup(meta).catch((e) => console.warn('[cleanup error]', e))
    dockerComposeDown(CASE_DIR)
  })

  it('Agent 应通过 Redis MCP 诊断限流阈值为 0 的问题', async () => {
    // 1. Send P2 alert
    const alertContent = `【P2 告警】API 网关大面积 429 错误

告警来源: api-gateway / alert-manager
告警时间: ${new Date().toISOString()}
告警级别: P2

告警描述:
近 30 分钟内，API 网关对 /api/orders、/api/products、/api/users 三个核心 endpoint 返回 429 Too Many Requests 的比例超过 95%。
但实际请求量远低于历史正常水平，且 /api/health 正常响应。
错误日志显示限流器相关配置可能异常。

影响范围:
- /api/orders: 100% 请求被拒 (429)
- /api/products: 100% 请求被拒 (429)
- /api/users: 100% 请求被拒 (429)
- /api/health: 正常

请立即排查 Redis 中的限流与网关运行态数据是否正常。`

    const incident = await sendAlert(alertContent, meta.projectId)
    const threadId = `incident-${incident.id}`
    console.log(`  Incident: ${incident.id}, Thread: ${threadId}`)

    // 2. Wait for agent to resolve
    const finalStatus = await waitForIncidentResolution(incident.id)

    // 3. Get full agent text
    const fullText = await getFullText(threadId)
    const finalSummary = await waitForIncidentFinalSummary(incident.id)

    // 4. Assertions
    // 4a. Incident reached a post-diagnosis state
    expect(['resolved', 'summarizing', 'completed']).toContain(finalStatus)

    // 4b. Agent identified rate limit / 限流 issue
    expect(fullText).toMatch(/ratelimit|限流|rate.?limit/i)

    // 4c. Agent identified limit=0 as root cause
    expect(fullText).toMatch(/limit.*0|0.*limit|零|为\s*0|=\s*0|设为\s*0/i)

    // 4d. Agent used Redis MCP
    expect(fullText).toMatch(/redis|mcp|activat/i)

    // 4e. Final summary draft was generated
    expect(finalSummary).toMatch(/根因|排查过程|关键证据/i)

    // 4f. Incident history is created only after saving the summary
    await saveIncidentSummary(incident.id)
    const history = await getIncidentHistory(meta.projectId)
    expect(history.length).toBeGreaterThan(0)
  })
})
