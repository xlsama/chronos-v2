#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHRONOS_API="http://localhost:8000/api"

echo "==> [1/3] 停止并删除模拟环境容器..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" down -v

echo "==> [2/3] 清理 Chronos 平台数据..."

# 通过 API 按名称查找项目 ID
PROJECT_ID=$(curl -s "$CHRONOS_API/projects" | jq -r '.data[] | select(.name == "订单系统") | .id // empty')

if [ -n "$PROJECT_ID" ]; then
  DELETE_PROJECT=$(curl -s -w "\n%{http_code}" -X DELETE "$CHRONOS_API/projects/$PROJECT_ID")
  HTTP_CODE=$(echo "$DELETE_PROJECT" | tail -n 1)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "    -> 项目已删除: $PROJECT_ID"
  else
    echo "    -> 项目删除失败: $PROJECT_ID (HTTP $HTTP_CODE)"
  fi
else
  echo "    -> 未找到项目「订单系统」，跳过"
fi

# 按 slug 直接删除 Skill
SKILL_SLUG="redis-config-diagnosis"
DELETE_SKILL=$(curl -s -w "\n%{http_code}" -X DELETE "$CHRONOS_API/skills/$SKILL_SLUG")
HTTP_CODE=$(echo "$DELETE_SKILL" | tail -n 1)
if [ "$HTTP_CODE" = "200" ]; then
  echo "    -> Skill 已删除: $SKILL_SLUG"
else
  echo "    -> Skill 删除失败或不存在: $SKILL_SLUG (HTTP $HTTP_CODE)"
fi

echo "==> [3/3] 清理完成"
echo ""
echo "模拟环境和 Chronos 平台数据已清理完毕。"
