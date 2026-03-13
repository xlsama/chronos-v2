import path from 'node:path'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { dockerComposeUp, dockerComposeDown } from '../helpers/docker'
import {
  sendAlert,
  waitForIncidentResolution,
  getFullText,
  getIncidentHistory,
} from '../helpers/chronos-api'
import { seed, type SeedResult } from './seed'
import { cleanup } from './cleanup'

const CASE_DIR = path.resolve(import.meta.dirname)

let meta: SeedResult

describe('Case 5: PostgreSQL 定时任务异常导致报表数据缺失', () => {
  beforeAll(async () => {
    dockerComposeUp(CASE_DIR)
    meta = await seed()
  })

  afterAll(async () => {
    await cleanup(meta).catch((e) => console.warn('[cleanup error]', e))
    dockerComposeDown(CASE_DIR)
  })

  it('Agent 应通过 PostgreSQL MCP 诊断定时任务被禁用的问题', async () => {
    // 1. Send P2 alert
    const alertContent = `【P2 告警】数据看板过期 — BI 报表数据停滞

告警来源: dashboard-api / bi-gateway
告警时间: ${new Date().toISOString()}
告警级别: P2

告警描述:
业务方反馈 BI 看板数据停留在 3 天前，daily_reports 表无最近 3 天的新数据。
dashboard-api 检测到最新 report_date 距今超过 3 天。
bi-gateway 在刷新报表时未找到近期数据。

影响范围:
- BI 看板所有部门的日报指标（DAU、revenue 等）均为 3 天前的数据
- 业务决策参考数据过期
- 多个部门已提交工单反馈数据异常

请排查报表生成定时任务是否正常运行，确认数据缺失原因。`

    const incident = await sendAlert(alertContent, meta.projectId)
    const threadId = `incident-${incident.id}`
    console.log(`  Incident: ${incident.id}, Thread: ${threadId}`)

    // 2. Wait for agent to resolve
    const finalStatus = await waitForIncidentResolution(incident.id)

    // 3. Get full agent text
    const fullText = await getFullText(threadId)

    // 4. Assertions
    // 4a. Incident resolved
    expect(['resolved', 'closed']).toContain(finalStatus)

    // 4b. Agent identified disabled scheduled job
    expect(fullText).toMatch(/disabled|禁用|is_enabled|generate_daily_report/i)

    // 4c. Agent used PostgreSQL MCP
    expect(fullText).toMatch(/postgresql|postgres|mcp|activat/i)

    // 4d. Incident history was generated
    const history = await getIncidentHistory(meta.projectId)
    expect(history.length).toBeGreaterThan(0)
  })
})
