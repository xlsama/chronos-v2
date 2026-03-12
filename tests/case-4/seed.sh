#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
API_URL="${CHRONOS_API_URL:-http://localhost:3001}"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-33306}"
MYSQL_USER="root"
MYSQL_PASSWORD="root123"
MYSQL_DATABASE="shop_service"

echo "=== Case 4: MySQL 商品价格异常导致零元订单 ==="
echo ""

# ── 1. 初始化 MySQL 数据 ──────────────────────────────────────────
echo "[1/6] 初始化 MySQL 数据库..."

mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" <<'SQL'
-- 清理已有数据
DROP TABLE IF EXISTS app_errors;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;

-- 分类表
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

INSERT INTO categories (name) VALUES ('数码配件'), ('服装鞋包'), ('家居用品');

-- 商品表
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

-- 数码配件（category_id=1）—— price=0，这是故障数据！
INSERT INTO products (name, category_id, price, stock, status) VALUES
  ('USB-C 数据线', 1, 0.00, 500, 'active'),
  ('蓝牙耳机', 1, 0.00, 200, 'active'),
  ('手机壳', 1, 0.00, 1000, 'active'),
  ('充电宝 10000mAh', 1, 0.00, 300, 'active'),
  ('钢化膜', 1, 0.00, 800, 'active');

-- 服装鞋包（category_id=2）—— 正常价格
INSERT INTO products (name, category_id, price, stock, status) VALUES
  ('运动T恤', 2, 129.00, 150, 'active'),
  ('牛仔裤', 2, 259.00, 100, 'active'),
  ('羽绒服', 2, 899.00, 50, 'active'),
  ('运动鞋', 2, 399.00, 200, 'active'),
  ('棒球帽', 2, 79.00, 300, 'active');

-- 家居用品（category_id=3）—— 正常价格
INSERT INTO products (name, category_id, price, stock, status) VALUES
  ('咖啡杯', 3, 49.00, 400, 'active'),
  ('抱枕', 3, 69.00, 250, 'active'),
  ('台灯', 3, 159.00, 100, 'active'),
  ('收纳盒', 3, 39.00, 600, 'active'),
  ('毛巾套装', 3, 89.00, 350, 'active');

-- 订单表
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

-- 正常订单
INSERT INTO orders (order_no, product_id, user_id, quantity, unit_price, total, status) VALUES
  ('ORD-20260312-001', 6,  1001, 2, 129.00, 258.00, 'completed'),
  ('ORD-20260312-002', 7,  1002, 1, 259.00, 259.00, 'completed'),
  ('ORD-20260312-003', 11, 1003, 3,  49.00, 147.00, 'completed'),
  ('ORD-20260312-004', 12, 1004, 1,  69.00,  69.00, 'completed'),
  ('ORD-20260312-005', 14, 1005, 2,  39.00,  78.00, 'completed'),
  ('ORD-20260312-006', 8,  1006, 1, 899.00, 899.00, 'completed');

-- 异常订单（数码配件分类商品，price=0）
INSERT INTO orders (order_no, product_id, user_id, quantity, unit_price, total, status) VALUES
  ('ORD-20260312-007', 1, 1007, 1, 0.00, 0.00, 'error'),
  ('ORD-20260312-008', 2, 1008, 2, 0.00, 0.00, 'error'),
  ('ORD-20260312-009', 3, 1009, 1, 0.00, 0.00, 'error'),
  ('ORD-20260312-010', 4, 1010, 3, 0.00, 0.00, 'error');

-- 错误日志表
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
SQL

echo "  ✓ MySQL 数据初始化完成"

# ── 2. 创建 Chronos 项目 ─────────────────────────────────────────
echo "[2/6] 创建 Chronos 项目..."

PROJECT_RESP=$(curl -sf -X POST "$API_URL/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "电商商品服务",
    "description": "电商平台商品服务，管理商品、分类、订单数据",
    "tags": ["ecommerce", "mysql", "shop"]
  }')

PROJECT_ID=$(echo "$PROJECT_RESP" | jq -r '.data.id')
echo "  ✓ 项目已创建: $PROJECT_ID"

# ── 3. 添加 MySQL 服务连接 ───────────────────────────────────────
echo "[3/6] 添加 MySQL 服务连接..."

SERVICE_RESP=$(curl -sf -X POST "$API_URL/api/projects/$PROJECT_ID/services" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"商品服务 MySQL\",
    \"type\": \"mysql\",
    \"description\": \"商品服务生产数据库 (shop_service)\",
    \"config\": {
      \"host\": \"$MYSQL_HOST\",
      \"port\": $MYSQL_PORT,
      \"database\": \"$MYSQL_DATABASE\",
      \"user\": \"$MYSQL_USER\",
      \"password\": \"$MYSQL_PASSWORD\"
    }
  }")

