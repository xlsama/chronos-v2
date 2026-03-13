---
name: "PostgreSQL 运维诊断"
description: "诊断 PostgreSQL 数据库运维问题，包括定时任务异常、数据缺失、连接池耗尽、慢查询"
mcpServers:
  - postgresql
applicableServiceTypes:
  - postgresql
riskLevel: read-only
---

# PostgreSQL 运维诊断方法论

## 适用场景

- 定时任务不执行或失败
- 数据缺失或不一致
- 连接超时或拒绝
- 慢查询导致的性能问题
- 数据同步延迟

## 诊断步骤

### 1. 确认数据缺失范围

- 查询目标数据表，确认最近一条有效数据的时间
- 与预期的更新频率对比，判断缺失了多长时间的数据
- 通过 COUNT 和 GROUP BY 统计各时间段的数据量

### 2. 检查定时任务状态

- 查询 scheduled_jobs 表，获取所有任务的状态
- 重点关注 `is_enabled` 字段（false 表示任务被禁用）
- 查看 `last_run_at` 判断任务最后一次成功执行的时间
- 检查 `error_message` 字段获取禁用或失败原因

### 3. 查看错误日志

- 查询 app_errors 表，筛选相关服务的日志
- 按时间排序，追溯问题首次出现的时间
- 关注 "job is disabled"、"skipped"、"stale data" 等关键词

### 4. 排查数据源

- 查询 data_sources 表确认各数据源连接状态
- 检查 `last_sync_at` 判断同步是否正常
- 如果数据源正常，问题通常在处理任务本身

### 5. 形成诊断结论

- 关联所有发现，确定根因
- 评估业务影响（缺失数据的时间范围和涉及的指标）
- 提出修复建议（启用任务、补跑数据等）

## 常见模式

| 症状 | 根因 | 查询 |
|------|------|------|
| 报表数据缺失 | 定时任务被禁用 | `SELECT * FROM scheduled_jobs WHERE is_enabled = false` |
| 连接超时 | 连接池耗尽 | `SELECT count(*) FROM pg_stat_activity` |
| 数据不一致 | 事务未提交 | 检查 pg_locks 和 pg_stat_activity |

## 安全注意事项

- 只执行 SELECT 查询，不执行 INSERT/UPDATE/DELETE
- 避免执行无 WHERE 条件的全表扫描
