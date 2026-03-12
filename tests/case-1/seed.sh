#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHRONOS_API="http://localhost:8000/api"
PG_HOST="localhost"
PG_PORT="15432"
PG_USER="prod"
PG_PASS="prod123"
PG_DB="order_service"
REDIS_PORT="16379"

echo "==> [1/3] 初始化模拟生产 PostgreSQL 数据..."

PGPASSWORD="$PG_PASS" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" <<'SQL'
-- 创建错误日志表
CREATE TABLE IF NOT EXISTS app_errors (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  service VARCHAR(100) NOT NULL,
  level VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  request_id VARCHAR(50)
);

-- 插入模拟错误日志（最近 5 分钟内密集报错）
INSERT INTO app_errors (timestamp, service, level, message, stack_trace, request_id) VALUES
  (now() - interval '5 minutes', 'order-service', 'ERROR', 'Redis connection refused: ECONNREFUSED 127.0.0.1:6379', 'Error: connect ECONNREFUSED 127.0.0.1:6379\n    at TCPConnectWrap.afterConnect [as oncomplete]', 'req-a1b2c3'),
  (now() - interval '4 minutes', 'order-service', 'ERROR', 'Failed to read rate_limit config from Redis: ReplyError: WRONGTYPE Operation against a key holding the wrong kind of value', 'ReplyError: WRONGTYPE Operation against a key holding the wrong kind of value\n    at parseError (node_modules/redis-parser/lib/parser.js:179:12)', 'req-d4e5f6'),
  (now() - interval '3 minutes', 'order-service', 'ERROR', 'Rate limiter fallback triggered - using default config. Potential service degradation.', NULL, 'req-g7h8i9'),
  (now() - interval '3 minutes', 'order-service', 'WARN',  'Order creation latency exceeded 5000ms threshold (actual: 12340ms)', NULL, 'req-j0k1l2'),
  (now() - interval '2 minutes', 'order-service', 'ERROR', 'Failed to read rate_limit config from Redis: ReplyError: WRONGTYPE Operation against a key holding the wrong kind of value', 'ReplyError: WRONGTYPE Operation against a key holding the wrong kind of value\n    at parseError (node_modules/redis-parser/lib/parser.js:179:12)', 'req-m3n4o5'),
  (now() - interval '1 minute',  'order-service', 'ERROR', 'Circuit breaker OPEN for redis-config-reader after 5 consecutive failures', NULL, 'req-p6q7r8'),
  (now() - interval '30 seconds','order-service', 'CRITICAL','Health check failed: order-service unhealthy - redis dependency down', NULL, 'req-s9t0u1');
SQL

echo "    -> app_errors 表已创建，已插入 7 条错误日志"

echo "==> [2/3] 写入损坏的 Redis key..."

# 正确的值应该是字符串 '{"max_requests":100,"window_seconds":60}'
# 故意写成一个 hash 类型，导致 GET 操作报 WRONGTYPE 错误
redis-cli -p "$REDIS_PORT" DEL "config:order-service:rate_limit" > /dev/null 2>&1 || true
redis-cli -p "$REDIS_PORT" HSET "config:order-service:rate_limit" "max_requests" "100" "window_seconds" "60" > /dev/null

# 写入一些正常的 key 作为对比
redis-cli -p "$REDIS_PORT" SET "config:order-service:db_pool_size" "20" > /dev/null
redis-cli -p "$REDIS_PORT" SET "config:order-service:timeout_ms" "5000" > /dev/null
redis-cli -p "$REDIS_PORT" SET "config:user-service:rate_limit" '{"max_requests":200,"window_seconds":60}' > /dev/null

echo "    -> 已写入损坏的 rate_limit key (hash 类型，应为 string)"

echo "==> [3/3] 向 Chronos 写入种子数据 (Project + Services + Skill)..."

# 1. 创建项目
PROJECT_RESPONSE=$(curl -s -X POST "$CHRONOS_API/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "订单系统",
    "description": "模拟生产订单系统，用于 case-1 故障诊断演示"
  }')

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.data.id // empty')
if [ -z "$PROJECT_ID" ]; then
  echo "    -> ERROR: 项目创建失败"
  echo "$PROJECT_RESPONSE"
  exit 1
fi
echo "    -> 项目创建成功: $PROJECT_ID"

