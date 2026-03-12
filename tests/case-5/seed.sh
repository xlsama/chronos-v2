#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
API_URL="${CHRONOS_API_URL:-http://localhost:3001}"
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-35432}"
PG_USER="analytics"
PG_PASSWORD="analytics123"
PG_DATABASE="analytics_service"

echo "=== Case 5: PostgreSQL 定时任务异常导致报表数据缺失 ==="
echo ""

# ── 1. 初始化 PostgreSQL 数据 ─────────────────────────────────────
echo "[1/6] 初始化 PostgreSQL 数据库..."

PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" <<'SQL'
-- 清理已有数据
DROP TABLE IF EXISTS app_errors;
DROP TABLE IF EXISTS daily_reports;
DROP TABLE IF EXISTS data_sources;
DROP TABLE IF EXISTS scheduled_jobs;

-- 定时任务表
CREATE TABLE scheduled_jobs (
  id SERIAL PRIMARY KEY,
  job_name VARCHAR(100) NOT NULL,
  cron_expression VARCHAR(50) NOT NULL,
  handler VARCHAR(200) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  run_count INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'idle',
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO scheduled_jobs (job_name, cron_expression, handler, is_enabled, last_run_at, next_run_at, run_count, status, error_message) VALUES
  ('generate_daily_report', '0 2 * * *', 'ReportGenerator.run',  false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days', 127, 'disabled', 'Job disabled by system upgrade at 2026-03-09 03:15:00'),
  ('hourly_data_sync',      '0 * * * *', 'DataSyncer.sync',      true,  NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '30 minutes', 2184, 'idle', NULL),
  ('weekly_cleanup',         '0 3 * * 0', 'DataCleaner.cleanup',  true,  NOW() - INTERVAL '5 days', NOW() + INTERVAL '2 days', 52, 'idle', NULL);

-- 日报数据表
CREATE TABLE daily_reports (
  id SERIAL PRIMARY KEY,
  report_date DATE NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC(15,2) NOT NULL,
  department VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'generated',
  generated_by VARCHAR(50) NOT NULL DEFAULT 'scheduled_job',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3 天前及更早的正常数据
INSERT INTO daily_reports (report_date, metric_name, metric_value, department, status, generated_by) VALUES
  (CURRENT_DATE - 7, 'daily_active_users', 15230.00, '产品部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 7, 'revenue',            892500.00, '销售部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 6, 'daily_active_users', 14890.00, '产品部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 6, 'revenue',            876300.00, '销售部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 5, 'daily_active_users', 15670.00, '产品部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 5, 'revenue',            912100.00, '销售部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 4, 'daily_active_users', 16100.00, '产品部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 4, 'revenue',            945800.00, '销售部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 3, 'daily_active_users', 15890.00, '产品部', 'generated', 'generate_daily_report'),
  (CURRENT_DATE - 3, 'revenue',            923400.00, '销售部', 'generated', 'generate_daily_report');
-- 注意：最近 3 天没有数据！这是故障表现。

-- 数据源表
CREATE TABLE data_sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  connection_info JSONB NOT NULL DEFAULT '{}',
  last_sync_at TIMESTAMP,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'idle',
  record_count INT NOT NULL DEFAULT 0
);

INSERT INTO data_sources (name, source_type, connection_info, last_sync_at, sync_status, record_count) VALUES
  ('用户行为数据库', 'postgresql',    '{"host": "user-db.internal", "database": "user_behavior"}',          NOW() - INTERVAL '1 hour',       'synced', 2850000),
  ('订单数据库',     'mysql',         '{"host": "order-db.internal", "database": "orders"}',                 NOW() - INTERVAL '1 hour',       'synced', 1230000),
  ('日志存储',       'elasticsearch', '{"url": "http://es.internal:9200", "index": "app-logs"}',             NOW() - INTERVAL '45 minutes',   'synced', 58000000);

-- 错误日志表
CREATE TABLE app_errors (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  service VARCHAR(100) NOT NULL,
  level VARCHAR(20) NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  stack_trace TEXT
);

INSERT INTO app_errors (timestamp, service, level, message, stack_trace) VALUES
  (NOW() - INTERVAL '3 days' + INTERVAL '2 hours 5 minutes', 'report-scheduler', 'warn',  'Scheduled job ''generate_daily_report'' skipped: job is disabled', NULL),
  (NOW() - INTERVAL '2 days' + INTERVAL '2 hours 5 minutes', 'report-scheduler', 'warn',  'Scheduled job ''generate_daily_report'' skipped: job is disabled', NULL),
  (NOW() - INTERVAL '1 day'  + INTERVAL '2 hours 5 minutes', 'report-scheduler', 'warn',  'Scheduled job ''generate_daily_report'' skipped: job is disabled', NULL),
  (NOW() - INTERVAL '2 days',                                 'dashboard-api',    'error', 'Report data stale: latest report_date is 3 days old, expected today', 'at DashboardService.checkFreshness (dashboard.js:142)'),
  (NOW() - INTERVAL '1 day',                                  'dashboard-api',    'error', 'Report data stale: latest report_date is 4 days old, expected today', 'at DashboardService.checkFreshness (dashboard.js:142)'),
  (NOW() - INTERVAL '2 hours',                                'bi-gateway',       'error', 'BI dashboard refresh failed: no data for date range 2026-03-10 to 2026-03-12', 'at BIGateway.fetchReports (gateway.js:89)');
SQL

echo "  ✓ PostgreSQL 数据初始化完成"

# ── 2. 创建 Chronos 项目 ─────────────────────────────────────────
echo "[2/6] 创建 Chronos 项目..."

PROJECT_RESP=$(curl -sf -X POST "$API_URL/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "数据分析平台",
    "description": "数据分析平台，负责定时聚合业务数据并生成报表",
    "tags": ["analytics", "postgresql", "bi"]
  }')

PROJECT_ID=$(echo "$PROJECT_RESP" | jq -r '.data.id')
echo "  ✓ 项目已创建: $PROJECT_ID"

# ── 3. 添加 PostgreSQL 服务连接 ──────────────────────────────────
echo "[3/6] 添加 PostgreSQL 服务连接..."

SERVICE_RESP=$(curl -sf -X POST "$API_URL/api/projects/$PROJECT_ID/services" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"分析平台 PostgreSQL\",
    \"type\": \"postgresql\",
    \"description\": \"数据分析平台生产数据库 (analytics_service)\",
    \"config\": {
      \"host\": \"$PG_HOST\",
      \"port\": $PG_PORT,
      \"database\": \"$PG_DATABASE\",
      \"username\": \"$PG_USER\",
      \"password\": \"$PG_PASSWORD\"
    }
  }")

SERVICE_ID=$(echo "$SERVICE_RESP" | jq -r '.data.id')
echo "  ✓ PostgreSQL 服务已添加: $SERVICE_ID"

# ── 4. 上传知识库文档 ────────────────────────────────────────────
echo "[4/6] 上传知识库文档..."

KB_RESP=$(curl -sf -X POST "$API_URL/api/projects/$PROJECT_ID/knowledge" \
  -F "file=@$SCRIPT_DIR/knowledge.md" \
  -F "title=数据分析平台报表架构文档" \
  -F "tags=postgresql,analytics,report,scheduled-job" \
  -F "description=数据分析平台报表架构、定时任务配置、数据源管理及常见问题排查")

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
echo "[5/6] 创建 PostgreSQL Ops Diagnosis Skill..."

SKILL_MARKDOWN='---
name: "PostgreSQL Ops Diagnosis"
description: "诊断 PostgreSQL 数据库中的运维问题，包括定时任务、数据一致性和配置异常"
---

# PostgreSQL 运维诊断方法论

## 适用场景

当接到与 PostgreSQL 数据库相关的运维告警时，使用本方法论进行系统化排查。常见场景包括：定时任务不执行、数据缺失、配置被意外修改、同步延迟等。

## 诊断步骤

### 第一步：确认数据缺失范围

1. 查询目标数据表，确认最近一条有效数据的时间
2. 与预期的更新频率对比，判断缺失了多长时间的数据
3. 通过 COUNT 和 GROUP BY 统计各时间段的数据量

### 第二步：检查定时任务状态

1. 查询 scheduled_jobs 表，获取所有任务的状态
2. 重点关注 is_enabled 字段 —— false 表示任务被禁用
3. 查看 last_run_at 判断任务最后一次成功执行的时间
4. 检查 error_message 字段获取禁用或失败原因

### 第三步：查看错误日志

1. 查询 app_errors 表，筛选相关服务的日志
2. 按时间排序，追溯问题首次出现的时间
3. 关注 "job is disabled"、"skipped"、"stale data" 等关键词

### 第四步：排查数据源

1. 查询 data_sources 表确认各数据源连接状态
2. 检查 last_sync_at 判断同步是否正常
3. 如果数据源正常，问题通常在报表生成任务本身

### 第五步：形成诊断结论

1. 关联所有发现，确定根因
2. 评估业务影响（缺失数据的时间范围和涉及的指标）
3. 提出修复建议（启用任务、补跑数据等）'

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
  "mcpServers": ["postgresql"],
  "applicableServiceTypes": ["postgresql"]
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
