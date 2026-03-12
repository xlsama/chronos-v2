#!/usr/bin/env bash
set -euo pipefail

CHRONOS_API="http://localhost:8000/api"
PG_HOST="localhost"
PG_PORT="25432"
PG_USER="prod"
PG_PASS="prod123"
PG_DB="platform_logs"
MYSQL_HOST="127.0.0.1"
MYSQL_PORT="23306"
MYSQL_USER="payment"
MYSQL_PASS="payment123"
MYSQL_DB="payment_db"
ES_URL="http://localhost:29200"
REDIS_PORT="26379"

echo "==> [1/5] 初始化模拟生产 PostgreSQL 数据 (平台错误日志)..."

PGPASSWORD="$PG_PASS" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" <<'SQL'
CREATE TABLE IF NOT EXISTS app_errors (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  service VARCHAR(100) NOT NULL,
  level VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  request_id VARCHAR(50)
);

INSERT INTO app_errors (timestamp, service, level, message, stack_trace, request_id) VALUES
  (now() - interval '8 minutes', 'log-ingestor', 'ERROR',
   'Elasticsearch bulk index failed: ClusterBlockException[blocked by: [FORBIDDEN/12/index read-only / allow delete (api)]]',
   'org.elasticsearch.cluster.block.ClusterBlockException: blocked by: [FORBIDDEN/12/index read-only / allow delete (api)]\n    at org.elasticsearch.cluster.block.ClusterBlocks.indexBlockedException(ClusterBlocks.java:200)',
   'req-es001'),

  (now() - interval '7 minutes', 'log-ingestor', 'ERROR',
   'Pipeline stalled: 0 documents indexed in last 60s, buffer at 98% capacity (49152/50000)',
   NULL, 'req-es002'),

  (now() - interval '6 minutes', 'payment-service', 'ERROR',
   'Fraud detection query timeout after 30000ms: POST /transaction-patterns/_search - ConnectionTimeout',
   'ElasticsearchTimeoutError: ConnectionTimeout\n    at FraudDetectionService.checkTransaction(fraud.js:142)\n    at PaymentProcessor.process(processor.js:89)',
   'req-pay001'),

  (now() - interval '5 minutes', 'payment-service', 'ERROR',
   'Transaction moved to dead_letter_queue: txn_20260311_1001 reason=elasticsearch_timeout',
   NULL, 'req-pay002'),

  (now() - interval '5 minutes', 'payment-service', 'ERROR',
   'Transaction moved to dead_letter_queue: txn_20260311_1002 reason=elasticsearch_timeout',
   NULL, 'req-pay003'),

  (now() - interval '4 minutes', 'payment-service', 'CRITICAL',
   'Circuit breaker OPEN for es-fraud-check after 10 consecutive timeouts. All fraud checks will be rejected.',
   NULL, 'req-pay004'),

  (now() - interval '3 minutes', 'kafka-consumer', 'WARN',
   'Consumer group payment-processor lag exceeded threshold: partition=0 lag=28930 threshold=1000',
   NULL, 'req-kafka001'),

  (now() - interval '2 minutes', 'checkout-service', 'ERROR',
   'Session expired during payment: sess_abc123 - user waited 180s, payment gateway timeout',
   NULL, 'req-chk001'),

  (now() - interval '1 minute', 'checkout-service', 'CRITICAL',
   'Checkout completion rate dropped to 23% (normal: 95%). 77% of sessions failing at payment step.',
   NULL, 'req-chk002'),

  (now() - interval '30 seconds', 'api-gateway', 'ERROR',
   'Upstream health check failed: payment-service returned 503 for 5 consecutive checks. Circuit breaker activated at gateway level.',
   NULL, 'req-gw001');
SQL

echo "    -> app_errors 表已创建，已插入 10 条错误日志"

echo "==> [2/5] 初始化模拟生产 MySQL 数据 (支付业务)..."

mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" <<'SQL'
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CNY',
  status ENUM('pending', 'completed', 'failed', 'dead_letter') NOT NULL,
  fraud_check_status ENUM('passed', 'failed', 'timeout', 'skipped') DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id VARCHAR(50) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  original_payload JSON,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reason (reason),
  INDEX idx_created (created_at)
);

INSERT INTO transactions (id, user_id, amount, status, fraud_check_status) VALUES
  ('txn_20260311_0998', 'user-10', 299.00, 'completed', 'passed'),
  ('txn_20260311_0999', 'user-22', 1580.00, 'completed', 'passed'),
  ('txn_20260311_1000', 'user-35', 89.90, 'completed', 'passed'),
  ('txn_20260311_1001', 'user-42', 2999.00, 'dead_letter', 'timeout'),
  ('txn_20260311_1002', 'user-55', 459.00, 'dead_letter', 'timeout'),
  ('txn_20260311_1003', 'user-18', 1299.00, 'dead_letter', 'timeout'),
  ('txn_20260311_1004', 'user-67', 3500.00, 'dead_letter', 'timeout'),
  ('txn_20260311_1005', 'user-42', 780.00, 'dead_letter', 'timeout');

INSERT INTO dead_letter_queue (transaction_id, reason, original_payload, retry_count) VALUES
  ('txn_20260311_1001', 'elasticsearch_timeout', '{"user_id":"user-42","amount":2999.00,"fraud_check":"timeout_after_30s"}', 3),
  ('txn_20260311_1002', 'elasticsearch_timeout', '{"user_id":"user-55","amount":459.00,"fraud_check":"timeout_after_30s"}', 3),
  ('txn_20260311_1003', 'elasticsearch_timeout', '{"user_id":"user-18","amount":1299.00,"fraud_check":"timeout_after_30s"}', 2),
  ('txn_20260311_1004', 'elasticsearch_timeout', '{"user_id":"user-67","amount":3500.00,"fraud_check":"timeout_after_30s"}', 1),
  ('txn_20260311_1005', 'elasticsearch_timeout', '{"user_id":"user-42","amount":780.00,"fraud_check":"timeout_after_30s"}', 0);
SQL

echo "    -> transactions (8 条) + dead_letter_queue (5 条) 已创建"

echo "==> [3/5] 初始化模拟生产 Elasticsearch 数据..."

# 创建 transaction-patterns 索引并写入少量数据
curl -s -X PUT "$ES_URL/transaction-patterns" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": { "number_of_shards": 1, "number_of_replicas": 0 },
    "mappings": {
      "properties": {
        "user_id": { "type": "keyword" },
        "amount": { "type": "float" },
        "pattern_type": { "type": "keyword" },
        "risk_score": { "type": "float" },
        "timestamp": { "type": "date" }
      }
    }
  }' > /dev/null

curl -s -X POST "$ES_URL/transaction-patterns/_bulk" \
  -H "Content-Type: application/x-ndjson" \
  -d '{"index":{}}
{"user_id":"user-42","amount":2999.00,"pattern_type":"high_value","risk_score":0.3,"timestamp":"2026-03-11T10:00:00Z"}
{"index":{}}
{"user_id":"user-55","amount":459.00,"pattern_type":"normal","risk_score":0.1,"timestamp":"2026-03-11T10:01:00Z"}
{"index":{}}
{"user_id":"user-67","amount":3500.00,"pattern_type":"high_value","risk_score":0.4,"timestamp":"2026-03-11T10:02:00Z"}
' > /dev/null

# 创建 app-logs 索引
curl -s -X PUT "$ES_URL/app-logs-2026.03.11" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": { "number_of_shards": 1, "number_of_replicas": 0 },
    "mappings": {
      "properties": {
        "service": { "type": "keyword" },
        "level": { "type": "keyword" },
        "message": { "type": "text" },
        "timestamp": { "type": "date" }
      }
    }
  }' > /dev/null

