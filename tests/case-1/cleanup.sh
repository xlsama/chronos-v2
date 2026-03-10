#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> [1/2] 停止并删除模拟环境容器..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" down -v

echo "==> [2/2] 提示清理 Chronos 数据..."
echo ""
echo "模拟环境已清理完毕。"
echo ""
echo "如需清理 Chronos 平台中的测试数据，请在前端手动删除："
echo "  - 连接: '生产数据库'、'生产 Redis'"
echo "  - Skill: 'Redis 配置键值诊断'"
echo "  - Service Map: '订单系统服务拓扑'"
echo "  - 相关事件和 Runbook"