SERVICE_ID=$(echo "$SERVICE_RESP" | jq -r '.data.id')
echo "  ✓ MySQL 服务已添加: $SERVICE_ID"

# ── 4. 上传知识库文档 ────────────────────────────────────────────
echo "[4/6] 上传知识库文档..."

KB_RESP=$(curl -sf -X POST "$API_URL/api/projects/$PROJECT_ID/knowledge" \
  -F "file=@$SCRIPT_DIR/knowledge.md" \
  -F "title=商品服务数据库架构文档" \
  -F "tags=mysql,shop,database,schema" \
  -F "description=商品服务 MySQL 数据库表结构说明、字段校验规则、订单计算公式及常见异常排查方法")

KB_ID=$(echo "$KB_RESP" | jq -r '.data.id')
echo "  ✓ 知识库文档已上传: $KB_ID"

# 等待文档索引完成
echo "  等待文档索引..."
for i in $(seq 1 60); do
  STATUS=$(curl -sf "$API_URL/api/projects/$PROJECT_ID/knowledge" | jq -r ".data[] | select(.id == \"$KB_ID\") | .status")
  if [ "$STATUS" = "ready" ]; then
    echo "  ✓ 文档索引完成"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "  ✗ 文档索引超时（60 秒），当前状态: $STATUS"
    exit 1
  fi
  sleep 1
done

# ── 5. 创建 Skill ────────────────────────────────────────────────
echo "[5/6] 创建 MySQL Data Diagnosis Skill..."

SKILL_MARKDOWN='---
name: "MySQL Data Diagnosis"
description: "诊断和分析 MySQL 数据库中的数据异常、配置错误和性能问题"
---

# MySQL 数据诊断方法论

## 适用场景

当接到与 MySQL 数据库相关的告警时，使用本诊断方法论进行系统化排查。常见场景包括：数据异常（价格为零、数量为负）、数据不一致、批量操作导致的数据污染等。

## 诊断步骤

### 第一步：确认异常范围

1. 根据告警信息确定涉及的表和字段
2. 使用 SELECT 查询统计异常记录数量
3. 通过 GROUP BY 分析异常数据的分布特征（按分类、时间段等维度）

### 第二步：查看错误日志

1. 查询 app_errors 表获取相关错误日志
2. 按时间排序，找到问题首次出现的时间点
3. 分析日志中的错误模式和关联服务

### 第三步：关联分析

1. 通过 JOIN 查询关联表，追溯异常数据的来源
2. 检查外键关系是否完整
3. 对比正常数据和异常数据的差异

### 第四步：定位根因

1. 结合异常数据的分布特征和时间线
2. 判断是人为操作错误（批量 SQL）还是系统 bug
3. 确认影响范围和业务影响程度

### 第五步：输出诊断结论

1. 总结根因
2. 列出受影响的数据范围
3. 提供修复建议（如需要数据回滚或修正）'

SKILL_RESP=$(curl -sf -X POST "$API_URL/api/skills" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg md "$SKILL_MARKDOWN" '{ markdown: $md }')")

SKILL_SLUG=$(echo "$SKILL_RESP" | jq -r '.data.slug')
echo "  ✓ Skill 已创建: $SKILL_SLUG"

# 写入 skill.config.json（MCP 配置）
SKILL_CONFIG_DIR="$PROJECT_ROOT/apps/backend/data/skills/$SKILL_SLUG"
mkdir -p "$SKILL_CONFIG_DIR"

cat > "$SKILL_CONFIG_DIR/skill.config.json" <<'JSON'
{
  "mcpServers": ["mysql"],
  "applicableServiceTypes": ["mysql"]
}
JSON

echo "  ✓ skill.config.json 已写入: $SKILL_CONFIG_DIR/skill.config.json"

# ── 6. 保存元数据 ────────────────────────────────────────────────
echo "[6/6] 保存测试元数据..."

cat > "$SCRIPT_DIR/.env" <<EOF
PROJECT_ID=$PROJECT_ID
SERVICE_ID=$SERVICE_ID
KB_ID=$KB_ID
SKILL_SLUG=$SKILL_SLUG
EOF

echo "  ✓ 元数据已保存到 $SCRIPT_DIR/.env"
echo ""
echo "=== Seed 完成 ==="
echo "  项目 ID:  $PROJECT_ID"
echo "  服务 ID:  $SERVICE_ID"
echo "  文档 ID:  $KB_ID"
echo "  Skill:    $SKILL_SLUG"
echo ""
echo "下一步: bash trigger.sh"
