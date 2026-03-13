import path from 'node:path'
import {
  createProject,
  addService,
  uploadKnowledge,
  waitForKnowledgeReady,
  createRunbook,
} from '../helpers/chronos-api'

const PUSHGATEWAY_HOST = process.env.PUSHGATEWAY_HOST ?? '127.0.0.1'
const PUSHGATEWAY_PORT = Number(process.env.PUSHGATEWAY_PORT ?? 39091)
const PROMETHEUS_HOST = process.env.PROMETHEUS_HOST ?? '127.0.0.1'
const PROMETHEUS_PORT = Number(process.env.PROMETHEUS_PORT ?? 39090)

const LIGHT_RUNBOOK = `# Prometheus 服务异常快速排查

## 目标

在 Prometheus 告警场景下，用最少的只读查询确认根因服务，以及它是否存在资源打满或频繁重启。

## 最小顺序

1. 先比较各服务的 200/500 请求量，确认哪个服务错误率最高。
2. 再看该服务的 \`service_up\` 是否为 0。
3. 如果服务不可用，再检查 \`pod_restart_count\` 是否异常升高。
4. 最后对比 \`container_memory_usage_bytes\` 和 \`container_memory_limit_bytes\`，判断是否内存打满。

## 结论模式

- 如果同一服务同时满足「500 错误高、service_up=0、重启次数高、内存接近上限」，优先判断为 OOM 或内存泄漏。
- 如果只有上游报错而目标服务指标正常，继续沿依赖链检查下游。`

export interface SeedResult {
  projectId: string
  serviceId: string
  kbId: string
}

async function pushMetrics(metricsText: string): Promise<void> {
  const url = `http://${PUSHGATEWAY_HOST}:${PUSHGATEWAY_PORT}/metrics/job/microservice_monitor`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
    body: `${metricsText.trim()}\n`,
  })
  if (!resp.ok) {
    throw new Error(`Failed to push metrics: ${resp.status} ${await resp.text()}`)
  }
}

export async function seed(): Promise<SeedResult> {
  const runId = Date.now().toString(36)

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
  console.log('  等待 Prometheus 采集指标...')
  await new Promise((r) => setTimeout(r, 10_000))
  console.log('  ✓ 指标数据推送完成')

  console.log('[2/5] 创建 Chronos 项目...')
  const project = await createProject({
    name: `微服务电商平台监控 case3 ${runId}`,
    description: 'Prometheus 统一监控 payment-service、order-service、user-service 等核心服务。当前故障集中在支付链路与服务资源异常。',
    tags: ['prometheus', 'monitoring', 'microservice'],
  })
  console.log(`  ✓ 项目已创建: ${project.id}`)

  console.log('[3/5] 添加 Prometheus 服务连接...')
  const service = await addService(project.id, {
    name: 'Prometheus 监控',
    type: 'prometheus',
    description: '微服务平台的 Prometheus 监控入口，覆盖支付、订单、用户等核心服务的运行指标。',
    config: {
      host: PROMETHEUS_HOST,
      port: PROMETHEUS_PORT,
    },
    metadata: {
      upstreamServices: ['api-gateway', 'order-service'],
      downstreamServices: ['bank-gateway'],
    },
  })
  console.log(`  ✓ Prometheus 服务已添加: ${service.id}`)

  console.log('[4/5] 上传知识库文档...')
  const kb = await uploadKnowledge(project.id, {
    filePath: path.join(import.meta.dirname, 'knowledge.md'),
    title: '微服务电商平台监控架构文档',
    tags: 'prometheus,monitoring,payment,oom,memory,microservice',
    description: '微服务监控架构、Prometheus 指标说明、服务依赖和常见 OOM 排查线索。',
  })
  console.log(`  ✓ 知识库文档已上传: ${kb.id}`)

  await waitForKnowledgeReady(project.id, kb.id)
  console.log('  ✓ 文档索引完成')

  console.log('[5/5] 创建轻量 Runbook...')
  await createRunbook(project.id, {
    title: 'Prometheus 服务异常快速排查',
    content: LIGHT_RUNBOOK,
    tags: ['prometheus', 'payment-service', 'oom', 'monitoring'],
    description: '仅包含监控型故障的最小排查顺序，不提供场景专属答案。',
    publicationStatus: 'published',
  })
  console.log('  ✓ 轻量 Runbook 已创建')

  return {
    projectId: project.id,
    serviceId: service.id,
    kbId: kb.id,
  }
}
