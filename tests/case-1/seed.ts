import Redis from 'ioredis'
import path from 'node:path'
import {
  createProject,
  addService,
  uploadKnowledge,
  waitForKnowledgeReady,
  createSkill,
} from '../helpers/chronos-api'
import { writeSkillConfig } from '../helpers/skill-config'

const REDIS_HOST = process.env.REDIS_HOST ?? '127.0.0.1'
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 36379)

const SKILL_MARKDOWN = `---
name: "Redis Cache Diagnosis"
description: "诊断 Redis 缓存和配置异常，包括限流配置、功能开关、缓存数据完整性问题"
---

# Redis 缓存诊断方法论

## 适用场景

当接到与 Redis 相关的告警时，使用本诊断方法论进行系统化排查。常见场景包括：限流配置异常（大面积 429）、缓存数据不一致、功能开关误操作等。

## 诊断步骤

### 第一步：枚举相关键

1. 根据告警信息确定需要检查的键模式
2. 使用 \`list\` 工具（pattern 参数）枚举匹配的键
3. 例如：\`list pattern="ratelimit:config:*"\` 查看所有限流配置

### 第二步：逐一读取键值

1. 对枚举到的每个键，使用 \`get\` 工具读取其值
2. 解析 JSON 值，检查关键字段是否正常
3. 对于限流配置，重点检查 \`limit\` 字段是否为 0 或异常低值

### 第三步：检查错误日志

1. 使用 \`list pattern="errorlog:*"\` 枚举错误日志键
2. 逐一 \`get\` 读取错误日志内容
3. 分析错误模式（如 429 错误的时间分布和影响范围）

### 第四步：关联分析

1. 对比正常和异常的配置值，找出差异
2. 结合错误日志的时间线，判断异常发生的时间点
3. 检查功能开关（feature:*）是否有异常状态

### 第五步：输出诊断结论

1. 总结根因（如：限流配置的 limit 被设为 0）
2. 列出受影响的 endpoint 和业务影响
3. 提供修复建议`

export interface SeedResult {
  projectId: string
  serviceId: string
  kbId: string
  skillSlug: string
}

export async function seed(): Promise<SeedResult> {
  // 1. Populate Redis with fault data
  console.log('[1/5] 初始化 Redis 数据...')
  const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, lazyConnect: true })
  await redis.connect()

  await redis.flushdb()

  // Rate limit configs — limit=0 is the fault!
  await redis.set('ratelimit:config:/api/orders', JSON.stringify({ limit: 0, window: 60 }))
  await redis.set('ratelimit:config:/api/products', JSON.stringify({ limit: 0, window: 60 }))
  await redis.set('ratelimit:config:/api/users', JSON.stringify({ limit: 0, window: 60 }))
  // This one is normal
  await redis.set('ratelimit:config:/api/health', JSON.stringify({ limit: 10000, window: 60 }))

  // Feature flags
  await redis.set('feature:maintenance_mode', 'disabled')

  // Error logs (429 Too Many Requests)
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

  // 2. Create Chronos project
  console.log('[2/5] 创建 Chronos 项目...')
  const project = await createProject({
    name: 'API 网关服务',
    description: 'API 网关服务，负责请求路由、身份验证和限流，限流配置存储于 Redis',
    tags: ['gateway', 'redis', 'ratelimit'],
  })
  console.log(`  ✓ 项目已创建: ${project.id}`)

  // 3. Add Redis service
  console.log('[3/5] 添加 Redis 服务连接...')
  const service = await addService(project.id, {
    name: 'API 网关 Redis',
    type: 'redis',
    description: 'API 网关限流配置 Redis (存储限流规则、功能开关、错误日志)',
    config: {
      host: REDIS_HOST,
      port: REDIS_PORT,
    },
  })
  console.log(`  ✓ Redis 服务已添加: ${service.id}`)

  // 4. Upload knowledge
  console.log('[4/5] 上传知识库文档...')
  const kb = await uploadKnowledge(project.id, {
    filePath: path.join(import.meta.dirname, 'knowledge.md'),
    title: 'API 网关限流架构文档',
    tags: 'redis,gateway,ratelimit,rate-limit',
    description: 'API 网关限流架构、Redis 键命名规范、限流逻辑说明及常见故障排查',
  })
  console.log(`  ✓ 知识库文档已上传: ${kb.id}`)

  await waitForKnowledgeReady(project.id, kb.id)
  console.log('  ✓ 文档索引完成')

  // 5. Create skill
  console.log('[5/5] 创建 Redis Cache Diagnosis Skill...')
  const skill = await createSkill(SKILL_MARKDOWN)
  console.log(`  ✓ Skill 已创建: ${skill.slug}`)

  writeSkillConfig(skill.slug, {
    mcpServers: ['redis'],
    applicableServiceTypes: ['redis'],
  })

  return {
    projectId: project.id,
    serviceId: service.id,
    kbId: kb.id,
    skillSlug: skill.slug,
  }
}