# 模拟磁盘满：将两个索引都设为 read_only_allow_delete
curl -s -X PUT "$ES_URL/transaction-patterns/_settings" \
  -H "Content-Type: application/json" \
  -d '{"index.blocks.read_only_allow_delete": true}' > /dev/null

curl -s -X PUT "$ES_URL/app-logs-2026.03.11/_settings" \
  -H "Content-Type: application/json" \
  -d '{"index.blocks.read_only_allow_delete": true}' > /dev/null

echo "    -> transaction-patterns + app-logs 索引已创建并设为 read_only_allow_delete"

echo "==> [4/5] 初始化模拟生产 Redis 数据..."

# 正常会话
redis-cli -p "$REDIS_PORT" SET "session:sess_user10" '{"user_id":"user-10","cart_items":2,"created_at":"2026-03-11T14:00:00Z"}' EX 3600 > /dev/null
redis-cli -p "$REDIS_PORT" SET "session:sess_user22" '{"user_id":"user-22","cart_items":1,"created_at":"2026-03-11T14:05:00Z"}' EX 3600 > /dev/null
redis-cli -p "$REDIS_PORT" SET "session:sess_user35" '{"user_id":"user-35","cart_items":5,"created_at":"2026-03-11T14:10:00Z"}' EX 3600 > /dev/null

# sess_abc123 故意不写 —— 模拟过期的会话

# 卡住的 checkout 锁（user-42 和 user-55 的锁一直没释放）
redis-cli -p "$REDIS_PORT" SET "checkout:lock:user-42" '{"locked_at":"2026-03-11T14:20:00Z","txn_id":"txn_20260311_1001"}' > /dev/null
redis-cli -p "$REDIS_PORT" SET "checkout:lock:user-55" '{"locked_at":"2026-03-11T14:21:00Z","txn_id":"txn_20260311_1002"}' > /dev/null

# 熔断器状态 OPEN
redis-cli -p "$REDIS_PORT" SET "circuit:payment-service:es-fraud" "OPEN" > /dev/null

# 正常的熔断器状态（对比参考）
redis-cli -p "$REDIS_PORT" SET "circuit:payment-service:db" "CLOSED" > /dev/null
redis-cli -p "$REDIS_PORT" SET "circuit:checkout-service:inventory" "CLOSED" > /dev/null

echo "    -> 会话 key、checkout 锁、熔断器状态已写入"

echo "==> [5/5] 向 Chronos 写入种子数据 (Service Map + KB)..."

