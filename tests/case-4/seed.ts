import mysql from 'mysql2/promise'
import path from 'node:path'
import {
  createProject,
  addService,
  uploadKnowledge,
  waitForKnowledgeReady,
} from '../helpers/chronos-api'

const MYSQL_HOST = process.env.MYSQL_HOST ?? '127.0.0.1'
const MYSQL_PORT = Number(process.env.MYSQL_PORT ?? 33306)
const MYSQL_USER = 'root'
const MYSQL_PASSWORD = 'root123'
const MYSQL_DATABASE = 'shop_service'

const SEED_SQL = `
DROP TABLE IF EXISTS app_errors;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;

CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

INSERT INTO categories (name) VALUES ('数码配件'), ('服装鞋包'), ('家居用品');

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category_id INT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

INSERT INTO products (name, category_id, price, stock, status) VALUES
  ('USB-C 数据线', 1, 0.00, 500, 'active'),
  ('蓝牙耳机', 1, 0.00, 200, 'active'),
  ('手机壳', 1, 0.00, 1000, 'active'),
  ('充电宝 10000mAh', 1, 0.00, 300, 'active'),
  ('钢化膜', 1, 0.00, 800, 'active');

INSERT INTO products (name, category_id, price, stock, status) VALUES
  ('运动T恤', 2, 129.00, 150, 'active'),
  ('牛仔裤', 2, 259.00, 100, 'active'),
  ('羽绒服', 2, 899.00, 50, 'active'),
  ('运动鞋', 2, 399.00, 200, 'active'),
  ('棒球帽', 2, 79.00, 300, 'active');

INSERT INTO products (name, category_id, price, stock, status) VALUES
  ('咖啡杯', 3, 49.00, 400, 'active'),
  ('抱枕', 3, 69.00, 250, 'active'),
  ('台灯', 3, 159.00, 100, 'active'),
  ('收纳盒', 3, 39.00, 600, 'active'),
  ('毛巾套装', 3, 89.00, 350, 'active');

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(50) NOT NULL,
  product_id INT NOT NULL,
  user_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

INSERT INTO orders (order_no, product_id, user_id, quantity, unit_price, total, status) VALUES
  ('ORD-20260312-001', 6,  1001, 2, 129.00, 258.00, 'completed'),
  ('ORD-20260312-002', 7,  1002, 1, 259.00, 259.00, 'completed'),
  ('ORD-20260312-003', 11, 1003, 3,  49.00, 147.00, 'completed'),
  ('ORD-20260312-004', 12, 1004, 1,  69.00,  69.00, 'completed'),
  ('ORD-20260312-005', 14, 1005, 2,  39.00,  78.00, 'completed'),
  ('ORD-20260312-006', 8,  1006, 1, 899.00, 899.00, 'completed');

INSERT INTO orders (order_no, product_id, user_id, quantity, unit_price, total, status) VALUES
  ('ORD-20260312-007', 1, 1007, 1, 0.00, 0.00, 'error'),
  ('ORD-20260312-008', 2, 1008, 2, 0.00, 0.00, 'error'),
  ('ORD-20260312-009', 3, 1009, 1, 0.00, 0.00, 'error'),
  ('ORD-20260312-010', 4, 1010, 3, 0.00, 0.00, 'error');

CREATE TABLE app_errors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  service VARCHAR(100) NOT NULL,
  level VARCHAR(20) NOT NULL DEFAULT 'error',
  message TEXT NOT NULL
);

INSERT INTO app_errors (timestamp, service, level, message) VALUES
  (NOW() - INTERVAL 25 MINUTE, 'order-service',    'error',    'order total validation failed: total <= 0, order_no=ORD-20260312-007, product_id=1'),
  (NOW() - INTERVAL 22 MINUTE, 'order-service',    'error',    'order total validation failed: total <= 0, order_no=ORD-20260312-008, product_id=2'),
  (NOW() - INTERVAL 18 MINUTE, 'order-service',    'error',    'order total validation failed: total <= 0, order_no=ORD-20260312-009, product_id=3'),
  (NOW() - INTERVAL 15 MINUTE, 'order-service',    'error',    'order total validation failed: total <= 0, order_no=ORD-20260312-010, product_id=4'),
  (NOW() - INTERVAL 12 MINUTE, 'price-monitor',    'warn',     'price anomaly detected: 5 products in category_id=1 (数码配件) have price=0'),
  (NOW() - INTERVAL 10 MINUTE, 'order-service',    'error',    'batch order validation alert: 4 orders with zero total in last 30 minutes'),
  (NOW() - INTERVAL 8  MINUTE, 'checkout-service', 'error',    'payment gateway rejected: amount must be > 0, order_no=ORD-20260312-009'),
  (NOW() - INTERVAL 5  MINUTE, 'alert-manager',    'critical', 'P2 ALERT: order validation failure rate exceeded threshold (40%), possible pricing data corruption');
`

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

  await conn.query(SEED_SQL)
  await conn.end()
  console.log('  ✓ MySQL 数据初始化完成')

  console.log('[2/4] 创建 Chronos 项目...')
  const project = await createProject({
    name: `电商商品服务 case4 ${runId}`,
    description: '商品服务管理分类、商品和订单数据。当前故障表现为数码配件分类价格被污染为 0，导致零元订单和支付拒绝。',
    tags: ['ecommerce', 'mysql', 'shop'],
  })
  console.log(`  ✓ 项目已创建: ${project.id}`)

  console.log('[3/4] 添加 MySQL 服务连接...')
  const service = await addService(project.id, {
    name: '商品服务 MySQL',
    type: 'mysql',
    description: '商品服务生产数据库，排查入口集中在 categories、products、orders、app_errors 四张表。',
    config: {
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      database: MYSQL_DATABASE,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
    },
    metadata: {
      preferredSkillSlug: 'mysql-data-diagnosis',
      keyTables: ['categories', 'products', 'orders', 'app_errors'],
      suspiciousCategory: '数码配件',
      diagnosticChecks: [
        '先查 products.price <= 0',
        '再关联 categories.name',
        '再查 orders.total <= 0',
        '最后按时间查看 app_errors',
      ],
      upstreamServices: ['admin-console', 'price-monitor'],
      downstreamServices: ['order-service', 'checkout-service'],
    },
  })
  console.log(`  ✓ MySQL 服务已添加: ${service.id}`)

  console.log('[4/4] 上传知识库文档...')
  const kb = await uploadKnowledge(project.id, {
    filePath: path.join(import.meta.dirname, 'knowledge.md'),
    title: '商品服务数据库架构文档',
    tags: 'mysql,shop,database,schema',
    description: '商品服务数据库表结构、价格校验逻辑、订单金额链路和批量 SQL 风险说明。',
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
