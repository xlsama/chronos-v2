---
name: "Kafka 主题诊断"
description: "诊断 Kafka 消息队列的消费延迟、分区异常、生产者/消费者问题"
mcpServers:
  - kafka
applicableServiceTypes:
  - kafka
riskLevel: read-only
---

# Kafka 主题诊断方法论

## 适用场景

- 消费者组 lag 过大
- 消息积压告警
- 分区 leader 不均衡
- 消费者频繁 rebalance
- 生产者发送失败

## 诊断步骤

### 1. 检查集群概览

- 列出所有 Broker 状态
- 检查集群控制器是否正常
- 确认各 Broker 的分区分布

### 2. 检查 Topic 状态

- 列出与告警相关的 Topic
- 检查 Topic 的分区数、副本因子和配置
- 确认各分区的 leader 和 ISR（In-Sync Replicas）

### 3. 分析消费者组

- 列出消费者组及其状态
- 查看各分区的消费偏移量和 lag
- 分析 lag 增长趋势，判断是突发还是持续

### 4. 检查分区详情

- 查看各分区的 offset 范围（earliest/latest）
- 检查是否有分区没有 leader（offline partition）
- 确认副本同步状态

### 5. 排查根因

- lag 持续增长：消费者处理速度不足
- lag 突增：消费者宕机或 rebalance
- 生产失败：Broker 磁盘满或分区 leader 不可用

### 6. 输出诊断结论

- 总结消息积压或异常的根因
- 提供 lag 数据和趋势
- 建议扩容消费者或优化消费逻辑

## 常见模式

| 症状 | 根因 | 诊断方向 |
|------|------|----------|
| lag 持续增长 | 消费速度不足 | 增加消费者实例 |
| lag 突增后稳定 | 消费者重启 | 检查消费者日志 |
| 分区 offline | leader Broker 宕机 | 检查 Broker 状态 |
| 频繁 rebalance | 消费者超时 | 检查 session.timeout |

## 安全注意事项

- 只读操作，不修改 Topic 配置或 offset
- 不消费或生产消息
