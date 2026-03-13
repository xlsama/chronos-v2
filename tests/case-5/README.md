# Case 5: PostgreSQL 定时任务异常导致报表数据缺失

## 场景

数据分析平台在一次系统升级后把 `generate_daily_report` 意外留在 `disabled` 状态。`daily_reports` 最近 3 天都没有新数据，导致 BI 看板持续显示旧数据。

## 架构

| 组件 | 说明 |
|------|------|
| case5-postgres (35432) | 模拟生产 PostgreSQL 16（`analytics_service`） |
| Chronos Backend | AI Agent 分析平台 |

### 复用的内置 Skill

- `postgresql-ops-diagnosis`
- MCP Server: `@modelcontextprotocol/server-postgres`
- 本 case 的 seed 仅准备数据库数据、服务上下文和知识库

## 运行方式

```bash
# 前提：后端已运行 (pnpm dev:backend)
pnpm test:case-5
```

## 预期 Agent 流程

1. 列出项目服务，确认 PostgreSQL 承载调度、报表和同步状态数据。
2. 加载通用 `postgresql-ops-diagnosis` 并激活 PostgreSQL MCP。
3. 先发现相关 schema 和系统状态，再定位报表停滞发生在哪一层。
4. 结合报表结果、调度状态和同步状态形成证据链。
5. 输出结论，保存 incident history，并关闭事件。

## 验证项

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | Incident 状态 | 进入 `resolved` / `summarizing` / `completed` |
| 2 | 任务禁用识别 | Agent 提到 disabled 或 is_enabled=false |
| 3 | MCP 使用 | Agent 通过 PostgreSQL MCP 执行了查询 |
| 4 | 事件历史 | 生成了 incident_history 文档 |

## 故障排查

- **内置 Skill 未出现**: 检查 [SKILL.md](/Users/xlsama/w/chronos-v2/apps/backend/data/skills/postgresql-ops-diagnosis/SKILL.md)
- **Agent 超时**: 查看后端日志
- **PostgreSQL 连接失败**: 确认 `PGPASSWORD=analytics123 psql -h 127.0.0.1 -p 35432 -U analytics -d analytics_service` 可连接
