---
name: "Airflow DAG 诊断"
description: "诊断 Apache Airflow DAG 执行异常，包括任务失败、调度延迟、依赖问题"
mcpServers:
  - airflow
applicableServiceTypes:
  - airflow
riskLevel: read-only
---

# Airflow DAG 诊断方法论

## 适用场景

- DAG 任务执行失败
- 任务调度延迟
- 任务依赖阻塞
- DAG 解析错误
- Worker 资源不足

## 诊断步骤

### 1. 检查 DAG 状态

- 列出所有 DAG 及其状态（active/paused）
- 找到与告警相关的 DAG
- 检查 DAG 是否被暂停（is_paused）

### 2. 查看 DAG Run

- 获取最近的 DAG Run 列表
- 检查 Run 状态（success/failed/running）
- 关注 execution_date 和实际执行时间的差异（调度延迟）

### 3. 分析任务实例

- 列出失败 DAG Run 中的所有 Task Instance
- 找到第一个失败的任务
- 查看任务日志，获取错误详情

### 4. 检查任务依赖

- 查看 DAG 的任务依赖图
- 确认是否有上游任务失败导致下游阻塞
- 检查 trigger_rule 设置

### 5. 检查资源和配置

- 查看 Airflow 变量和连接配置
- 检查 Worker 并发数和队列状态
- 确认外部依赖（数据库、API）是否可用

### 6. 输出诊断结论

- 总结 DAG 执行异常的根因
- 列出受影响的任务和数据管道
- 建议修复措施（重试任务、修复配置等）

## 常见模式

| 症状 | 根因 | 诊断方向 |
|------|------|----------|
| 任务 failed | 代码或配置错误 | 查看任务日志 |
| 调度延迟 | Scheduler 过载 | 检查 Scheduler 状态 |
| 任务 upstream_failed | 上游依赖失败 | 检查上游任务 |
| DAG 不显示 | 解析错误 | 检查 DAG 文件语法 |

## 安全注意事项

- 只读操作，不触发 DAG Run 或清除任务状态
- 不修改 DAG 配置或变量
