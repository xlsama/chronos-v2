#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_URL="${CHRONOS_API_URL:-http://localhost:3001}"
MAX_WAIT="${MAX_WAIT:-300}"  # 最长等待 5 分钟

# 加载 seed 阶段保存的元数据
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "✗ 未找到 .env 文件，请先运行 seed.sh"
  exit 1
fi
source "$SCRIPT_DIR/.env"

echo "=== Case 4: 触发告警 ==="
echo "  项目 ID: $PROJECT_ID"
echo ""

# ── 1. 发送告警 ──────────────────────────────────────────────────
echo "[1/4] 发送 P2 告警..."

ALERT_CONTENT="【P2 告警】商品服务订单金额异常

告警来源: order-service / price-monitor
告警时间: $(date '+%Y-%m-%d %H:%M:%S')
告警级别: P2

告警描述:
近 30 分钟内，订单服务检测到多笔零元订单（total = 0），订单校验失败率飙升至 40%。
checkout-service 报告支付网关拒绝了多笔金额为 0 的交易请求。
price-monitor 检测到数码配件分类下多个商品价格为 0。

影响范围:
- 4 笔订单创建失败（订单号: ORD-20260312-007 ~ 010）
- 支付网关拒绝率上升
- 前端用户看到商品价格显示为 ¥0.00

请立即排查商品数据库中的价格数据是否正常。"

INCIDENT_RESP=$(curl -sf -X POST "$API_URL/api/webhooks/alert" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg content "$ALERT_CONTENT" \
    --arg projectId "$PROJECT_ID" \
    '{ content: $content, projectId: $projectId }')")

INCIDENT_ID=$(echo "$INCIDENT_RESP" | jq -r '.data.id')
THREAD_ID="incident-$INCIDENT_ID"
echo "  ✓ 告警已发送"
echo "  Incident ID: $INCIDENT_ID"
echo "  Thread ID:   $THREAD_ID"

# ── 2. 等待 Agent 处理 ───────────────────────────────────────────
echo ""
echo "[2/4] 等待 Agent 处理（最长 ${MAX_WAIT}s）..."

START_TIME=$(date +%s)
LAST_STATUS=""

while true; do
  ELAPSED=$(( $(date +%s) - START_TIME ))
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo "  ✗ 超时（${MAX_WAIT}s），Agent 未完成处理"
    echo "  最后状态: $LAST_STATUS"
    exit 1
  fi

  INCIDENT=$(curl -sf "$API_URL/api/incidents/$INCIDENT_ID")
  STATUS=$(echo "$INCIDENT" | jq -r '.data.status')

  if [ "$STATUS" != "$LAST_STATUS" ]; then
    echo "  [${ELAPSED}s] 状态变更: ${LAST_STATUS:-initial} → $STATUS"
    LAST_STATUS="$STATUS"
  fi

  if [ "$STATUS" = "resolved" ] || [ "$STATUS" = "closed" ]; then
    echo "  ✓ Agent 处理完成（耗时 ${ELAPSED}s），状态: $STATUS"
    break
  fi

  sleep 3
done

# ── 3. 获取 Agent 对话记录 ───────────────────────────────────────
echo ""
echo "[3/4] 获取 Agent 对话记录..."

MESSAGES=$(curl -sf "$API_URL/api/chat/$THREAD_ID/messages")
MSG_COUNT=$(echo "$MESSAGES" | jq 'length')
echo "  消息数量: $MSG_COUNT"

# 提取 assistant 消息中的文本
echo ""
echo "--- Agent 分析摘要 ---"
echo "$MESSAGES" | jq -r '
  .[] | select(.role == "assistant") |
  .parts[]? | select(.type == "text") | .text
' | tail -c 2000
echo ""
echo "--- 摘要结束 ---"

# ── 4. 验证结果 ──────────────────────────────────────────────────
echo ""
echo "[4/4] 验证结果..."

PASS=0
FAIL=0

# 检查 1: Incident 状态
if [ "$LAST_STATUS" = "resolved" ] || [ "$LAST_STATUS" = "closed" ]; then
  echo "  ✓ [PASS] Incident 状态: $LAST_STATUS"
  ((PASS++))
else
  echo "  ✗ [FAIL] Incident 状态: $LAST_STATUS (期望 resolved/closed)"
  ((FAIL++))
fi

# 检查 2: Agent 对话中是否包含 MCP 相关内容
FULL_TEXT=$(echo "$MESSAGES" | jq -r '[.[] | .parts[]? | select(.type == "text") | .text] | join(" ")')

if echo "$FULL_TEXT" | grep -qi "price\|价格\|0\.00\|零元\|数码配件"; then
  echo "  ✓ [PASS] Agent 识别了价格异常"
  ((PASS++))
else
  echo "  ✗ [FAIL] Agent 未识别价格异常"
  ((FAIL++))
fi

if echo "$FULL_TEXT" | grep -qi "mysql\|mcp\|activat"; then
  echo "  ✓ [PASS] Agent 使用了 MySQL MCP"
  ((PASS++))
else
  echo "  ✗ [FAIL] Agent 未使用 MySQL MCP"
  ((FAIL++))
fi

# 检查 3: 事件历史
HISTORY=$(curl -sf "$API_URL/api/projects/$PROJECT_ID/incident-history")
HISTORY_COUNT=$(echo "$HISTORY" | jq '.data | length')

if [ "$HISTORY_COUNT" -gt 0 ]; then
  echo "  ✓ [PASS] 生成了 incident_history 文档（${HISTORY_COUNT} 条）"
  ((PASS++))
else
  echo "  ✗ [FAIL] 未生成 incident_history 文档"
  ((FAIL++))
fi

# 汇总
echo ""
echo "=== 验证结果: ${PASS} passed, ${FAIL} failed ==="

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "调试信息："
  echo "  查看后端日志:       docker logs chronos-backend"
  echo "  查看 Agent 对话:    curl $API_URL/api/chat/$THREAD_ID/messages | jq"
  echo "  查看 Incident 详情: curl $API_URL/api/incidents/$INCIDENT_ID | jq"
  exit 1
fi
