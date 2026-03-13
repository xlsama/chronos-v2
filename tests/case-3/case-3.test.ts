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

describe('Case 3: Prometheus 支付服务异常指标诊断', () => {
  beforeAll(async () => {
    dockerComposeUp(CASE_DIR)
    meta = await seed()
  })

  afterAll(async () => {
    await cleanup(meta).catch((e) => console.warn('[cleanup error]', e))
    dockerComposeDown(CASE_DIR)
  })

  it('Agent 应通过 Prometheus MCP 诊断 payment-service 内存泄漏问题', async () => {
    // 1. Send P1 alert
    const alertContent = `【P1 告警】payment-service 大量 500 错误，服务不可用

告警来源: prometheus / alert-manager
告警时间: ${new Date().toISOString()}
告警级别: P1

告警描述:
payment-service 在过去 30 分钟内出现大量 HTTP 500 错误，错误率超过 80%。
监控显示 payment-service 存活状态异常，并且在短时间内发生了多次重启。
其他服务（order-service、user-service）运行正常。
疑似 payment-service 出现严重故障，导致所有支付相关业务中断。

影响范围:
- payment-service: 服务不可用，所有支付请求失败
- order-service: 因支付环节不可用，下单流程受阻
- user-service: 不受影响，正常运行

请立即通过 Prometheus 监控指标排查 payment-service 的故障原因。`

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

    // 4b. Agent identified payment-service as the faulty service
    expect(fullText).toMatch(/payment.?service|支付服务/i)

    // 4c. Agent found memory leak / OOM / memory issue
    expect(fullText).toMatch(/memory|内存|oom|泄漏|leak|溢出/i)

    // 4d. Agent used Prometheus MCP
    expect(fullText).toMatch(/prometheus|mcp|activat/i)

    // 4e. Final summary draft was generated
    expect(finalSummary).toMatch(/根因|排查过程|关键证据/i)

    // 4f. Incident history is created only after saving the summary
    await saveIncidentSummary(incident.id)
    const history = await getIncidentHistory(meta.projectId)
    expect(history.length).toBeGreaterThan(0)
  })
})
