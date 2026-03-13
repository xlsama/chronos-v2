import mysql from 'mysql2/promise'
import path from 'node:path'
import {
  createProject,
  addService,
  uploadKnowledge,
  waitForKnowledgeReady,
  createSkill,
} from '../helpers/chronos-api'

const MYSQL_HOST = process.env.MYSQL_HOST ?? '127.0.0.1'
const MYSQL_PORT = Number(process.env.MYSQL_PORT ?? 33307)
const MYSQL_USER = 'promotion'
const MYSQL_PASSWORD = 'promo123'
const MYSQL_DATABASE = 'promotion_service'

const SKILL_MARKDOWN = `---
name: "MySQL Promotion Diagnosis"
description: "诊断 MySQL 优惠券促销服务异常，包括优惠券过期日期错误、核销失败、数据不一致问题"
mcpServers:
  - mysql
applicableServiceTypes:
  - mysql
riskLevel: read-only
---

# MySQL 优惠券促销诊断方法论

## 适用场景

当接到与优惠券核销失败相关的告警时，使用本诊断方法论进行系统化排查。常见场景包括：优惠券过期日期异常、核销被拒、批次数据与优惠券数据不一致等。

## 诊断步骤

### 第一步：检查优惠券过期日期

1. 查询 coupons 表中状态为 available 的优惠券
2. 检查 expire_date 是否存在早于当前日期的异常记录
3. 重点关注近期有核销失败记录的优惠券

### 第二步：关联批次信息

1. 通过 batch_id 关联 coupon_batches 表
2. 对比批次级 expire_date 和优惠券级 expire_date
3. 找出不一致的记录

### 第三步：检查核销日志

1. 查询 redemption_logs 表中 result='failure' 的记录
2. 重点关注 failure_reason='coupon_expired' 的记录
3. 分析失败的时间线和影响范围

### 第四步：检查应用错误日志

1. 查询 app_errors 表中相关的错误信息
2. 按时间排序，了解故障发生的时间线
3. 关注 critical 级别的错误

### 第五步：输出诊断结论

1. 总结根因（如：批量更新脚本将 expire_date 误设为过去日期）
2. 列出受影响的优惠券数量和批次
3. 提供修复建议（如：将受影响优惠券的 expire_date 更新为批次的过期日期）`

export interface SeedResult {
  projectId: string
  serviceId: string
  kbId: string
  skillSlug: string
}