# 2. 添加 PostgreSQL 服务
PG_SERVICE_RESPONSE=$(curl -s -X POST "$CHRONOS_API/projects/$PROJECT_ID/services" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"生产数据库\",
    \"type\": \"postgresql\",
    \"config\": {
      \"host\": \"$PG_HOST\",
      \"port\": $PG_PORT,
      \"username\": \"$PG_USER\",
      \"password\": \"$PG_PASS\",
      \"database\": \"$PG_DB\"
    }
  }")

PG_SERVICE_ID=$(echo "$PG_SERVICE_RESPONSE" | jq -r '.data.id // empty')
if [ -z "$PG_SERVICE_ID" ]; then
  echo "    -> ERROR: PostgreSQL 服务创建失败"
  echo "$PG_SERVICE_RESPONSE"
  exit 1
fi
echo "    -> PostgreSQL 服务创建成功: $PG_SERVICE_ID"

# 3. 添加 Redis 服务
REDIS_SERVICE_RESPONSE=$(curl -s -X POST "$CHRONOS_API/projects/$PROJECT_ID/services" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"生产 Redis\",
    \"type\": \"redis\",
    \"config\": {
      \"host\": \"localhost\",
      \"port\": $REDIS_PORT
    }
  }")

REDIS_SERVICE_ID=$(echo "$REDIS_SERVICE_RESPONSE" | jq -r '.data.id // empty')
if [ -z "$REDIS_SERVICE_ID" ]; then
  echo "    -> ERROR: Redis 服务创建失败"
  echo "$REDIS_SERVICE_RESPONSE"
  exit 1
fi
echo "    -> Redis 服务创建成功: $REDIS_SERVICE_ID"

# 4. 创建 Skill
SKILL_RESPONSE=$(curl -s -X POST "$CHRONOS_API/skills" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "redis-config-diagnosis",
    "name": "Redis 配置键值诊断",
    "description": "诊断和修复 Redis 配置键值类型错误和数据格式问题",
    "methodology": "## Redis 配置键值诊断方法论\n\n### 诊断步骤\n\n1. **KEY 类型检查** - 使用 TYPE 命令验证 Redis key 的类型\n   - 配置键通常应为 string 类型\n   - hash/list/set 类型表示可能有格式错误\n\n2. **值内容验证** - 使用 GET/HGETALL 等命令读取值\n   - 验证 JSON 格式是否正确\n   - 检查必要字段是否齐全\n\n3. **应用日志查询** - 检查错误日志中的 WRONGTYPE 错误\n   - 错误堆栈可能指向具体的配置键\n   - 记录问题发生的时间范围\n\n### 修复步骤\n\n1. **备份现有数据** - 如果 hash/list 中有有效数据，先 HGETALL/LRANGE 备份\n2. **删除错误类型的 key** - DEL key\n3. **写入正确类型的 key** - SET key 正确的 JSON 字符串\n4. **验证修复** - 确认应用能正确读取新的 key\n\n### 常见问题\n\n- **config:order-service:rate_limit**: 应为 `{\\\"max_requests\\\": 100, \\\"window_seconds\\\": 60}` 格式的 string\n- **WRONGTYPE Operation**: 表示操作与 key 的实际类型不匹配\n",
    "applicableServiceTypes": ["redis", "postgresql"]
  }')

SKILL_SLUG=$(echo "$SKILL_RESPONSE" | jq -r '.data.slug // empty')
if [ -z "$SKILL_SLUG" ]; then
  echo "    -> ERROR: Skill 创建失败"
  echo "$SKILL_RESPONSE"
  exit 1
fi
echo "    -> Skill 创建成功: $SKILL_SLUG"

echo ""
echo "=== 种子数据初始化完成 ==="
echo ""
echo "模拟故障概要："
echo "  - 生产 PostgreSQL (localhost:$PG_PORT): app_errors 表中有 7 条错误日志"
echo "  - 生产 Redis (localhost:$REDIS_PORT): config:order-service:rate_limit 类型错误 (hash, 应为 string)"
echo ""
echo "Chronos 平台数据："
echo "  - 项目: 订单系统 ($PROJECT_ID)"
echo "  - 服务: 生产数据库 ($PG_SERVICE_ID), 生产 Redis ($REDIS_SERVICE_ID)"
echo "  - Skill: Redis 配置键值诊断 ($SKILL_SLUG)"
echo ""
echo "下一步: bash trigger.sh 触发告警事件"
