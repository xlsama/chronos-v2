import mysql from 'mysql2/promise'
import path from 'node:path'
import {
  createProject,
  addService,
  uploadKnowledge,
  waitForKnowledgeReady,
} from '../helpers/chronos-api'

const MYSQL_HOST = process.env.MYSQL_HOST ?? '127.0.0.1'
const MYSQL_PORT = Number(process.env.MYSQL_PORT ?? 33307)
const MYSQL_USER = 'promotion'
const MYSQL_PASSWORD = 'promo123'
const MYSQL_DATABASE = 'promotion_service'

export interface SeedResult {
  projectId: string
  serviceId: string
  kbId: string
}

export async function seed(): Promise<SeedResult> {
  const runId = Date.now().toString(36)

  console.log('[1/4] 初始化 MySQL 数据...')
  const conn = await mysql.createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    multipleStatements: true,
  })

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

  await conn.execute(`
    INSERT INTO coupon_batches (batch_code, campaign_name, discount_type, discount_value, total_count, expire_date, status) VALUES
    ('SPRING2026', '春季大促 2026', 'percentage', 15.00, 5, '2026-06-30', 'active'),
    ('WELCOME2026', '新用户欢迎礼', 'fixed', 10.00, 5, '2026-12-31', 'active'),
    ('FLASH20260301', '3月限时闪购', 'percentage', 20.00, 5, '2026-03-31', 'active')
  `)

  await conn.execute(`
    INSERT INTO coupons (coupon_code, batch_id, user_id, status, expire_date) VALUES
    ('SPR-001', 1, 1001, 'available', '2025-01-01'),
    ('SPR-002', 1, 1002, 'available', '2025-01-01'),
    ('SPR-003', 1, 1003, 'available', '2025-01-01'),
    ('SPR-004', 1, 1004, 'available', '2025-01-01'),
    ('SPR-005', 1, 1005, 'available', '2025-01-01')
  `)

  await conn.execute(`
    INSERT INTO coupons (coupon_code, batch_id, user_id, status, expire_date) VALUES
    ('WEL-001', 2, 1006, 'available', '2026-12-31'),
    ('WEL-002', 2, 1007, 'available', '2026-12-31'),
    ('WEL-003', 2, 1008, 'used', '2026-12-31'),
    ('WEL-004', 2, 1009, 'available', '2026-12-31'),
    ('WEL-005', 2, 1010, 'available', '2026-12-31')
  `)

  await conn.execute(`
    INSERT INTO coupons (coupon_code, batch_id, user_id, status, expire_date) VALUES
    ('FLS-001', 3, 1011, 'used', '2026-03-31'),
    ('FLS-002', 3, 1012, 'available', '2026-03-31'),
    ('FLS-003', 3, 1013, 'available', '2026-03-31'),
    ('FLS-004', 3, 1014, 'used', '2026-03-31'),
    ('FLS-005', 3, 1015, 'available', '2026-03-31')
  `)

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

  console.log('[2/4] 创建 Chronos 项目...')
  const project = await createProject({
    name: `优惠券促销服务 case2 ${runId}`,
    description: '电商促销平台优惠券服务负责优惠券批次、发放、核销与异常投诉处理。当前故障表现为 SPRING2026 批次在活动有效期内持续报过期。',
    tags: ['coupon', 'promotion', 'mysql'],
  })
  console.log(`  ✓ 项目已创建: ${project.id}`)

  console.log('[3/4] 添加 MySQL 服务连接...')
  const service = await addService(project.id, {
    name: '促销服务 MySQL',
    type: 'mysql',
    description: '优惠券促销服务主数据库，承载活动批次、券明细和交易相关记录。',
    config: {
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE,
    },
    metadata: {
      upstreamServices: ['order-service', 'payment-service', 'crm-service'],
      downstreamServices: ['notification-service', 'analytics-service'],
    },
  })
  console.log(`  ✓ MySQL 服务已添加: ${service.id}`)

  console.log('[4/4] 上传知识库文档...')
  const kb = await uploadKnowledge(project.id, {
    filePath: path.join(import.meta.dirname, 'knowledge.md'),
    title: '优惠券促销服务架构文档',
    tags: 'coupon,promotion,mysql,expire,核销',
    description: '优惠券服务表结构、核销流程、上下游关系和过期日期排查指南。',
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
