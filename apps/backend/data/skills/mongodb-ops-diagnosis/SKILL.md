---
name: "MongoDB 运维诊断"
description: "当事件指向 MongoDB 查询变慢、连接异常、副本集延迟、数据结构异常、索引问题或文档缺失时使用。通过只读 MongoDB MCP 查询库集合、索引、serverStatus 和样本文档定位根因。"
mcpServers:
  - mongodb
applicableServiceTypes:
  - mongodb
riskLevel: read-only
---

# MongoDB 运维诊断

## 任务目标

- 用只读 MongoDB 查询确认慢查询、连接瓶颈、副本集异常或文档结构问题，给出可验证的证据链。

## 运行上下文

- 该 skill 在 Chronos 服务端容器内执行，不依赖用户本机环境。
- 优先使用 MongoDB MCP；如需补充能力，只能在说明用途后使用 `runContainerCommand`。
- 先确认数据库、集合和索引结构，再看业务文档内容。

## 推荐流程

1. 确认项目中存在 MongoDB 服务，并激活 MCP。
2. 先查看数据库、集合、索引和整体状态，不要先猜集合名。
3. 对慢查询问题优先看索引、查询计划或 profile 信息；对数据问题优先看样本文档和字段分布。
4. 对复制或可用性问题优先看副本集状态、节点角色和同步延迟。
5. 用结构信息和样本证据共同支撑结论。

## 查询策略

- 先列库列集合，再查索引和样本，不要直接对未知集合跑大查询。
- 不要假设 `system.profile`、特定慢查询阈值或某个字段一定存在；先确认再使用。
- 数据异常问题优先用样本、聚合和字段统计，不要只凭单条文档下结论。
- 如果涉及连接或副本集问题，优先看 serverStatus 和 replica set 信息，而不是业务集合。

## 风险边界

- 默认只读，不执行 insert、update、delete、drop、compact 或索引变更。
- 如果连接串、认证或副本集权限不完整，应明确报告阻塞。

## 输出要求

- 最终回复必须写明：目标库或集合、关键状态或样本证据、根因判断，以及是否已经激活 MCP。
