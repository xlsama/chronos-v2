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

echo "=== Case 5: 触发告警 ==="
echo "  项目 ID: $PROJECT_ID"
echo ""

# ── 1. 发送告警 ──────────────────────────────────────────────────
echo "[1/4] 发送 P2 告警..."

ALERT_CONTENT="【P2 告警】数据看板过期 — BI 报表数据停滞

告警来源: dashboard-api / bi-gateway
告警时间: $(date '+%Y-%m-%d %H:%M:%S')
告警级别: P2

告警描述:
业务方反馈 BI 看板数据停留在 3 天前，daily_reports 表无最近 3 天的新数据。
dashboard-api 检测到最新 report_date 距今超过 3 天。
bi-gateway 在刷新报表时未找到近期数据。

影响范围:
- BI 看板所有部门的日报指标（DAU、revenue 等）均为 3 天前的数据
- 业务决策参考数据过期
- 多个部门已提交工单反馈数据异常

请排查报表生成定时任务是否正常运行，确认数据缺失原因。"

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

# 检查 2: Agent 对话中是否包含关键发现
FULL_TEXT=$(echo "$MESSAGES" | jq -r '[.[] | .parts[]? | select(.type == "text") | .text] | join(" ")')

if echo "$FULL_TEXT" | grep -qi "disabled\|禁用\|is_enabled\|generate_daily_report"; then
  echo "  ✓ [PASS] Agent 识别了定时任务被禁用"
  ((PASS++))
else
  echo "  ✗ [FAIL] Agent 未识别定时任务被禁用"
  ((FAIL++))
fi

if echo "$FULL_TEXT" | grep -qi "postgresql\|postgres\|mcp\|activat"; then
  echo "  ✓ [PASS] Agent 使用了 PostgreSQL MCP"
  ((PASS++))
else
  echo "  ✗ [FAIL] Agent 未使用 PostgreSQL MCP"
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
