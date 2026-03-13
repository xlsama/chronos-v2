---
name: "RabbitMQ 队列诊断"
description: "诊断 RabbitMQ 消息队列的消息积压、连接异常、消费者问题"
mcpServers:
  - rabbitmq
applicableServiceTypes:
  - rabbitmq
riskLevel: read-only
---

# RabbitMQ 队列诊断方法论

## 适用场景

- 队列消息积压
- 消费者断连或无消费者
- 连接数超限
- 内存或磁盘告警
- 消息投递失败（dead letter）

## 诊断步骤

### 1. 检查节点状态

- 查看 RabbitMQ 节点健康状态
- 检查内存和磁盘使用情况
- 确认是否触发了 flow control（流控）

### 2. 检查队列状态

- 列出所有队列，关注消息数量（messages_ready + messages_unacknowledged）
- 检查消费者数量（consumers），为 0 说明无消费者
- 查看消息入队/出队速率

### 3. 分析消费者

- 查看队列绑定的消费者信息
- 检查消费者的 prefetch_count 设置
- 确认消费者是否有异常断连

### 4. 检查连接和通道

- 列出活跃连接，检查连接数是否超限
- 查看每个连接的通道数
- 检查是否有长时间未确认的消息

### 5. 检查死信队列

- 查看是否配置了 DLX（Dead Letter Exchange）
- 检查死信队列中的消息数量
- 分析死信原因（rejected/expired/maxlen）

### 6. 输出诊断结论

- 总结消息积压或异常的根因
- 提供队列状态数据
- 建议修复措施

## 常见模式

| 症状 | 根因 | 诊断方向 |
|------|------|----------|
| 消息积压 | 消费者不足 | 检查 consumers 数量 |
| 内存告警 | 消息堆积太多 | 检查队列深度 |
| 连接拒绝 | 连接数超限 | 检查连接数 |
| 消息丢失 | 未持久化 | 检查 durable 配置 |

## 安全注意事项

- 只读操作，不消费、发布或删除消息
- 不修改队列配置或绑定
