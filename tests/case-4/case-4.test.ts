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

describe('Case 4: MySQL 商品价格异常导致零元订单', () => {
  beforeAll(async () => {
    dockerComposeUp(CASE_DIR)
    meta = await seed()
  })

  afterAll(async () => {
    await cleanup(meta).catch((e) => console.warn('[cleanup error]', e))
    dockerComposeDown(CASE_DIR)
  })

  it('Agent 应通过 MySQL MCP 诊断商品价格为 0 的问题', async () => {
    // 1. Send P2 alert
    const alertContent = `【P2 告警】商品服务订单金额异常

告警来源: order-service / price-monitor
告警时间: ${new Date().toISOString()}
告警级别: P2

告警描述:
近 30 分钟内，订单服务检测到多笔零元订单（total = 0），订单校验失败率飙升至 40%。
checkout-service 报告支付网关拒绝了多笔金额为 0 的交易请求。
price-monitor 检测到数码配件分类存在明显价格异常。

影响范围:
- 4 笔订单创建失败（订单号: ORD-20260312-007 ~ 010）
- 支付网关拒绝率上升
- 前端用户看到商品价格显示为 ¥0.00

请立即排查商品数据库中的价格与订单相关数据是否正常。`

    const incident = await sendAlert(alertContent, meta.projectId)
    const threadId = `incident-${incident.id}`
    console.log(`  Incident: ${incident.id}, Thread: ${threadId}`)

    // 2. Wait for agent to resolve
    const finalStatus = await waitForIncidentResolution(incident.id)

    // 3. Get full agent text
    const fullText = await getFullText(threadId)
    const finalSummary = await waitForIncidentFinalSummary(incident.id)

    // 4. Assertions
    // 4a. Incident resolved
    expect(['resolved', 'closed']).toContain(finalStatus)

    // 4b. Agent identified price anomaly
    expect(fullText).toMatch(/price|价格|0\.00|零元|数码配件/i)

    // 4c. Agent used MySQL MCP
    expect(fullText).toMatch(/mysql|mcp|activat/i)

    // 4d. Final summary draft was generated
    expect(finalSummary).toMatch(/根因|排查过程|关键证据/i)

    // 4e. Incident history is created only after saving the summary
    await saveIncidentSummary(incident.id)
    const history = await getIncidentHistory(meta.projectId)
    expect(history.length).toBeGreaterThan(0)
  })
})
