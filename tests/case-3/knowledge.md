# 微服务电商平台监控架构文档

## 概述

平台使用 Prometheus 统一采集核心微服务的健康状态、请求结果和资源使用情况。指标通过 Pushgateway 汇聚后由 Prometheus 抓取。

## 服务拓扑

```text
API Gateway
  ├── order-service -> payment-service -> bank-gateway
  │                 -> inventory-service
  └── user-service  -> notification-service
```

## 关键服务

- `payment-service`：支付链路核心服务，异常会直接阻断支付相关业务
- `order-service`：依赖 `payment-service` 完成支付闭环
- `user-service`：相对独立，可作为对照服务观察

## 关键指标类别

### 请求结果

- 指标示例：`http_requests_total`
- 常见标签：`service`、`endpoint`、`status`
- 用途：观察不同服务的请求量和错误分布

### 服务可用性

- 指标示例：`service_up`
- 用途：判断服务当前是否可达

### 重启与稳定性

- 指标示例：`pod_restart_count`
- 用途：观察工作负载是否存在持续重启或恢复失败

### 资源使用

- 指标示例：`container_memory_usage_bytes`、`container_memory_limit_bytes`
- 用途：判断容器资源压力是否异常

## 指标解读原则

- 对比异常服务与健康服务，而不是只看单个时间点
- 将请求失败、可用性变化、重启和资源压力放在同一时间窗口观察
- 如果多个服务同时异常，优先判断谁先出现显著变化，再区分源头与级联影响

## 观测建议

- 先确认问题集中在哪个服务，再决定是否继续按 pod、instance 或依赖方向下钻
- 对支付类故障，除了目标服务本身，也要结合其上下游关系解释影响范围
