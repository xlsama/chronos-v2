---
name: "ClickHouse 查询诊断"
description: "诊断 ClickHouse 数据查询异常、性能问题和数据完整性问题"
mcpServers:
  - clickhouse
applicableServiceTypes:
  - clickhouse
riskLevel: read-only
---

# ClickHouse 查询诊断方法论

## 适用场景

- 分析查询响应时间异常
- 数据写入延迟或丢失
- 磁盘空间不足
- 合并（merge）操作阻塞
- 分区管理问题

## 诊断步骤

### 1. 检查集群状态

- 查询 `system.clusters` 了解集群拓扑
- 查询 `system.replicas` 检查副本同步状态
- 查看当前运行中的查询 `system.processes`

### 2. 分析慢查询

- 查询 `system.query_log` 获取近期慢查询
- 按 `query_duration_ms` 排序，找到耗时最长的查询
- 分析查询计划，检查是否有全表扫描

### 3. 检查表状态

- 查询 `system.tables` 获取表大小和行数
- 查询 `system.parts` 检查分区状态和合并进度
- 检查是否有过多的小分区（parts count）

### 4. 检查数据完整性

- 对比预期数据量和实际数据量
- 检查最新数据的写入时间
- 通过采样查询验证数据质量

### 5. 检查资源使用

- 查询 `system.metrics` 和 `system.events` 获取运行指标
- 关注内存使用、磁盘IO、合并操作等
- 检查是否有资源配额限制

### 6. 输出诊断结论

- 总结性能问题或数据异常的根因
- 提供查询优化建议
- 建议分区策略调整或资源扩容

## 常见模式

| 症状 | 根因 | 查询 |
|------|------|------|
| 查询慢 | 全表扫描 | 检查 WHERE 条件和分区键 |
| 写入延迟 | 合并阻塞 | `SELECT * FROM system.merges` |
| 数据缺失 | 副本延迟 | `SELECT * FROM system.replicas` |

## 安全注意事项

- 只执行 SELECT 查询
- 避免对大表执行无分区过滤的查询
