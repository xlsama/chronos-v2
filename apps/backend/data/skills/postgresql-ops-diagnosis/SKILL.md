---
name: "PostgreSQL 运维诊断"
description: "当事件指向 PostgreSQL 数据缺失、连接池耗尽、定时任务异常、慢查询、锁等待或同步延迟时使用。通过只读 PostgreSQL MCP 查询 schema、系统视图和业务样本定位根因。"
mcpServers:
  - postgresql
applicableServiceTypes:
  - postgresql
riskLevel: read-only
---

# PostgreSQL 运维诊断

## 任务目标

- 用只读 PostgreSQL 查询确认问题属于连接、性能、锁、调度还是数据层，并给出可验证证据。

## 运行上下文

- 该 skill 在 Chronos 服务端容器内执行，不依赖用户本机环境。
- 优先使用 PostgreSQL MCP；如需补充能力，只能在说明用途后使用 `runContainerCommand`。
- 先看系统视图和 schema，再看业务表，不要先猜调度表或错误表存在。

## 推荐流程

1. 确认项目中存在 PostgreSQL 服务，并激活 MCP。
2. 先用 `information_schema`、`pg_catalog`、`pg_stat_activity`、`pg_locks` 等系统视图判断问题类型。
3. 如果指向慢查询或连接问题，优先看活动会话、锁和等待。
4. 如果指向数据缺失或任务异常，先确认相关 schema 和表，再做聚合和样本查询。
5. 只有在确认实际存在调度表、扩展或业务表后，才做更细的业务诊断。

## 查询策略

- 不要预设 `scheduled_jobs`、`app_errors` 或 `data_sources` 一定存在；必须先发现再使用。
- 连接池、锁等待和性能问题优先看系统视图，不先碰业务大表。
- 数据缺失问题先用时间窗口聚合和样本确认影响范围，再关联上下游表。
- 对长查询和锁冲突，优先确认阻塞源与等待链，而不是只看最终报错。

## 风险边界

- 默认只读，不执行写操作、DDL、VACUUM、ANALYZE、取消会话或修改参数。
- 如果认证信息、扩展权限或目标 schema 不可见，直接报告阻塞或不确定性。

## 输出要求

- 最终回复必须写明：问题类别、受影响的 schema 或表、关键系统视图或业务证据、根因判断，以及是否已经激活 MCP。
