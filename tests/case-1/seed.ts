import Redis from 'ioredis'
import path from 'node:path'
import {
  createProject,
  addService,
  uploadKnowledge,
  waitForKnowledgeReady,
} from '../helpers/chronos-api'

const REDIS_HOST = process.env.REDIS_HOST ?? '127.0.0.1'
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 36379)

export interface SeedResult {
  projectId: string
  serviceId: string
  kbId: string
}

export async function seed(): Promise<SeedResult> {
  console.log('[1/4] 初始化 Redis 数据...')
  const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, lazyConnect: true })
  await redis.connect()

  await redis.flushdb()

  await redis.set('ratelimit:config:/api/orders', JSON.stringify({ limit: 0, window: 60 }))
  await redis.set('ratelimit:config:/api/products', JSON.stringify({ limit: 0, window: 60 }))
  await redis.set('ratelimit:config:/api/users', JSON.stringify({ limit: 0, window: 60 }))
  await redis.set('ratelimit:config:/api/health', JSON.stringify({ limit: 10000, window: 60 }))
  await redis.set('feature:maintenance_mode', 'disabled')

  const now = Date.now()
  const errorLogs = [
    { id: 1, timestamp: new Date(now - 25 * 60_000).toISOString(), service: 'api-gateway', level: 'error', endpoint: '/api/orders', message: 'Rate limit exceeded: 429 Too Many Requests, client_ip=10.0.1.15, limit=0, current=1' },
    { id: 2, timestamp: new Date(now - 22 * 60_000).toISOString(), service: 'api-gateway', level: 'error', endpoint: '/api/products', message: 'Rate limit exceeded: 429 Too Many Requests, client_ip=10.0.1.20, limit=0, current=1' },
    { id: 3, timestamp: new Date(now - 18 * 60_000).toISOString(), service: 'api-gateway', level: 'error', endpoint: '/api/users', message: 'Rate limit exceeded: 429 Too Many Requests, client_ip=10.0.1.33, limit=0, current=1' },
    { id: 4, timestamp: new Date(now - 12 * 60_000).toISOString(), service: 'api-gateway', level: 'error', endpoint: '/api/orders', message: 'Rate limit exceeded: 429 Too Many Requests, client_ip=10.0.2.8, limit=0, current=1' },
    { id: 5, timestamp: new Date(now - 5 * 60_000).toISOString(), service: 'alert-manager', level: 'critical', endpoint: '*', message: 'P2 ALERT: API gateway 429 rate exceeded 95% on /api/orders, /api/products, /api/users. Possible rate limit misconfiguration.' },
  ]

  for (const log of errorLogs) {
    await redis.set(`errorlog:${log.id}`, JSON.stringify(log))
  }

  await redis.quit()
  console.log('  ✓ Redis 数据初始化完成')

  console.log('[2/4] 创建 Chronos 项目...')
  const project = await createProject({
    name: 'API 网关服务',
    description: 'API 网关负责请求路由、身份验证和限流，核心限流配置存储于 Redis。当前故障表现为多个核心接口大面积返回 429。',
    tags: ['gateway', 'redis', 'ratelimit'],
  })
  console.log(`  ✓ 项目已创建: ${project.id}`)

  console.log('[3/4] 添加 Redis 服务连接...')
  const service = await addService(project.id, {
    name: 'API 网关 Redis',
    type: 'redis',
    description: 'API 网关限流配置 Redis，保存 ratelimit 配置、功能开关和网关错误日志。',
    config: {
      host: REDIS_HOST,
      port: REDIS_PORT,
    },
    metadata: {
      preferredSkillSlug: 'redis-cache-diagnosis',
      keyPatterns: ['ratelimit:config:*', 'errorlog:*', 'feature:*'],
      normalThresholds: {
        '/api/orders': 1000,
        '/api/products': 2000,
        '/api/users': 500,
        '/api/health': 10000,
      },
      primarySignal: '当 limit=0 时，对应 endpoint 会 100% 返回 429',
      upstreamServices: ['api-gateway', 'alert-manager'],
      downstreamImpact: ['order-service', 'product-service', 'user-service'],
    },
  })
  console.log(`  ✓ Redis 服务已添加: ${service.id}`)

  console.log('[4/4] 上传知识库文档...')
  const kb = await uploadKnowledge(project.id, {
    filePath: path.join(import.meta.dirname, 'knowledge.md'),
    title: 'API 网关限流架构文档',
    tags: 'redis,gateway,ratelimit,rate-limit',
    description: 'API 网关限流架构、Redis 键命名规范、正常阈值和常见故障排查。',
  })
  console.log(`  ✓ 知识库文档已上传: ${kb.id}`)

  await waitForKnowledgeReady(project.id, kb.id)
  console.log('  ✓ 文档索引完成')

  return {
    projectId: project.id,
    serviceId: service.id,
    kbId: kb.id,
  }
}
