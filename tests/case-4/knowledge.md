# 商品服务数据库架构文档

## 概述

商品服务（Shop Service）是电商平台的核心微服务之一，负责管理商品信息、分类、库存和订单数据。该服务使用 MySQL 8.0 作为主数据库，数据库名称为 `shop_service`。所有商品和订单相关的业务逻辑均依赖该数据库中的数据完整性和正确性。

## 数据库表结构

### categories 表（商品分类）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT, AUTO_INCREMENT, PK | 分类唯一标识 |
| name | VARCHAR(100), NOT NULL | 分类名称 |

当前系统中包含三个主要分类：数码配件、服装鞋包、家居用品。分类决定了商品的展示位置和筛选逻辑。

### products 表（商品信息）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT, AUTO_INCREMENT, PK | 商品唯一标识 |
| name | VARCHAR(200), NOT NULL | 商品名称 |
| category_id | INT, FK → categories.id | 所属分类 |
| price | DECIMAL(10,2), NOT NULL | 商品单价（元） |
| stock | INT, NOT NULL | 库存数量 |
| status | VARCHAR(20), DEFAULT 'active' | 商品状态：active / inactive / deleted |
| created_at | DATETIME, DEFAULT NOW() | 创建时间 |

**price 字段校验规则**：商品价格必须大于 0。任何 price ≤ 0 的商品均视为数据异常，不允许参与正常交易。前端下单时会校验价格，但如果数据库层面已经存储了错误数据，前端校验可能无法完全拦截。

### orders 表（订单记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT, AUTO_INCREMENT, PK | 订单唯一标识 |
| order_no | VARCHAR(50), NOT NULL | 订单编号（格式：ORD-YYYYMMDD-NNN） |
| product_id | INT, FK → products.id | 关联商品 |
| user_id | INT, NOT NULL | 下单用户 ID |
| quantity | INT, NOT NULL | 购买数量 |
| unit_price | DECIMAL(10,2), NOT NULL | 下单时的商品单价 |
| total | DECIMAL(10,2), NOT NULL | 订单总金额 |
| status | VARCHAR(20), DEFAULT 'pending' | 订单状态：pending / completed / error / refunded |
| created_at | DATETIME, DEFAULT NOW() | 下单时间 |

**订单金额计算公式**：`total = unit_price × quantity`。订单创建时，`unit_price` 从 products 表实时读取。如果 products 表中的 price 为 0，则 unit_price 和 total 都将为 0，这会导致支付网关拒绝交易。

### app_errors 表（应用错误日志）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT, AUTO_INCREMENT, PK | 日志唯一标识 |
| timestamp | DATETIME, DEFAULT NOW() | 错误发生时间 |
| service | VARCHAR(100), NOT NULL | 来源服务名 |
| level | VARCHAR(20), DEFAULT 'error' | 日志级别：info / warn / error / critical |
| message | TEXT, NOT NULL | 错误信息 |

## 常见数据异常及排查方法

### 商品价格异常

**现象**：订单金额为 0 或负数，支付网关拒绝交易。

**排查步骤**：
1. 查询 `products` 表中 `price <= 0` 的记录，确认异常商品范围
2. 通过 `category_id` 关联 `categories` 表，判断是否为某个分类的批量问题
3. 查询 `orders` 表中 `total <= 0` 的异常订单，评估影响范围
4. 查看 `app_errors` 表中相关错误日志，追溯问题首次出现的时间
5. 根据错误发生的时间范围和涉及的分类，反查是否有近期的批量 SQL 变更操作

### 批量 SQL 操作风险

在执行 `UPDATE products SET price = ...` 这类批量修改时，如果 WHERE 条件不当（例如漏写条件或条件过宽），可能会影响非目标商品。建议在执行前先用 `SELECT COUNT(*)` 确认影响行数，并在事务中操作以便回滚。

### 订单状态异常

如果大量订单状态为 `error`，通常说明数据源头存在问题（如价格异常、库存不足等）。应优先排查 products 表的数据完整性，再检查订单服务的日志输出。
