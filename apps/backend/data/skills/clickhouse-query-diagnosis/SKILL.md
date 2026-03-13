---
name: "ClickHouse 查询诊断"
description: "当事件指向 ClickHouse 查询变慢、数据缺失、写入延迟、分区异常、合并阻塞或副本不一致时使用。通过只读 ClickHouse MCP 查询 system 表、表结构和采样数据定位根因。"
mcpServers:
  - clickhouse
applicableServiceTypes:
  - clickhouse
riskLevel: read-only
---

# ClickHouse 查询诊断

## 任务目标

- 用只读 ClickHouse 查询确认性能瓶颈、数据完整性问题、分区或副本异常，并给出可验证证据。

## 运行上下文

- 该 skill 由 Chronos Agent 在服务端容器中执行，不依赖用户本机环境。
- 优先使用 ClickHouse MCP；如需补充工具，只能在说明用途后使用 `runContainerCommand`。
- 查询前先收敛数据库、表和时间范围，避免高成本全表扫描。

## 推荐流程

1. 先确认项目中存在 ClickHouse 服务，并激活 MCP。
2. 优先查看 `system.clusters`、`system.replicas`、`system.processes`、`system.parts` 等 system 表，建立当前运行状态。
3. 再通过 `system.tables`、表结构和小样本查询确认受影响的数据集。
4. 只有在确认目标表和时间范围后，才下钻到慢查询、数据缺失或写入延迟问题。
5. 用 system 表证据和业务样本共同支撑结论，再停用 MCP。

## 查询策略

- 先看 system 表，再看业务表；不要先猜业务库名或表名。
- 对慢查询问题优先使用 `system.query_log`、`system.processes` 和表结构，不直接跑复杂业务 SQL。
- 对数据缺失或延迟问题先用聚合和样本确认时间范围，再对比分区、副本、merge 状态。
- 每次业务查询都要带 `LIMIT`、明确时间范围或可验证过滤条件。

## 风险边界

- 默认只读，只执行查询和元数据探测。
- 如果没有足够的服务配置、认证信息或查询结果与假设不一致，应报告不确定性，不要硬推根因。

## 输出要求

- 最终回复必须写明：受影响的库表或分区、关键 system 表证据、关键业务样本或聚合结果、根因判断，以及是否已经激活 MCP。
