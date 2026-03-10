#!/usr/bin/env bash
set -euo pipefail

CHRONOS_API="http://localhost:8000/api"

echo "==> 触发告警事件..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$CHRONOS_API/webhooks/alert" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "[P1 告警] order-service 健康检查失败\n\n告警来源: Prometheus Alertmanager\n告警级别: Critical\n触发时间: 2026-03-10T14:30:00+08:00\n\n告警详情:\n- 服务: order-service (10.0.1.52:3000)\n- 健康检查端点 /health 连续 3 次返回 unhealthy\n- 错误信息: Redis dependency check failed - WRONGTYPE Operation against a key holding the wrong kind of value\n- 影响范围: 订单创建接口 P99 延迟从 200ms 飙升至 12000ms+\n- 关联 Redis key: config:order-service:rate_limit\n\n最近相关错误日志 (最近 5 分钟, 共 47 条):\n  [ERROR] Failed to read rate_limit config from Redis: ReplyError: WRONGTYPE Operation against a key holding the wrong kind of value\n  [ERROR] Circuit breaker OPEN for redis-config-reader after 5 consecutive failures\n  [WARN]  Rate limiter fallback triggered - using default config\n  [WARN]  Order creation latency exceeded 5000ms threshold\n\n请立即排查。"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  INCIDENT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "unknown")
  echo "    -> 告警事件已创建: $INCIDENT_ID"
  echo ""
  echo "=== 告警已触发 ==="
  echo ""
  echo "Agent 将自动开始处理该事件，你可以："
  echo "  1. 查看后端日志观察 Agent 的工具调用过程"
  echo "  2. 在前端 Inbox 页面查看事件状态流转"
  echo "  3. 等待 Agent 处理完成后，验证 Redis key 是否被修复："
  echo "     redis-cli -p 16379 TYPE config:order-service:rate_limit"
  echo "     redis-cli -p 16379 GET config:order-service:rate_limit"
else
  echo "    -> 告警触发失败 (HTTP $HTTP_CODE)"
  echo "$BODY"
  echo ""
  echo "请确保 Chronos 后端已启动 (pnpm dev:backend)"
fi
