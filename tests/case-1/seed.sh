#!/usr/bin/env bash
set -euo pipefail

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

echo "==> [3/3] 向 Chronos 写入种子数据 (Service Map)..."

# 创建 Service Map: 订单服务拓扑
curl -s -X POST "$CHRONOS_API/service-maps" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "订单系统服务拓扑",
    "description": "订单服务及其依赖的中间件和下游服务拓扑图",
    "graph": {
      "nodes": [
        {"id": "gateway",       "type": "service",    "position": {"x": 250, "y": 0},   "data": {"label": "API Gateway",     "tier": "edge"}},
        {"id": "order-service", "type": "service",    "position": {"x": 250, "y": 120}, "data": {"label": "Order Service",    "tier": "core",  "language": "Node.js", "port": 3000}},
        {"id": "user-service",  "type": "service",    "position": {"x": 500, "y": 120}, "data": {"label": "User Service",     "tier": "core",  "language": "Node.js", "port": 3001}},
        {"id": "redis",         "type": "middleware",  "position": {"x": 100, "y": 250}, "data": {"label": "Redis",            "tier": "infra", "port": 6379, "usage": "配置缓存 + 限流"}},
        {"id": "postgres",      "type": "middleware",  "position": {"x": 400, "y": 250}, "data": {"label": "PostgreSQL",       "tier": "infra", "port": 5432, "database": "order_service"}},
        {"id": "payment",       "type": "external",   "position": {"x": 250, "y": 370}, "data": {"label": "Payment Gateway",  "tier": "external"}}
      ],
      "edges": [
        {"id": "e1", "source": "gateway",       "target": "order-service", "label": "HTTP /api/orders"},
        {"id": "e2", "source": "gateway",       "target": "user-service",  "label": "HTTP /api/users"},
        {"id": "e3", "source": "order-service", "target": "redis",         "label": "读取配置/限流"},
        {"id": "e4", "source": "order-service", "target": "postgres",      "label": "订单 CRUD"},
        {"id": "e5", "source": "order-service", "target": "payment",       "label": "支付请求"},
        {"id": "e6", "source": "user-service",  "target": "redis",         "label": "会话缓存"},
        {"id": "e7", "source": "user-service",  "target": "postgres",      "label": "用户查询"}
      ]
    }
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"    -> Service Map 创建成功: {d['data']['id']}\")" 2>/dev/null || echo "    -> Service Map 创建失败（Chronos 后端是否已启动？）"

echo ""
echo "=== 种子数据初始化完成 ==="
echo ""
echo "模拟故障概要："
echo "  - 生产 PostgreSQL (localhost:$PG_PORT): app_errors 表中有 7 条错误日志"
echo "  - 生产 Redis (localhost:$REDIS_PORT): config:order-service:rate_limit 类型错误 (hash, 应为 string)"
echo ""
echo "下一步: 在 Chronos 前端添加连接（详见 README.md Step 3）"
