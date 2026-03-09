# Chronos Backend

AI 驱动的运维事件处置平台后端。

## 技术栈

- **框架**: FastAPI
- **数据库**: PostgreSQL + SQLAlchemy 2.x asyncio + asyncpg
- **迁移**: Alembic
- **缓存**: Redis
- **Agent**: LangGraph + LangChain + Anthropic Claude
- **配置**: pydantic-settings
- **日志**: loguru
- **JSON**: orjson
- **Task Runner**: poethepoet

## 快速开始

### 前置条件

- Python >= 3.12
- [uv](https://docs.astral.sh/uv/)
- PostgreSQL
- Redis

### 1. 安装依赖

```bash
cd backend
uv sync
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，修改数据库连接和 AI 配置：

```env
DATABASE_URL=postgresql+asyncpg://xlsama@localhost:5432/chronos
REDIS_URL=redis://localhost:6379/0
DASHSCOPE_API_KEY=sk-xxx
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen3.5-plus
DEBUG=true
SKILLS_DIR=skills
```

### 3. 创建数据库

```bash
createdb chronos
```

### 4. 运行数据库迁移

```bash
uv run poe migrate
```

### 5. 启动开发服务器

```bash
uv run poe dev
```

服务启动后：

- API: http://localhost:8000
- OpenAPI 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## Poe 任务

| 命令 | 说明 |
|------|------|
| `uv run poe dev` | 启动开发服务器（热重载） |
| `uv run poe migrate` | 运行数据库迁移 |
| `uv run poe makemigrations` | 生成迁移文件（自动检测模型变更） |
| `uv run poe lint` | 代码检查 |
| `uv run poe fix` | 自动修复代码问题 |

## 项目结构

```
backend/
├── src/chronos/
│   ├── main.py              # FastAPI 应用入口
│   ├── core/                # 基础设施（config, database, redis, security, logging）
│   ├── models/              # SQLAlchemy ORM 模型
│   ├── schemas/             # Pydantic 请求/响应模型
│   ├── api/v1/              # API 路由
│   ├── services/            # 业务逻辑层
│   └── agent/               # LangGraph Agent 系统
│       ├── state.py         # IncidentState 状态定义
│       ├── graph.py         # 主图（12 个节点）
│       ├── nodes/           # 各节点实现
│       ├── skills/          # Skill 知识文档加载器
│       └── tools/           # Agent 工具（bash, file_ops, browser）
├── skills/                  # SKILL.md 知识文档
├── migrations/              # Alembic 迁移文件
├── pyproject.toml
├── alembic.ini
└── docker-compose.yml       # PostgreSQL + Redis（可选）
```

## API 概览

| 模块 | 端点 | 说明 |
|------|------|------|
| Webhook | `POST /api/v1/webhooks/ingest` | 告警接入 |
| Incidents | `GET/POST/PATCH /api/v1/incidents` | 事件管理 |
| Chat | `GET /api/v1/chat/stream/{id}` | SSE 实时流 |
| | `POST /api/v1/chat/send` | 发送消息 / 恢复 Agent |
| | `POST /api/v1/chat/trigger/{id}` | 手动触发 Agent |
| | `POST /api/v1/chat/cancel/{id}` | 取消 Agent |
| Runbooks | `GET/POST/PATCH /api/v1/runbooks` | Runbook 管理 |
| Skills | `GET /api/v1/skills` | 技能列表（只读） |
| Topology | `GET/POST/PATCH/DELETE /api/v1/services` | 服务拓扑 |
| | `GET/POST /api/v1/environments` | 环境管理 |
| Executions | `GET /api/v1/executions` | 执行历史 |