# Service Map: 电商支付链路服务拓扑 (10 节点 13 边)
curl -s -X POST "$CHRONOS_API/service-maps" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "电商支付链路服务拓扑",
    "description": "电商平台支付链路完整服务拓扑，覆盖 gateway → checkout → payment → 各中间件依赖",
    "graph": {
      "nodes": [
        {"id": "gateway",           "type": "serviceNode", "position": {"x": 400, "y": 0},   "data": {"label": "API Gateway",          "serviceType": "gateway",  "description": "入口网关，负载均衡 + 健康检查"}},
        {"id": "checkout-service",   "type": "serviceNode", "position": {"x": 200, "y": 120}, "data": {"label": "Checkout Service",      "serviceType": "service",  "description": "结算服务，管理购物车会话和支付流程"}},
        {"id": "payment-service",    "type": "serviceNode", "position": {"x": 600, "y": 120}, "data": {"label": "Payment Service",       "serviceType": "service",  "description": "支付服务，处理交易和欺诈检测"}},
        {"id": "log-ingestor",       "type": "serviceNode", "position": {"x": 800, "y": 0},   "data": {"label": "Log Ingestor",          "serviceType": "service",  "description": "日志采集管道，写入 ES 和日志索引"}},
        {"id": "redis",              "type": "serviceNode", "position": {"x": 0,   "y": 250}, "data": {"label": "Redis",                 "serviceType": "cache",    "description": "会话缓存 (session:*) + checkout 锁 (checkout:lock:*) + 熔断器状态 (circuit:*)"}},
        {"id": "mysql",              "type": "serviceNode", "position": {"x": 400, "y": 250}, "data": {"label": "MySQL (payment_db)",    "serviceType": "database", "description": "支付数据库，存储 transactions 和 dead_letter_queue"}},
        {"id": "elasticsearch",      "type": "serviceNode", "position": {"x": 800, "y": 250}, "data": {"label": "Elasticsearch",         "serviceType": "search",   "description": "日志搜索 + 欺诈检测索引 (transaction-patterns)"}},
        {"id": "kafka",              "type": "serviceNode", "position": {"x": 600, "y": 370}, "data": {"label": "Kafka",                 "serviceType": "queue",    "description": "消息队列，payment-processor consumer group"}},
        {"id": "postgres-logs",      "type": "serviceNode", "position": {"x": 200, "y": 370}, "data": {"label": "PostgreSQL (logs)",     "serviceType": "database", "description": "平台错误日志 DB (app_errors 表)"}},
        {"id": "payment-gateway-ext","type": "serviceNode", "position": {"x": 600, "y": 0},   "data": {"label": "Payment Gateway (ext)", "serviceType": "external", "description": "第三方支付网关 (微信/支付宝)"}}
      ],
      "edges": [
        {"id": "e1",  "source": "gateway",         "target": "checkout-service",   "label": "HTTP /api/checkout",        "data": {"relationType": "calls", "protocol": "http", "critical": true}},
        {"id": "e2",  "source": "gateway",         "target": "payment-service",    "label": "HTTP /api/payments",        "data": {"relationType": "calls", "protocol": "http", "critical": true}},
        {"id": "e3",  "source": "checkout-service", "target": "redis",             "label": "会话读写 + checkout 锁",    "data": {"relationType": "reads-from", "protocol": "redis"}},
        {"id": "e4",  "source": "checkout-service", "target": "payment-service",   "label": "发起支付请求",              "data": {"relationType": "calls", "protocol": "http", "critical": true}},
        {"id": "e5",  "source": "payment-service",  "target": "elasticsearch",     "label": "欺诈检测查询",              "data": {"relationType": "reads-from", "protocol": "http", "critical": true}},
        {"id": "e6",  "source": "payment-service",  "target": "mysql",             "label": "交易记录 CRUD",             "data": {"relationType": "writes-to", "protocol": "sql", "critical": true}},
        {"id": "e7",  "source": "payment-service",  "target": "kafka",             "label": "发布支付事件",              "data": {"relationType": "publishes", "protocol": "kafka"}},
        {"id": "e8",  "source": "payment-service",  "target": "redis",             "label": "熔断器状态读写",            "data": {"relationType": "reads-from", "protocol": "redis"}},
        {"id": "e9",  "source": "payment-service",  "target": "payment-gateway-ext","label": "支付请求",                 "data": {"relationType": "calls", "protocol": "http", "critical": true}},
        {"id": "e10", "source": "kafka",            "target": "mysql",             "label": "consumer 写入 dead_letter", "data": {"relationType": "writes-to", "protocol": "sql"}},
        {"id": "e11", "source": "log-ingestor",     "target": "elasticsearch",     "label": "批量写入日志",              "data": {"relationType": "writes-to", "protocol": "http", "critical": true}},
        {"id": "e12", "source": "gateway",          "target": "postgres-logs",     "label": "错误日志写入",              "data": {"relationType": "writes-to", "protocol": "sql"}},
        {"id": "e13", "source": "payment-service",  "target": "postgres-logs",     "label": "错误日志写入",              "data": {"relationType": "writes-to", "protocol": "sql"}}
      ]
    }
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"    -> Service Map 创建成功: {d['data']['id']}\")" 2>/dev/null || echo "    -> Service Map 创建失败"

# KB Project: 电商平台架构 + 支付链路架构说明文档
echo "    创建知识库项目..."
KB_PROJECT_RESPONSE=$(curl -s -X POST "$CHRONOS_API/kb/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "电商平台架构",
    "description": "电商平台技术架构文档，包含服务依赖、部署架构、告警阈值等",
    "tags": ["电商", "支付", "架构"]
  }')

