#!/usr/bin/env bash
set -euo pipefail

CHRONOS_API="http://localhost:8000/api"

echo "==> 触发告警事件..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$CHRONOS_API/webhooks/alert" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "[P1 级联故障] checkout 完成率 23%，多服务异常\n\n告警来源: Prometheus Alertmanager + PagerDuty\n告警级别: Critical (P1)\n触发时间: 2026-03-11T14:35:00+08:00\n\n=== 故障概要 ===\n电商支付链路级联故障，多个服务同时告警：\n\n1. [CRITICAL] checkout-service: 完成率从 95% 骤降至 23%\n   - 77% 的用户在支付环节失败\n   - 用户会话大量超时 (sess_abc123 等)\n\n2. [CRITICAL] payment-service: 健康检查失败\n   - 欺诈检测模块 (es-fraud-check) 熔断器已 OPEN\n   - 所有新交易被拒绝，进入 dead_letter_queue\n   - dead_letter_queue 积压约 2847 条\n\n3. [ERROR] Elasticsearch: cluster_block_exception\n   - 错误: FORBIDDEN/12/index read-only / allow delete (api)\n   - 影响索引: transaction-patterns, app-logs-2026.03.11\n   - 疑似磁盘 flood_stage 水位线触发\n\n4. [WARN] Kafka: consumer lag 飙升\n   - consumer group: payment-processor\n   - 当前 lag: 28930 (阈值: 1000)\n\n5. [ERROR] log-ingestor: 写入管道阻塞\n   - 过去 60s 0 条文档写入成功\n   - 缓冲区使用率 98%\n\n6. [ERROR] API Gateway: upstream 503\n   - payment-service 连续 5 次健康检查失败\n\n=== 时间线 ===\n14:27 - ES bulk index 开始报 ClusterBlockException\n14:28 - log-ingestor 管道阻塞告警\n14:29 - payment-service 欺诈检测超时\n14:30 - 首批交易进入 dead_letter_queue\n14:31 - 熔断器 OPEN\n14:33 - Kafka lag 超过阈值\n14:34 - checkout 完成率降至 23%\n14:35 - Gateway 503 告警\n\n请立即排查级联故障根因。"
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
  echo "  3. 等待 Agent 处理完成后，验证修复结果："
  echo "     # ES 索引阻塞已解除"
  echo "     curl -s localhost:29200/transaction-patterns/_settings | python3 -m json.tool | grep read_only"
  echo "     # Redis 熔断器已清除"
  echo "     redis-cli -p 26379 GET circuit:payment-service:es-fraud"
  echo "     # checkout 锁已清除"
  echo "     redis-cli -p 26379 EXISTS checkout:lock:user-42"
else
  echo "    -> 告警触发失败 (HTTP $HTTP_CODE)"
  echo "$BODY"
  echo ""
  echo "请确保 Chronos 后端已启动 (pnpm dev:backend)"
fi
