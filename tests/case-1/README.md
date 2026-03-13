# Case 1: Redis 限流配置异常导致 API 全面 429

## 场景

API 网关使用 Redis 存储限流配置。部署脚本误将所有 `ratelimit:config:*` 的 `limit` 设为 0，导致 /api/orders、/api/products、/api/users 三个核心 endpoint 100% 返回 429 Too Many Requests。

## 架构

| 组件 | 说明 |
|------|------|
| case1-redis (36379) | 模拟生产 Redis 7（限流配置 + 错误日志） |
| Chronos Backend | AI Agent 分析平台 |

### Redis 数据

- `ratelimit:config:/api/orders` — `{"limit":0,"window":60}`（应为 1000）
- `ratelimit:config:/api/products` — `{"limit":0,"window":60}`（应为 2000）
- `ratelimit:config:/api/users` — `{"limit":0,"window":60}`（应为 500）
- `ratelimit:config:/api/health` — `{"limit":10000,"window":60}`（正常）
- `feature:maintenance_mode` — `disabled`
- `errorlog:1~5` — 429 错误日志

### 使用的 Skill

**Redis Cache Diagnosis** (`redis-cache-diagnosis`)
- MCP Server: `@modelcontextprotocol/server-redis`
- 适用服务类型: `redis`

## 运行方式

### Vitest（推荐）

```bash
# 前提：后端已运行 (pnpm dev:backend)
pnpm test:case-1
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CHRONOS_API_URL` | `http://localhost:8000` | Chronos 后端地址 |
| `REDIS_HOST` | `127.0.0.1` | Redis 主机 |
| `REDIS_PORT` | `36379` | Redis 端口 |

## 预期 Agent 流程

1. 搜索知识库 → 找到 API 网关限流架构文档
2. 列出 Skills → 找到 Redis Cache Diagnosis
3. 加载 Skill → 读取诊断方法论
4. 列出项目服务 → 找到 Redis 连接
5. 激活 MCP → 启动 Redis MCP Server
6. `list pattern="ratelimit:config:*"` → 枚举限流配置键
7. `get key="ratelimit:config:/api/orders"` → 发现 limit=0
8. `get` 其他配置键 → 确认多个 endpoint limit=0
9. `list pattern="errorlog:*"` + `get` → 读取错误日志
10. 分析根因：限流配置 limit 被错误设为 0
11. 更新 Incident 状态为 resolved
12. 保存事件历史
13. 关闭 MCP

## 验证项

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | Incident 状态 | 变为 `resolved` 或 `closed` |
| 2 | 限流识别 | Agent 提到 ratelimit/限流/rate limit |
| 3 | 根因定位 | Agent 提到 limit=0 |
| 4 | MCP 使用 | Agent 通过 Redis MCP 执行了操作 |
| 5 | 事件历史 | 生成了 incident_history 文档 |

## 故障排查

- **MCP 激活失败**: 检查 `data/skills/redis-cache-diagnosis/skill.config.json` 是否存在
- **知识库无结果**: 检查文档状态是否为 `ready`
- **Agent 超时**: 检查后端日志 `pnpm dev:backend`
- **Redis 连接失败**: 确认容器健康 `docker exec case1-redis redis-cli ping`
