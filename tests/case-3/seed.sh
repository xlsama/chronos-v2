#!/usr/bin/env bash
set -euo pipefail

CHRONOS_API="http://localhost:8000/api"
NAMESPACE="chronos-case3"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> [1/3] 部署 K8s 故障应用..."

# 检查 kubectl 是否可用
if ! command -v kubectl &> /dev/null; then
  echo "错误: kubectl 未安装或不在 PATH 中"
  exit 1
fi

if ! kubectl cluster-info &> /dev/null; then
  echo "错误: 无法连接到 K8s 集群，请检查 kubeconfig 配置"
  exit 1
fi

# 部署资源
kubectl apply -f "$SCRIPT_DIR/k8s-manifests.yaml"

echo "    -> namespace $NAMESPACE 已创建"
echo "    -> ConfigMap、Deployment、Service 已部署"

echo "    等待 Pod 进入 CrashLoopBackOff 状态..."

# 等待 Deployment 创建 Pod
sleep 3

# 等待 Pod 出现故障（最多等 60 秒）
TIMEOUT=60
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  CRASH_COUNT=$(kubectl get pods -n "$NAMESPACE" -l app=user-service --no-headers 2>/dev/null | grep -c "CrashLoopBackOff\|Error\|BackOff" || true)
  if [ "$CRASH_COUNT" -ge 1 ]; then
    echo "    -> Pod 已进入故障状态"
    break
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "    -> 警告: 等待超时，Pod 可能还未进入 CrashLoopBackOff（可能需要更多时间）"
fi

# 显示当前 Pod 状态
echo ""
echo "    当前 Pod 状态:"
kubectl get pods -n "$NAMESPACE" -l app=user-service --no-headers 2>/dev/null | while read -r line; do
  echo "      $line"
done

echo ""
echo "==> [2/3] 向 Chronos 写入种子数据 (Service Map)..."

# Service Map: User Service 部署拓扑
curl -s -X POST "$CHRONOS_API/service-maps" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "User Service 部署拓扑",
    "description": "user-service 在 K8s 中的部署拓扑，展示 ConfigMap 依赖和数据库连接关系",
    "graph": {
      "nodes": [
        {"id": "k8s-cluster",  "type": "serviceNode", "position": {"x": 250, "y": 0},   "data": {"label": "K8s Cluster",         "serviceType": "container", "description": "Kubernetes 集群, namespace: chronos-case3"}},
        {"id": "user-service", "type": "serviceNode", "position": {"x": 250, "y": 120}, "data": {"label": "user-service",        "serviceType": "service",   "description": "用户服务, 3 replicas, Deployment, 从 ConfigMap 读取 DATABASE_URL"}},
        {"id": "app-config",   "type": "serviceNode", "position": {"x": 50,  "y": 250}, "data": {"label": "ConfigMap (app-config)", "serviceType": "container", "description": "环境配置: DATABASE_URL, LOG_LEVEL, MAX_CONNECTIONS"}},
        {"id": "db-primary",   "type": "serviceNode", "position": {"x": 450, "y": 250}, "data": {"label": "db-primary (PostgreSQL)", "serviceType": "database",  "description": "主数据库, 期望地址: db-primary.internal:5432"}}
      ],
      "edges": [
        {"id": "e1", "source": "k8s-cluster",  "target": "user-service", "label": "调度 Pod",              "data": {"relationType": "depends-on"}},
        {"id": "e2", "source": "user-service",  "target": "app-config",  "label": "envFrom (ConfigMap)",    "data": {"relationType": "reads-from", "critical": true}},
        {"id": "e3", "source": "user-service",  "target": "db-primary",  "label": "DATABASE_URL 连接",      "data": {"relationType": "depends-on", "protocol": "sql", "critical": true}}
      ]
    }
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"    -> Service Map 创建成功: {d['data']['id']}\")" 2>/dev/null || echo "    -> Service Map 创建失败"

echo ""
echo "=== 种子数据初始化完成 ==="
echo ""
echo "模拟故障概要："
echo "  - K8s namespace: $NAMESPACE"
echo "  - ConfigMap app-config 中 DATABASE_URL 有拼写错误 (postgressql + 端口 54321)"
echo "  - user-service Deployment 的 3 个 Pod 均因连接数据库失败而 CrashLoopBackOff"
echo ""
echo "下一步: 在 Chronos 前端添加 K8s 连接（详见 README.md Step 2）"
