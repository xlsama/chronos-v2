#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="chronos-case3"

echo "==> [1/2] 删除 K8s namespace 及所有资源..."

if kubectl get namespace "$NAMESPACE" &> /dev/null; then
  kubectl delete namespace "$NAMESPACE"
  echo "    -> namespace $NAMESPACE 已删除"
else
  echo "    -> namespace $NAMESPACE 不存在，跳过"
fi

echo "==> [2/2] 提示清理 Chronos 数据..."
echo ""
echo "K8s 资源已清理完毕。"
echo ""
echo "如需清理 Chronos 平台中的测试数据，请在前端手动删除："
echo "  - 连接: 'K8s 集群'"
echo "  - Skill: 'Kubernetes CrashLoopBackOff 诊断'"
echo "  - Service Map: 'User Service 部署拓扑'"
echo "  - 相关事件和 Runbook"
