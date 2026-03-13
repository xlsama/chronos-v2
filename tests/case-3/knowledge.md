# 微服务电商平台监控架构文档

## 概述

微服务电商平台采用 Prometheus 作为统一监控系统，覆盖所有核心服务的健康状态、性能指标和资源使用情况。所有服务指标通过 Pushgateway 汇聚后由 Prometheus 采集存储。

## 服务上下游关系

### 核心服务拓扑

```
API Gateway
  ├── order-service → payment-service → bank-gateway（第三方）
  │                 → inventory-service
  └── user-service  → notification-service
```

### 服务说明

- **API Gateway**：流量入口，路由到各业务服务
- **order-service**：订单服务，处理下单、查询等业务，依赖 payment-service 完成支付
- **payment-service**：**核心支付服务**，处理支付请求，调用 bank-gateway 完成扣款。故障影响所有涉及支付的业务流程
- **user-service**：用户服务，处理注册、登录、个人信息等
- **inventory-service**：库存服务，order-service 下单时扣减库存
- **notification-service**：通知服务，用户操作后发送邮件/短信通知
- **bank-gateway**：第三方银行网关，payment-service 的下游依赖

### 故障影响链

当 **payment-service** 不可用时：
1. order-service 无法完成支付环节 → 用户下单失败
2. API Gateway 返回 500/503 给客户端
3. 影响所有需要支付的业务场景（下单、续费、充值等）

## 最小指标诊断顺序

为了避免在监控场景里做无效查询，建议按以下顺序观察：

1. `http_requests_total`：先确认哪个服务的 500 占比最高
2. `service_up`：确认该服务当前是否不可用
3. `pod_restart_count`：判断是否存在持续重启
4. `container_memory_usage_bytes` / `container_memory_limit_bytes`：判断是否资源打满

如果同一个服务在以上四类指标上同时异常，通常已经足够形成较强的根因判断，不需要再大范围搜索无关服务。

## Prometheus 监控指标说明

### 请求指标

- **`http_requests_total`**
  - 标签：`service`（服务名）、`endpoint`（接口路径）、`status`（HTTP 状态码）
  - 含义：HTTP 请求累计计数
  - 诊断用途：通过 `status="500"` 与 `status="200"` 的比值判断错误率
  - **告警阈值**：错误率 > 10% 需要关注，> 50% 为严重故障

### 服务存活指标

- **`service_up`**
  - 标签：`service`（服务名）
  - 值：`1` = 正常运行，`0` = 服务不可用
  - **关键指标**：任何服务 `service_up = 0` 都需要立即处理

### Pod 重启指标

- **`pod_restart_count`**
  - 标签：`service`（服务名）、`pod`（Pod 名称）
  - 含义：Pod/容器重启累计次数
  - **告警阈值**：> 5 次需关注，> 10 次说明存在持续性问题（如 OOM Kill、CrashLoopBackOff）

### 内存指标

- **`container_memory_usage_bytes`**
  - 标签：`service`（服务名）、`pod`（Pod 名称）
  - 含义：容器当前内存使用量（字节）

- **`container_memory_limit_bytes`**
  - 标签：`service`（服务名）、`pod`（Pod 名称）
  - 含义：容器内存上限（字节）
  - **诊断用途**：`usage / limit` 比值接近 100% 说明即将 OOM

## 常见故障场景及排查

### 服务大量 500 错误

**现象**：某个服务的 HTTP 500 错误率突然飙升。

**排查步骤**：

1. **查错误率**：查询 `http_requests_total` 中 `status="500"` 的计数，对比 `status="200"` 的计数，计算错误率
2. **查服务存活**：查询 `service_up` 指标，确认服务是否还在运行
3. **查重启次数**：查询 `pod_restart_count` 指标，确认是否频繁重启
4. **查内存使用**：查询 `container_memory_usage_bytes` 与 `container_memory_limit_bytes`，确认是否内存溢出
5. **关联分析**：如果内存使用接近或等于上限 + 频繁重启，大概率是内存泄漏导致 OOM Kill

### 内存泄漏导致 OOM

**现象**：服务频繁重启，重启后短时间内又崩溃。

**排查要点**：
- `container_memory_usage_bytes` 接近或等于 `container_memory_limit_bytes`
- `pod_restart_count` 持续增长
- `service_up` 在 0 和 1 之间频繁切换
- 错误率飙升，大量 500 响应

**常见根因**：
- 应用代码内存泄漏（未释放的对象、缓存无上限等）
- JVM 堆内存配置不当
- 大量并发请求导致内存暴涨

### 跨服务排查

当多个指标异常时，按以下优先级排查：
1. 先确认哪个服务异常（对比各服务的 `service_up` 和错误率）
2. 确认异常服务的资源使用情况（内存、重启次数）
3. 根据服务依赖关系，判断是上游还是下游导致的问题
4. 正常服务的指标可以作为基线对照

`order-service` 和 `user-service` 在这个场景里主要承担基线对照作用；如果它们指标稳定而 `payment-service` 明显异常，应优先锁定支付服务本身。