export async function seed(): Promise<SeedResult> {
  // 1. Populate MySQL with fault data
  console.log('[1/5] 初始化 MySQL 数据...')
  const conn = await mysql.createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    multipleStatements: true,
  })

  // Create tables
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS coupon_batches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      batch_code VARCHAR(50) UNIQUE NOT NULL,
      campaign_name VARCHAR(100) NOT NULL,
      discount_type ENUM('percentage','fixed') NOT NULL,
      discount_value DECIMAL(10,2) NOT NULL,
      total_count INT NOT NULL,
      expire_date DATE NOT NULL,
      status ENUM('active','expired','cancelled') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS coupons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coupon_code VARCHAR(50) UNIQUE NOT NULL,
      batch_id INT NOT NULL,
      user_id INT NOT NULL,
      status ENUM('available','used','expired','cancelled') NOT NULL DEFAULT 'available',
      expire_date DATE NOT NULL,
      used_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES coupon_batches(id)
    )
  `)

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS redemption_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coupon_id INT NOT NULL,
      coupon_code VARCHAR(50) NOT NULL,
      user_id INT NOT NULL,
      order_id VARCHAR(50) NOT NULL,
      action ENUM('redeem','validate','reject') NOT NULL,
      result ENUM('success','failure') NOT NULL,
      failure_reason VARCHAR(200) NULL,
      attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS app_errors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      service VARCHAR(50) NOT NULL,
      level ENUM('warn','error','critical') NOT NULL,
      message TEXT NOT NULL,
      context JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Seed coupon_batches (3 batches)
  await conn.execute(`
    INSERT INTO coupon_batches (batch_code, campaign_name, discount_type, discount_value, total_count, expire_date, status) VALUES
    ('SPRING2026', '春季大促 2026', 'percentage', 15.00, 5, '2026-06-30', 'active'),
    ('WELCOME2026', '新用户欢迎礼', 'fixed', 10.00, 5, '2026-12-31', 'active'),
    ('FLASH20260301', '3月限时闪购', 'percentage', 20.00, 5, '2026-03-31', 'active')
  `)

  // Seed coupons (15 total, 5 per batch)
  // SPRING2026 batch (id=1): 5 coupons with WRONG expire_date = '2025-01-01' ❌
  await conn.execute(`
    INSERT INTO coupons (coupon_code, batch_id, user_id, status, expire_date) VALUES
    ('SPR-001', 1, 1001, 'available', '2025-01-01'),
    ('SPR-002', 1, 1002, 'available', '2025-01-01'),
    ('SPR-003', 1, 1003, 'available', '2025-01-01'),
    ('SPR-004', 1, 1004, 'available', '2025-01-01'),
    ('SPR-005', 1, 1005, 'available', '2025-01-01')
  `)

  // WELCOME2026 batch (id=2): 5 coupons with correct expire_date
  await conn.execute(`
    INSERT INTO coupons (coupon_code, batch_id, user_id, status, expire_date) VALUES
    ('WEL-001', 2, 1006, 'available', '2026-12-31'),
    ('WEL-002', 2, 1007, 'available', '2026-12-31'),
    ('WEL-003', 2, 1008, 'used', '2026-12-31'),
    ('WEL-004', 2, 1009, 'available', '2026-12-31'),
    ('WEL-005', 2, 1010, 'available', '2026-12-31')
  `)

  // FLASH20260301 batch (id=3): 5 coupons with correct expire_date
  await conn.execute(`
    INSERT INTO coupons (coupon_code, batch_id, user_id, status, expire_date) VALUES
    ('FLS-001', 3, 1011, 'used', '2026-03-31'),
    ('FLS-002', 3, 1012, 'available', '2026-03-31'),
    ('FLS-003', 3, 1013, 'available', '2026-03-31'),
    ('FLS-004', 3, 1014, 'used', '2026-03-31'),
    ('FLS-005', 3, 1015, 'available', '2026-03-31')
  `)

  // Seed redemption_logs (10 records, 4 with failure_reason='coupon_expired')
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')

  await conn.execute(`
    INSERT INTO redemption_logs (coupon_id, coupon_code, user_id, order_id, action, result, failure_reason, attempted_at) VALUES
    (1,  'SPR-001', 1001, 'ORD-20260310-001', 'redeem', 'failure', 'coupon_expired', '${fmt(new Date(now.getTime() - 45 * 60_000))}'),
    (2,  'SPR-002', 1002, 'ORD-20260310-002', 'validate', 'failure', 'coupon_expired', '${fmt(new Date(now.getTime() - 38 * 60_000))}'),
    (3,  'SPR-003', 1003, 'ORD-20260310-003', 'redeem', 'failure', 'coupon_expired', '${fmt(new Date(now.getTime() - 30 * 60_000))}'),
    (8,  'WEL-003', 1008, 'ORD-20260310-004', 'redeem', 'success', NULL, '${fmt(new Date(now.getTime() - 25 * 60_000))}'),
    (11, 'FLS-001', 1011, 'ORD-20260310-005', 'redeem', 'success', NULL, '${fmt(new Date(now.getTime() - 22 * 60_000))}'),
    (4,  'SPR-004', 1004, 'ORD-20260310-006', 'redeem', 'failure', 'coupon_expired', '${fmt(new Date(now.getTime() - 18 * 60_000))}'),
    (14, 'FLS-004', 1014, 'ORD-20260310-007', 'redeem', 'success', NULL, '${fmt(new Date(now.getTime() - 15 * 60_000))}'),
    (9,  'WEL-004', 1009, 'ORD-20260310-008', 'validate', 'success', NULL, '${fmt(new Date(now.getTime() - 12 * 60_000))}'),
    (12, 'FLS-002', 1012, 'ORD-20260310-009', 'validate', 'success', NULL, '${fmt(new Date(now.getTime() - 8 * 60_000))}'),
    (5,  'SPR-005', 1005, 'ORD-20260310-010', 'redeem', 'success', NULL, '${fmt(new Date(now.getTime() - 5 * 60_000))}')
  `)

  // Seed app_errors (6 records)
  await conn.execute(`
    INSERT INTO app_errors (service, level, message, context, created_at) VALUES
    ('coupon-service', 'error', 'Coupon validation failed: coupon SPR-001 has expired (expire_date=2025-01-01)', '{"coupon_code":"SPR-001","user_id":1001,"batch_code":"SPRING2026"}', '${fmt(new Date(now.getTime() - 45 * 60_000))}'),
    ('coupon-service', 'error', 'Coupon validation failed: coupon SPR-002 has expired (expire_date=2025-01-01)', '{"coupon_code":"SPR-002","user_id":1002,"batch_code":"SPRING2026"}', '${fmt(new Date(now.getTime() - 38 * 60_000))}'),
    ('order-service', 'warn', 'Order checkout failed: coupon redemption rejected for order ORD-20260310-003', '{"order_id":"ORD-20260310-003","coupon_code":"SPR-003"}', '${fmt(new Date(now.getTime() - 30 * 60_000))}'),
    ('coupon-service', 'error', 'Coupon validation failed: coupon SPR-004 has expired (expire_date=2025-01-01)', '{"coupon_code":"SPR-004","user_id":1004,"batch_code":"SPRING2026"}', '${fmt(new Date(now.getTime() - 18 * 60_000))}'),
    ('crm-service', 'warn', 'Customer complaint received: user 1001 reports valid coupon rejected as expired', '{"user_id":1001,"coupon_code":"SPR-001","complaint_id":"CMP-0042"}', '${fmt(new Date(now.getTime() - 10 * 60_000))}'),
    ('coupon-service', 'critical', 'Multiple coupon expiry validation failures detected for batch SPRING2026. 4 failures in last 60 minutes.', '{"batch_code":"SPRING2026","failure_count":4,"affected_coupons":["SPR-001","SPR-002","SPR-003","SPR-004"]}', '${fmt(new Date(now.getTime() - 5 * 60_000))}')
  `)

  await conn.end()
  console.log('  ✓ MySQL 数据初始化完成')

  // 2. Create Chronos project
  console.log('[2/5] 创建 Chronos 项目...')
  const project = await createProject({
    name: '优惠券促销服务',
    description: '电商促销平台优惠券服务，负责优惠券的创建、发放、核销和统计，数据存储于 MySQL',
    tags: ['coupon', 'promotion', 'mysql'],
  })
  console.log(`  ✓ 项目已创建: ${project.id}`)

  // 3. Add MySQL service
  console.log('[3/5] 添加 MySQL 服务连接...')
  const service = await addService(project.id, {
    name: '促销服务 MySQL',
    type: 'mysql',
    description: '优惠券促销服务数据库 (存储批次、优惠券、核销日志、错误日志)',
    config: {
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE,
    },
  })
  console.log(`  ✓ MySQL 服务已添加: ${service.id}`)

  // 4. Upload knowledge
  console.log('[4/5] 上传知识库文档...')
  const kb = await uploadKnowledge(project.id, {
    filePath: path.join(import.meta.dirname, 'knowledge.md'),
    title: '优惠券促销服务架构文档',
    tags: 'coupon,promotion,mysql,expire,核销',
    description: '优惠券服务表结构、核销流程、服务上下游关系及常见故障排查指南',
  })
  console.log(`  ✓ 知识库文档已上传: ${kb.id}`)

  await waitForKnowledgeReady(project.id, kb.id)
  console.log('  ✓ 文档索引完成')

  // 5. Create skill
  console.log('[5/5] 创建 MySQL Promotion Diagnosis Skill...')
  const skill = await createSkill(SKILL_MARKDOWN)
  console.log(`  ✓ Skill 已创建: ${skill.slug}`)

  return {
    projectId: project.id,
    serviceId: service.id,
    kbId: kb.id,
    skillSlug: skill.slug,
  }
}
