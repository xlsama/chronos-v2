---
name: "Kafka 主题诊断"
description: "当事件指向 Kafka topic、消费者组积压、分区异常、rebalance、生产失败或副本不健康时使用。通过只读 Kafka MCP 查询集群、topic、partition 和 consumer group 状态定位根因。"
mcpServers:
  - kafka
applicableServiceTypes:
  - kafka
riskLevel: read-only
---

# Kafka 主题诊断

## 任务目标

- 用只读 Kafka 查询确认积压位置、异常分区、消费者组状态和副本问题，给出可验证的根因判断。

## 运行上下文

- 该 skill 在 Chronos 服务端容器内执行，不依赖用户本机环境。
- 优先使用 Kafka MCP；只有在 MCP 缺少探测能力时才考虑 `runContainerCommand` 辅助。
- 先收敛 topic、consumer group 和时间范围，再下钻到 partition。

## 推荐流程

1. 先确认项目中存在 Kafka 服务，并激活 MCP。
2. 查看集群概览、topic 列表和 consumer group 列表，锁定与告警相关的对象。
3. 对异常 topic 查看 partition、leader、ISR、副本同步和消息水位。
4. 对异常 consumer group 查看 lag、分配状态和 rebalance 迹象。
5. 将 broker、partition 和 consumer 证据拼起来后再输出结论。

## 查询策略

- 先看整体积压和异常 group，再看单个 partition，不要一开始就展开全量分区。
- 将“持续 lag 增长”“突发 lag”“无 leader”“rebalance 抖动”区分处理。
- 如果 lag 问题涉及下游消费逻辑，明确区分是 Kafka 集群问题还是消费者应用问题。
- 先使用只读元数据和 offset 证据，不消费或生产消息。

## 风险边界

- 默认只读，不修改 topic 配置、offset、ACL 或 broker 状态。
- 如果缺少 bootstrap servers、认证信息或权限不足，直接报告阻塞。

## 输出要求

- 最终回复必须写明：异常 topic 或 consumer group、关键 lag 或分区证据、根因判断，以及是否已经激活 MCP。
