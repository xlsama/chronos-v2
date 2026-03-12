#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
API_URL="${CHRONOS_API_URL:-http://localhost:3001}"

echo "=== Case 5: 清理 ==="

# 加载元数据
if [ -f "$SCRIPT_DIR/.env" ]; then
  source "$SCRIPT_DIR/.env"

  # 删除 Skill
  if [ -n "${SKILL_SLUG:-}" ]; then
    echo "[1/4] 删除 Skill: $SKILL_SLUG..."
    curl -sf -X DELETE "$API_URL/api/skills/$SKILL_SLUG" > /dev/null 2>&1 && echo "  ✓ Skill 已删除" || echo "  - Skill 不存在或已删除"

    # 清理 skill 配置目录
    SKILL_DIR="$PROJECT_ROOT/apps/backend/data/skills/$SKILL_SLUG"
    if [ -d "$SKILL_DIR" ]; then
      rm -rf "$SKILL_DIR"
      echo "  ✓ Skill 配置目录已清理"
    fi
  fi

  # 删除项目（级联删除服务和文档）
  if [ -n "${PROJECT_ID:-}" ]; then
    echo "[2/4] 删除项目: $PROJECT_ID..."
    curl -sf -X DELETE "$API_URL/api/projects/$PROJECT_ID" > /dev/null 2>&1 && echo "  ✓ 项目已删除" || echo "  - 项目不存在或已删除"
  fi

  rm -f "$SCRIPT_DIR/.env"
  echo "  ✓ .env 已清理"
else
  echo "  - 未找到 .env 文件，跳过 API 清理"
fi

# 停止 Docker 容器
echo "[3/4] 停止 Docker 容器..."
cd "$SCRIPT_DIR"
docker compose down -v 2>/dev/null && echo "  ✓ Docker 容器已停止" || echo "  - 无运行中的容器"

echo "[4/4] 清理完成"
echo ""
echo "=== Case 5 已完全清理 ==="
