import path from 'node:path'
import {
  createProject,
  addService,
  uploadKnowledge,
  waitForKnowledgeReady,
  createSkill,
} from '../helpers/chronos-api'
import { writeSkillConfig } from '../helpers/skill-config'

const PUSHGATEWAY_HOST = process.env.PUSHGATEWAY_HOST ?? '127.0.0.1'
const PUSHGATEWAY_PORT = Number(process.env.PUSHGATEWAY_PORT ?? 39091)
const PROMETHEUS_HOST = process.env.PROMETHEUS_HOST ?? '127.0.0.1'
const PROMETHEUS_PORT = Number(process.env.PROMETHEUS_PORT ?? 39090)

const SKILL_MARKDOWN = `---
name: "Prometheus Metrics Analysis"
description: "通过 Prometheus 指标分析微服务健康状态，诊断服务异常、内存泄漏、频繁重启等问题"
---

# Prometheus 指标分析诊断方法论

## 适用场景

当接到与微服务性能异常、服务不可用、错误率飙升相关的告警时，使用本诊断方法论通过 Prometheus 指标进行系统化排查。

## 诊断步骤

### 第一步：查询错误率

1. 查询 http_requests_total 指标，按 service 和 status 分组
2. 对比 status="500" 和 status="200" 的计数
3. 计算各服务的错误率，找出错误率异常高的服务

### 第二步：查询服务存活状态

1. 查询 service_up 指标
2. 确认哪些服务的 service_up = 0（不可用）
3. 与错误率异常的服务关联

### 第三步：查询重启次数

1. 查询 pod_restart_count 指标
2. 找出重启次数异常高的服务（> 5 次需关注）
3. 频繁重启通常意味着 OOM Kill 或 CrashLoopBackOff

### 第四步：查询内存使用

1. 查询 container_memory_usage_bytes 和 container_memory_limit_bytes
2. 计算内存使用率 (usage / limit)
3. 内存使用率接近 100% 说明即将或已经 OOM

### 第五步：关联分析并输出结论

1. 综合以上指标，确定故障服务和根因
2. 典型模式：高错误率 + service_up=0 + 频繁重启 + 内存打满 → 内存泄漏导致 OOM
3. 对比正常服务的指标作为基线
4. 提供修复建议`

export interface SeedResult {
  projectId: string
  serviceId: string
  kbId: string
  skillSlug: string
}

async function pushMetrics(metricsText: string): Promise<void> {
  const url = `http://${PUSHGATEWAY_HOST}:${PUSHGATEWAY_PORT}/metrics/job/microservice_monitor`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: metricsText,
  })
  if (!resp.ok) {
    throw new Error(`Failed to push metrics: ${resp.status} ${await resp.text()}`)
  }
}

export async function seed(): Promise<SeedResult> {
  // 1. Push metrics to Pushgateway
  console.log('[1/5] 推送 Prometheus 指标数据...')

  const metrics = `
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{service="payment-service",endpoint="/api/pay",status="500"} 8500
http_requests_total{service="payment-service",endpoint="/api/pay",status="200"} 2000
http_requests_total{service="payment-service",endpoint="/api/refund",status="500"} 450
http_requests_total{service="payment-service",endpoint="/api/refund",status="200"} 100
http_requests_total{service="order-service",endpoint="/api/orders",status="200"} 15000
http_requests_total{service="order-service",endpoint="/api/orders",status="500"} 50
http_requests_total{service="user-service",endpoint="/api/users",status="200"} 12000
http_requests_total{service="user-service",endpoint="/api/users",status="500"} 30

# HELP service_up Service availability (1=up, 0=down)
# TYPE service_up gauge
service_up{service="payment-service"} 0
service_up{service="order-service"} 1
service_up{service="user-service"} 1

# HELP pod_restart_count Pod restart count
# TYPE pod_restart_count counter
pod_restart_count{service="payment-service",pod="payment-service-7f8b9c-x2k4d"} 15
pod_restart_count{service="order-service",pod="order-service-5d6e7f-m3n8p"} 1
pod_restart_count{service="user-service",pod="user-service-3a4b5c-q9w2e"} 0

# HELP container_memory_usage_bytes Container memory usage in bytes
# TYPE container_memory_usage_bytes gauge
container_memory_usage_bytes{service="payment-service",pod="payment-service-7f8b9c-x2k4d"} 4294967296
container_memory_usage_bytes{service="order-service",pod="order-service-5d6e7f-m3n8p"} 536870912
container_memory_usage_bytes{service="user-service",pod="user-service-3a4b5c-q9w2e"} 268435456

# HELP container_memory_limit_bytes Container memory limit in bytes
# TYPE container_memory_limit_bytes gauge
container_memory_limit_bytes{service="payment-service",pod="payment-service-7f8b9c-x2k4d"} 4294967296
container_memory_limit_bytes{service="order-service",pod="order-service-5d6e7f-m3n8p"} 4294967296
container_memory_limit_bytes{service="user-service",pod="user-service-3a4b5c-q9w2e"} 4294967296
`.trim()

  await pushMetrics(metrics)

  // Wait for Prometheus to scrape the metrics
  console.log('  等待 Prometheus 采集指标...')
  await new Promise((r) => setTimeout(r, 10_000))
  console.log('  ✓ 指标数据推送完成')

  // 2. Create Chronos project
  console.log('[2/5] 创建 Chronos 项目...')
  const project = await createProject({
    name: '微服务电商平台监控',
    description: '微服务电商平台 Prometheus 监控，覆盖 payment-service、order-service、user-service 等核心服务',
    tags: ['prometheus', 'monitoring', 'microservice'],
  })
  console.log(`  ✓ 项目已创建: ${project.id}`)

  // 3. Add Prometheus service
  console.log('[3/5] 添加 Prometheus 服务连接...')
  const service = await addService(project.id, {
    name: 'Prometheus 监控',
    type: 'prometheus',
    description: '微服务电商平台 Prometheus 监控系统 (采集所有服务的健康状态、性能指标、资源使用)',
    config: {
      host: PROMETHEUS_HOST,
      port: PROMETHEUS_PORT,
    },
  })
  console.log(`  ✓ Prometheus 服务已添加: ${service.id}`)

  // 4. Upload knowledge
  console.log('[4/5] 上传知识库文档...')
  const kb = await uploadKnowledge(project.id, {
    filePath: path.join(import.meta.dirname, 'knowledge.md'),
    title: '微服务电商平台监控架构文档',
    tags: 'prometheus,monitoring,payment,oom,memory,microservice',
    description: '微服务监控架构、Prometheus 指标说明、服务上下游关系及常见故障排查指南',
  })
  console.log(`  ✓ 知识库文档已上传: ${kb.id}`)

  await waitForKnowledgeReady(project.id, kb.id)
  console.log('  ✓ 文档索引完成')

  // 5. Create skill
  console.log('[5/5] 创建 Prometheus Metrics Analysis Skill...')
  const skill = await createSkill(SKILL_MARKDOWN)
  console.log(`  ✓ Skill 已创建: ${skill.slug}`)

  writeSkillConfig(skill.slug, {
    mcpServers: ['prometheus'],
    applicableServiceTypes: ['prometheus'],
  })

  return {
    projectId: project.id,
    serviceId: service.id,
    kbId: kb.id,
    skillSlug: skill.slug,
  }
}