KB_PROJECT_ID=$(echo "$KB_PROJECT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

if [ -n "$KB_PROJECT_ID" ] && [ "$KB_PROJECT_ID" != "" ]; then
  echo "    -> KB 项目创建成功: $KB_PROJECT_ID"

  # 创建文档: 支付链路架构说明
  curl -s -X POST "$CHRONOS_API/kb/projects/$KB_PROJECT_ID/documents" \
    -H "Content-Type: application/json" \
    -d '{
      "title": "支付链路架构说明",
      "content": "# 支付链路架构说明\n\n## 服务拓扑\n\n### 核心链路\n```\nAPI Gateway → Checkout Service → Payment Service → Payment Gateway (ext)\n```\n\n### 数据存储\n- **Redis** (会话Redis): 会话缓存 (`session:{session_id}`)、checkout 分布式锁 (`checkout:lock:{user_id}`)、熔断器状态 (`circuit:{service}:{dependency}`)\n- **MySQL** (支付数据库/payment_db): 交易记录 (`transactions` 表)、死信队列 (`dead_letter_queue` 表)\n- **Elasticsearch** (日志ES集群): 交易模式索引 (`transaction-patterns`)、应用日志 (`app-logs-{date}`)\n- **PostgreSQL** (生产日志数据库/platform_logs): 平台错误日志 (`app_errors` 表)\n- **Kafka**: 支付事件流，consumer group = `payment-processor`\n\n## MCP 连接前缀\n通过 Chronos MCP 查询时使用以下连接名称作为前缀:\n- PostgreSQL 错误日志 → `生产日志数据库`\n- MySQL 支付数据 → `支付数据库`\n- ES 索引查询 → `日志ES集群`\n- Redis 缓存/锁 → `会话Redis`\n\n## Key 格式\n- 会话: `session:{session_id}` (string, JSON, TTL 3600s)\n- Checkout 锁: `checkout:lock:{user_id}` (string, JSON, 支付完成后自动释放)\n- 熔断器: `circuit:{service}:{dependency}` (string, OPEN/CLOSED/HALF_OPEN)\n\n## 告警阈值\n- Checkout 完成率 < 90% → P2, < 80% → P1\n- Kafka consumer lag > 1000 → P2, > 10000 → P1\n- ES cluster health = red → P1\n- dead_letter_queue 积压 > 100 → P2, > 1000 → P1\n- 熔断器 OPEN → P2\n\n## 级联故障模式\nES 故障时的典型级联路径:\n1. ES 磁盘满 / 集群故障 → 索引 read_only 或查询超时\n2. log-ingestor 写入阻塞\n3. payment-service 欺诈检测查询超时 → 交易进入 dead_letter_queue\n4. Kafka consumer lag 飙升\n5. checkout-service 会话超时 → 完成率骤降\n6. API Gateway 健康检查失败 → 503"
    }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"    -> KB 文档创建成功: {d['data']['id']}\")" 2>/dev/null || echo "    -> KB 文档创建失败"
else
  echo "    -> KB 项目创建失败（Chronos 后端是否已启动？）"
fi

echo ""
echo "=== 种子数据初始化完成 ==="
echo ""
echo "模拟故障概要："
echo "  - 生产 PostgreSQL (localhost:$PG_PORT): app_errors 表中有 10 条错误日志（ES→支付→结算级联）"
echo "  - 生产 MySQL (localhost:$MYSQL_PORT): 8 条交易（5 条 dead_letter）+ 5 条死信队列记录"
echo "  - 生产 ES (localhost:29200): transaction-patterns + app-logs 索引被设为 read_only"
echo "  - 生产 Redis (localhost:$REDIS_PORT): 熔断器 OPEN + 2 个 checkout 锁卡住"
echo ""
echo "下一步: 在 Chronos 前端添加 4 个连接（详见 README.md Step 3）"
