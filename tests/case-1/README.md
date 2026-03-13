# Case 1: Redis 限流配置异常导致 API 全面 429

## 场景

API 网关使用 Redis 存储限流配置。部署脚本误将多个 `ratelimit:config:*` 的 `limit` 设为 `0`，导致 `/api/orders`、`/api/products`、`/api/users` 大面积返回 `429 Too Many Requests`。

## 架构

| 组件 | 说明 |
|------|------|
| case1-redis (36379) | 模拟生产 Redis 7（限流配置 + 错误日志） |
| Chronos Backend | AI Agent 分析平台 |

### 复用的内置 Skill

- `redis-cache-diagnosis`
- MCP Server: `@modelcontextprotocol/server-redis`
- 本 case 的 `seed.ts` 不会再创建私有 skill；Agent 直接复用仓库内置通用 skill

## 运行方式

```bash
# 前提：后端已运行 (pnpm dev:backend)
pnpm test:case-1
```

## 预期 Agent 流程

1. 列出项目服务，确认 Redis 是 API 网关运行时存储。
2. 列出 Skills，加载通用 `redis-cache-diagnosis`。
3. 激活 Redis MCP，自主发现相关键空间和异常样本。
4. 结合多个业务 endpoint 的 429 现象与 Redis 运行态证据定位根因。
5. 输出结论，保存 incident history，并关闭事件。

## 验证项

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | Incident 状态 | 变为 `resolved` 或 `closed` |
| 2 | 限流识别 | Agent 提到 ratelimit/限流/rate limit |
| 3 | 根因定位 | Agent 提到 limit=0 |
| 4 | MCP 使用 | Agent 通过 Redis MCP 执行了操作 |
| 5 | 事件历史 | 生成了 incident_history 文档 |

## 故障排查

- **内置 Skill 未出现**: 检查 [SKILL.md](/Users/xlsama/w/chronos-v2/apps/backend/data/skills/redis-cache-diagnosis/SKILL.md)
- **Agent 超时**: 查看后端日志 `pnpm dev:backend`
- **Redis 连接失败**: 确认容器健康 `docker exec case1-redis redis-cli ping`
