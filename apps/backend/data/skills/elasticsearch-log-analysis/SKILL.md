---
name: "Elasticsearch 日志分析"
description: "当事件指向 Elasticsearch 日志搜索、错误日志激增、请求链路异常、索引健康问题或日志聚合分析时使用。通过只读 Elasticsearch MCP 查询索引、mapping、样本日志和聚合结果定位根因。"
mcpServers:
  - elasticsearch
applicableServiceTypes:
  - elasticsearch
riskLevel: read-only
---

# Elasticsearch 日志分析

## 任务目标

- 用只读 Elasticsearch 查询确认异常索引、错误模式、受影响服务和时间范围，给出基于日志证据的结论。

## 运行上下文

- 该 skill 运行在 Chronos 服务端容器内，不依赖用户本机环境。
- 优先使用 Elasticsearch MCP；只有在 MCP 不足时才考虑 `runContainerCommand`。
- 查询前先限定时间范围和索引范围，避免无边界检索。

## 推荐流程

1. 先确认 Elasticsearch 服务和可访问索引范围。
2. 激活 MCP 后先查看集群健康、索引列表、索引模式和 mapping，不要先猜字段名。
3. 确认目标索引和时间范围后，再搜索错误日志、做聚合统计和关联分析。
4. 如果需要跨服务关联，优先使用 trace ID、request ID、service 名等已确认字段。
5. 结论必须同时包含日志证据和索引范围。

## 查询策略

- 先从索引和 mapping 发现真实字段名，再写查询条件，不要猜 `level`、`service` 或 `trace_id` 是否存在。
- 先做按时间桶、服务或错误类型的聚合，再看单条日志。
- 单条日志只用于解释证据，不要把单条样本误当成整体根因。
- 如果集群健康异常，先解释分片或节点问题，再做业务日志分析。

## 风险边界

- 默认只读，不执行索引写入、删除、模板修改或设置变更。
- 如果索引权限不足、API Key 缺失或字段不存在，要明确说明不确定性。

## 输出要求

- 最终回复必须写明：目标索引、时间范围、关键聚合或样本日志证据、受影响服务、根因判断，以及是否已经激活 MCP。
