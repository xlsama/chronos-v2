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

describe('Case 2: MySQL 优惠券过期日期异常导致核销失败', () => {
  beforeAll(async () => {
    dockerComposeUp(CASE_DIR)
    meta = await seed()
  })

  afterAll(async () => {
    await cleanup(meta).catch((e) => console.warn('[cleanup error]', e))
    dockerComposeDown(CASE_DIR)
  })

  it('Agent 应通过 MySQL MCP 诊断优惠券 expire_date 异常问题', async () => {
    // 1. Send P2 alert
    const alertContent = `【P2 告警】优惠券核销大面积失败

告警来源: coupon-service / alert-manager
告警时间: ${new Date().toISOString()}
告警级别: P2

告警描述:
近 60 分钟内，SPRING2026 春季大促批次的优惠券核销请求连续失败，失败原因均为"优惠券已过期"（coupon_expired）。
但该批次活动有效期至 2026-06-30，理论上所有优惠券应在有效期内。
已收到 4 起核销失败记录和多起用户投诉。

影响范围:
- SPRING2026 批次: 所有优惠券核销均失败
- WELCOME2026 批次: 正常
- FLASH20260301 批次: 正常
- 已收到用户投诉，CRM 系统记录了相关 complaint

请立即排查 MySQL 中优惠券相关数据和核销链路是否正常。`

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

    // 4b. Agent identified coupon / 优惠券 / expire / 过期 issue
    expect(fullText).toMatch(/coupon|优惠券|expire|过期/i)

    // 4c. Agent found 2025-01-01 or expire_date anomaly
    expect(fullText).toMatch(/2025-01-01|expire_date|过期日期.*异常|日期.*错误/i)

    // 4d. Agent used MySQL MCP
    expect(fullText).toMatch(/mysql|mcp|activat/i)

    // 4e. Final summary draft was generated
    expect(finalSummary).toMatch(/根因|排查过程|关键证据/i)

    // 4f. Incident history is created only after saving the summary
    await saveIncidentSummary(incident.id)
    const history = await getIncidentHistory(meta.projectId)
    expect(history.length).toBeGreaterThan(0)
  })
})
