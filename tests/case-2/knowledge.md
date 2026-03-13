# 优惠券促销服务架构文档

## 概述

电商促销平台的优惠券服务（Coupon Service）负责优惠券的创建、发放、核销和统计。核心业务流程：运营创建优惠券批次 → 系统按批次生成优惠券 → 用户领取 → 下单时核销。所有优惠券数据存储在 MySQL 中。

## 服务上下游关系

### 上游（调用 Coupon Service 的服务）
- **Order Service**：下单时调用核销接口验证和消费优惠券
- **Payment Service**：支付前再次校验优惠券有效性
- **CRM Service**：客服系统查询用户优惠券状态和处理投诉

### 下游（Coupon Service 调用的服务）
- **Notification Service**：优惠券即将过期时发送提醒
- **Analytics Service**：上报优惠券使用统计

## 数据库表结构

### coupon_batches（优惠券批次表）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INT AUTO_INCREMENT | 批次 ID |
| batch_code | VARCHAR(50) UNIQUE | 批次编码（如 SPRING2026） |
| campaign_name | VARCHAR(100) | 活动名称 |
| discount_type | ENUM('percentage','fixed') | 折扣类型 |
| discount_value | DECIMAL(10,2) | 折扣值 |
| total_count | INT | 总发放数量 |
| expire_date | DATE | 批次级过期日期 |
| status | ENUM('active','expired','cancelled') | 批次状态 |
| created_at | TIMESTAMP | 创建时间 |

### coupons（优惠券明细表）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INT AUTO_INCREMENT | 优惠券 ID |
| coupon_code | VARCHAR(50) UNIQUE | 优惠券码 |
| batch_id | INT | 关联批次 ID（FK → coupon_batches.id） |
| user_id | INT | 领取用户 ID |
| status | ENUM('available','used','expired','cancelled') | 优惠券状态 |
| expire_date | DATE | **优惠券级过期日期**（正常应与批次一致或更早） |
| used_at | TIMESTAMP NULL | 核销时间 |
| created_at | TIMESTAMP | 创建时间 |

**重要约束**：`expire_date` 必须大于当前日期（NOW()），否则核销时会校验失败，返回"优惠券已过期"。

### redemption_logs（核销日志表）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INT AUTO_INCREMENT | 日志 ID |
| coupon_id | INT | 优惠券 ID |
| coupon_code | VARCHAR(50) | 优惠券码 |
| user_id | INT | 操作用户 ID |
| order_id | VARCHAR(50) | 关联订单号 |
| action | ENUM('redeem','validate','reject') | 操作类型 |
| result | ENUM('success','failure') | 结果 |
| failure_reason | VARCHAR(200) NULL | 失败原因 |
| attempted_at | TIMESTAMP | 操作时间 |

### app_errors（应用错误日志表）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INT AUTO_INCREMENT | 错误 ID |
| service | VARCHAR(50) | 服务名 |
| level | ENUM('warn','error','critical') | 错误级别 |
| message | TEXT | 错误信息 |
| context | JSON NULL | 上下文信息 |
| created_at | TIMESTAMP | 创建时间 |

## 核销流程与校验逻辑

1. 用户下单，Order Service 调用 Coupon Service 的核销接口
2. Coupon Service 校验：
   - 优惠券状态是否为 `available`
   - **`expire_date` 是否大于当前日期**（关键校验点！）
   - 用户 ID 是否匹配
3. 校验通过 → 更新状态为 `used`，记录 `used_at`
4. 校验失败 → 记录 `redemption_logs`（`result='failure'`），返回失败原因

## 常见故障场景及排查

### 优惠券核销失败 — "优惠券已过期"

**现象**：用户反馈在有效期内的优惠券无法使用，系统提示"优惠券已过期"。但活动明明还在进行中。

**排查步骤**：

1. **检查优惠券过期日期**：查询 `coupons` 表中相关优惠券的 `expire_date`，确认是否被设置为过去的日期
2. **关联批次信息**：对比 `coupon_batches` 表中批次的 `expire_date` 和优惠券的 `expire_date`，查看是否不一致
3. **检查核销日志**：查询 `redemption_logs` 表，过滤 `failure_reason='coupon_expired'`，确认影响范围和时间线
4. **检查应用错误日志**：查询 `app_errors` 表，查看相关的错误信息和时间线
5. **关联分析**：对比批次级过期日期与优惠券级过期日期的差异，找出异常数据

**常见根因**：
- 运维批量更新脚本 SQL 错误，将优惠券的 `expire_date` 设为过去的日期
- 数据迁移时日期字段映射错误
- 手动修改数据时误操作

### 诊断要点

- 正常情况下，优惠券的 `expire_date` 应与所属批次的 `expire_date` 一致
- 当优惠券的 `expire_date` 早于当前日期，而批次的 `expire_date` 是未来日期时，说明优惠券级别的日期被错误修改
- 重点关注 `expire_date = '2025-01-01'` 这类明显异常的过去日期
