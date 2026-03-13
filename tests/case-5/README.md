# Case 5: PostgreSQL 定时任务异常导致报表数据缺失

## 场景

数据分析平台的报表生成定时任务在一次系统升级后意外被设为 `disabled`。`daily_reports` 表已经 3 天没有新数据，业务方反馈数据看板全是过期数据。

## 架构

| 组件 | 说明 |
|------|------|
| case5-postgres (35432) | 模拟生产 PostgreSQL 16（analytics_service 数据库） |
| Chronos Backend | AI Agent 分析平台 |

### 数据库表

- `scheduled_jobs` — 定时任务配置（3 个，其中 `generate_daily_report` 被禁用）
- `daily_reports` — 日报数据（3 天前有数据，最近 3 天缺失）
- `data_sources` — 数据源配置（3 个，均正常同步）
- `app_errors` — 应用错误日志（6 条）

### 使用的 Skill

**PostgreSQL Ops Diagnosis** (`postgresql-ops-diagnosis`)
- MCP Server: `@modelcontextprotocol/server-postgres`
- 适用服务类型: `postgresql`

## 运行步骤

### 前置条件

- Docker 已安装并运行
- Chronos 后端已启动（默认 http://localhost:8000）
- PostgreSQL 客户端可用（`psql` 命令行工具）
- `jq` 已安装

### 执行

```bash
cd tests/case-5

# 1. 启动模拟生产环境
docker compose up -d --wait

# 2. 初始化数据 + 创建 Chronos 项目/服务/知识库/Skill
bash seed.sh

# 3. 触发告警 → Agent 自动处理 → 验证结果
bash trigger.sh

# 4. 清理所有资源
bash cleanup.sh
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CHRONOS_API_URL` | `http://localhost:8000` | Chronos 后端地址 |
| `PG_HOST` | `127.0.0.1` | PostgreSQL 主机 |
| `PG_PORT` | `35432` | PostgreSQL 端口 |
| `MAX_WAIT` | `300` | 等待 Agent 处理的最大秒数 |

## 预期 Agent 流程

1. 搜索知识库 → 找到数据分析平台报表架构文档
2. 列出 Skills → 找到 PostgreSQL Ops Diagnosis
3. 加载 Skill → 读取诊断方法论
4. 列出项目服务 → 找到 PostgreSQL 连接
5. 激活 MCP → 启动 PostgreSQL MCP Server
6. 执行 SQL → 查询 scheduled_jobs → 发现 generate_daily_report 被禁用
7. 执行 SQL → 查询 daily_reports → 确认 3 天无新数据
8. 执行 SQL → 查询 app_errors → 看到 "job is disabled" 日志
9. 分析根因：定时任务被系统升级意外禁用
10. 更新 Incident 状态为 resolved
11. 保存事件历史
12. 关闭 MCP

## 验证项

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | Incident 状态 | 变为 `resolved` 或 `closed` |
| 2 | 任务禁用识别 | Agent 提到 disabled 或 is_enabled=false |
| 3 | MCP 使用 | Agent 通过 PostgreSQL MCP 执行了查询 |
| 4 | 事件历史 | 生成了 incident_history 文档 |

## 故障排查

- **MCP 激活失败**: 检查 `data/skills/postgresql-ops-diagnosis/skill.config.json` 是否存在
- **知识库无结果**: 检查文档状态是否为 `ready`（seed.sh 会等待）
- **Agent 超时**: 增加 `MAX_WAIT` 或查看后端日志
- **PostgreSQL 连接失败**: 确认 Docker 容器健康，`PGPASSWORD=analytics123 psql -h 127.0.0.1 -p 35432 -U analytics -d analytics_service` 可连接
