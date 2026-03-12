#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHRONOS_API="http://localhost:8000/api"
STATE_FILE="$SCRIPT_DIR/.case1-state"

echo "==> [1/3] 停止并删除模拟环境容器..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" down -v

echo "==> [2/3] 清理 Chronos 平台数据..."

# 检查状态文件是否存在
if [ ! -f "$STATE_FILE" ]; then
  echo "    -> .case1-state 文件未找到，跳过 API 清理"
else
  # 读取保存的 IDs
  source "$STATE_FILE"

  # 删除项目（级联删除所有相关服务）
  if [ -n "${PROJECT_ID:-}" ]; then
    DELETE_PROJECT=$(curl -s -w "\n%{http_code}" -X DELETE "$CHRONOS_API/projects/$PROJECT_ID")
    HTTP_CODE=$(echo "$DELETE_PROJECT" | tail -n 1)
    if [ "$HTTP_CODE" = "200" ]; then
      echo "    -> 项目已删除: $PROJECT_ID"
    else
      echo "    -> 项目删除失败: $PROJECT_ID (HTTP $HTTP_CODE)"
    fi
  fi

  # 删除 Skill
  if [ -n "${SKILL_SLUG:-}" ]; then
    DELETE_SKILL=$(curl -s -w "\n%{http_code}" -X DELETE "$CHRONOS_API/skills/$SKILL_SLUG")
    HTTP_CODE=$(echo "$DELETE_SKILL" | tail -n 1)
    if [ "$HTTP_CODE" = "200" ]; then
      echo "    -> Skill 已删除: $SKILL_SLUG"
    else
      echo "    -> Skill 删除失败: $SKILL_SLUG (HTTP $HTTP_CODE)"
    fi
  fi

  # 删除状态文件
  rm "$STATE_FILE"
  echo "    -> 状态文件已删除"
fi

echo "==> [3/3] 清理完成"
echo ""
echo "模拟环境和 Chronos 平台数据已清理完毕。"
