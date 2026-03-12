#!/usr/bin/env bash
set -euo pipefail

CHRONOS_API="http://localhost:8000/api"
NAMESPACE="chronos-case3"

echo "==> 收集 K8s 故障现场信息..."

# 收集 Pod 状态
POD_STATUS=$(kubectl get pods -n "$NAMESPACE" -l app=user-service -o wide 2>/dev/null || echo "无法获取 Pod 状态")

# 收集 Warning 事件
EVENTS=$(kubectl get events -n "$NAMESPACE" --field-selector type=Warning --sort-by='.lastTimestamp' 2>/dev/null | tail -20 || echo "无法获取事件")

# 收集最近的 Pod 日志
POD_LOGS=$(kubectl logs -n "$NAMESPACE" -l app=user-service --tail=10 --previous 2>/dev/null || \
  kubectl logs -n "$NAMESPACE" -l app=user-service --tail=10 2>/dev/null || \
  echo "无法获取日志")

echo "==> 触发告警事件..."

# 使用 python3 安全地构造 JSON（避免 shell 变量中的特殊字符破坏 JSON）
export NAMESPACE POD_STATUS EVENTS POD_LOGS
JSON_PAYLOAD=$(python3 -c "
import json, os
content = '''[P1 告警] user-service 全部 Pod CrashLoopBackOff

告警来源: Kubernetes Event Watcher
告警级别: Critical (P1)
Namespace: {namespace}

=== 故障概要 ===
user-service Deployment 的 3 个 Pod 全部进入 CrashLoopBackOff 状态。
容器启动后立即退出 (exit code 1)，日志显示数据库连接失败。

=== 当前 Pod 状态 ===
{pod_status}

=== Warning 事件 ===
{events}

=== 容器日志 (最近) ===
{pod_logs}

=== 初步分析 ===
- 所有 3 个 Pod 均以 exit code 1 退出
- 日志中出现 Cannot connect to database 错误
- 可能原因: ConfigMap 中的数据库连接配置有误
- 影响: user-service 完全不可用

请立即排查 Pod 启动失败的根因。'''.format(
    namespace=os.environ['NAMESPACE'],
    pod_status=os.environ['POD_STATUS'],
    events=os.environ['EVENTS'],
    pod_logs=os.environ['POD_LOGS'],
)
print(json.dumps({'content': content}))
" 2>/dev/null)

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$CHRONOS_API/webhooks/alert" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD")

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
  echo "     # ConfigMap 已修正"
  echo "     kubectl get configmap app-config -n $NAMESPACE -o yaml | grep DATABASE_URL"
  echo "     # Deployment 已重启"
  echo "     kubectl get pods -n $NAMESPACE"
else
  echo "    -> 告警触发失败 (HTTP $HTTP_CODE)"
  echo "$BODY"
  echo ""
  echo "请确保 Chronos 后端已启动 (pnpm dev:backend)"
fi
