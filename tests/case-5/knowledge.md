# 数据分析平台报表架构文档

## 概述

数据分析平台（Analytics Service）是公司核心的 BI 数据服务，负责定时聚合各业务线数据并生成标准化报表。该服务使用 PostgreSQL 16 作为主数据库，数据库名称为 `analytics_service`。平台通过定时任务机制自动生成日报、周报等报表数据，供业务方通过 BI 看板查阅。

## 数据库表结构

### scheduled_jobs 表（定时任务配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL, PK | 任务唯一标识 |
| job_name | VARCHAR(100), NOT NULL | 任务名称（唯一标识符） |
| cron_expression | VARCHAR(50), NOT NULL | Cron 表达式，定义执行频率 |
| handler | VARCHAR(200), NOT NULL | 任务处理器（类.方法） |
| is_enabled | BOOLEAN, DEFAULT true | 是否启用 |
| last_run_at | TIMESTAMP | 上次执行时间 |
| next_run_at | TIMESTAMP | 下次预计执行时间 |
| run_count | INT, DEFAULT 0 | 累计执行次数 |
| status | VARCHAR(20), DEFAULT 'idle' | 当前状态：idle / running / error / disabled |
| error_message | TEXT | 最近一次错误信息 |
| created_at | TIMESTAMP, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP, DEFAULT NOW() | 更新时间 |

**关键任务说明**：
- `generate_daily_report`：每日凌晨 2:00 执行（cron: `0 2 * * *`），负责聚合前一天的业务数据并写入 daily_reports 表。这是最重要的定时任务，如果该任务停止运行，BI 看板将无法获取最新数据。
- `hourly_data_sync`：每小时执行，负责从各数据源同步增量数据。
- `weekly_cleanup`：每周日凌晨 3:00 执行，清理过期的临时数据和日志。

**is_enabled 字段**：当设置为 `false` 时，调度器会跳过该任务并在 app_errors 中记录 "job is disabled" 的日志。系统升级、数据迁移等场景下可能临时禁用任务，但必须在操作完成后重新启用。

### daily_reports 表（日报数据）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL, PK | 记录唯一标识 |
| report_date | DATE, NOT NULL | 报表日期 |
| metric_name | VARCHAR(100), NOT NULL | 指标名称（如 daily_active_users, revenue） |
| metric_value | NUMERIC(15,2), NOT NULL | 指标值 |
| department | VARCHAR(50), NOT NULL | 所属部门 |
| status | VARCHAR(20), DEFAULT 'generated' | 报表状态 |
| generated_by | VARCHAR(50), DEFAULT 'scheduled_job' | 生成来源 |
| created_at | TIMESTAMP, DEFAULT NOW() | 生成时间 |

BI 看板通过查询此表获取展示数据。正常情况下，每天凌晨都会写入新的日期数据。如果某天没有数据，说明 `generate_daily_report` 任务未正常执行。

### data_sources 表（数据源配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL, PK | 数据源唯一标识 |
| name | VARCHAR(100), NOT NULL | 数据源名称 |
| source_type | VARCHAR(50), NOT NULL | 类型：postgresql / mysql / elasticsearch |
| connection_info | JSONB, DEFAULT '{}' | 连接配置 |
| last_sync_at | TIMESTAMP | 最后同步时间 |
| sync_status | VARCHAR(20), DEFAULT 'idle' | 同步状态 |
| record_count | INT, DEFAULT 0 | 已同步记录数 |

数据源配置决定了报表生成任务从哪里获取原始数据。如果数据源同步正常但报表缺失，问题通常出在报表生成任务本身。

### app_errors 表（应用错误日志）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL, PK | 日志唯一标识 |
| timestamp | TIMESTAMP, DEFAULT NOW() | 错误发生时间 |
| service | VARCHAR(100), NOT NULL | 来源服务 |
| level | VARCHAR(20), DEFAULT 'error' | 日志级别：info / warn / error / critical |
| message | TEXT, NOT NULL | 错误信息 |
| stack_trace | TEXT | 堆栈跟踪 |

## 常见问题排查指南

### 报表数据缺失

**现象**：BI 看板数据未更新，用户反馈看到的是过期数据。

**排查步骤**：
1. 查询 `daily_reports` 表，确认最新 `report_date` 是哪天，判断数据缺失天数
2. 查询 `scheduled_jobs` 表中 `generate_daily_report` 任务的状态：检查 `is_enabled` 是否为 true、`last_run_at` 和 `status`
3. 查看 `app_errors` 表中是否有 "job is disabled" 或执行失败的日志
4. 如果定时任务已禁用，需排查禁用原因（通常是系统升级或手动操作后忘记重新启用）
5. 确认 `data_sources` 的同步状态，排除数据源连接问题

### 定时任务被意外禁用

系统升级过程中，运维脚本可能会临时禁用定时任务以避免数据冲突。升级完成后应自动恢复，但如果恢复步骤失败或被跳过，任务将持续处于禁用状态。排查时应首先检查 `scheduled_jobs` 表的 `is_enabled` 字段和 `error_message` 字段，其中会记录禁用的原因和时间。

### 告警阈值

当 `daily_reports` 表中最新 `report_date` 距今超过 1 天时，监控系统会触发 P2 告警。超过 3 天时升级为 P1 告警。
