# Chronos v2

AI 驱动的智能运维事件管理平台。AI Agent 自动分析告警、匹配运行手册/技能库、执行修复、沉淀经验。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 19 + TanStack Router + shadcn/ui v4 + Tailwind CSS v4 |
| 后端 | Hono + Drizzle ORM + AI SDK v6 |
| 数据库 | PostgreSQL 17 (pgvector) + Redis 7 |
| 构建 | pnpm workspaces monorepo + tsgo + Vite |

## 项目结构

```
chronos-v2/
├── apps/
│   ├── backend/          # Hono API 服务
│   │   ├── Dockerfile
│   │   ├── .env          # 环境变量（唯一一份）
│   │   └── src/
│   └── frontend/         # React SPA
│       ├── Dockerfile
│       └── src/
├── packages/
│   └── shared/           # 共享 TypeScript 类型
├── docker-compose.yml    # 服务编排
└── docker/
    └── nginx.conf        # Nginx 配置（SPA + API 反代 + SSE）
```

## 快速开始

### 环境要求

- Node.js >= 22
- pnpm >= 10
- Docker

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp apps/backend/.env.example apps/backend/.env
```

编辑 `apps/backend/.env`，填入你的 `OPENAI_API_KEY` 和 `ENCRYPTION_KEY`。

### 3. 启动服务

#### 本地开发（推荐日常用）

```bash
# 启动基础设施（PostgreSQL + Redis）
docker compose up -d postgres redis

# 推送 DB schema（首次或 schema 变更后）
pnpm db:push

# 启动前后端
pnpm dev

# 或者分开启动：
pnpm dev:backend      # 后端 → http://localhost:8000
pnpm dev:frontend     # 前端 → http://localhost:5173
```

#### Docker 全量部署（模拟生产）

```bash
docker compose up --build
```

启动 5 个服务：postgres → redis → db-push（推送 schema 后自动退出）→ backend(:8000) → frontend(nginx:80)

访问 http://localhost 即可。

## 常用命令

```bash
pnpm dev              # 同时启动前后端
pnpm dev:backend      # 只启后端（tsx watch）
pnpm dev:frontend     # 只启前端（Vite）
pnpm build            # 构建所有包

pnpm db:push          # 标准做法：按当前 schema 推送数据库变更
pnpm db:generate      # 生成 SQL 迁移文件并提交到仓库
pnpm db:migrate       # 仅用于全新数据库或已对齐 migration 历史的环境
pnpm db:studio        # 打开 Drizzle Studio
```

当前仓库统一约定：日常开发和 Docker 启动都使用 `pnpm db:push`。如果修改了 schema，同时执行 `pnpm db:generate` 提交 migration 文件，保证新环境仍可基于 migration 初始化。

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/incidents` | 事件列表 / 创建 |
| GET/PATCH | `/api/incidents/:id` | 事件详情 / 更新 |
| GET/POST | `/api/runbooks` | 运行手册列表 / 创建 |
| GET/PUT/DELETE | `/api/runbooks/:id` | 运行手册 CRUD |
| GET/POST | `/api/skills` | 技能库列表 / 创建 |
| GET/PUT/DELETE | `/api/skills/:id` | 技能库 CRUD |
| GET/POST | `/api/connections` | 连接列表 / 创建 |
| GET/PUT/DELETE | `/api/connections/:id` | 连接 CRUD |
| POST | `/api/connections/:id/test` | 测试连接 |
| GET/POST | `/api/service-maps` | 服务拓扑列表 / 创建 |
| GET/PUT/DELETE | `/api/service-maps/:id` | 服务拓扑 CRUD |
| POST | `/api/chat` | AI 聊天（SSE 流式 + Redis 广播）|
| GET | `/api/chat/:threadId/subscribe` | 订阅聊天流（SSE）|
| GET | `/api/chat/:threadId/messages` | 聊天历史 |
| GET | `/health` | 健康检查 |
