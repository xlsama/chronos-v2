---
name: "Prometheus Metrics Analysis"
description: "Use this skill whenever the incident is centered on a Prometheus service, Prometheus metrics, service availability, restart spikes, memory pressure, or HTTP 5xx trends. Diagnose metric-driven outages such as OOM, crash loops, high error rates, and service-down conditions through read-only Prometheus queries."
mcpServers:
  - prometheus
applicableServiceTypes:
  - prometheus
riskLevel: read-only
---

# Prometheus 指标分析方法论

## 适用场景

- 监控告警提示服务不可用
- HTTP 5xx 错误率突然升高
- Pod 或容器频繁重启
- 内存使用打满，怀疑 OOM 或内存泄漏
- 需要通过 Prometheus 指标确认故障服务和影响范围

## 诊断步骤

### 1. 先定位异常服务

- 优先查询 `http_requests_total`，按 `service` 和 `status` 区分 200/500
- 对比同一服务的成功请求和失败请求，确认哪个服务错误率最高
- 如果多个服务都报错，先找最先出现 `service_up=0` 的服务

### 2. 检查服务存活状态

- 查询 `service_up{service="<name>"}` 或等价表达式
- `service_up = 0` 说明服务当前不可用
- 将不可用服务与错误率异常的服务关联，避免把级联故障误判为根因

### 3. 检查重启和资源压力

- 查询 `pod_restart_count`，识别重启次数异常高的 Pod
- 查询 `container_memory_usage_bytes` 与 `container_memory_limit_bytes`
- 如果内存使用接近上限且重启次数持续增加，优先怀疑 OOM / 内存泄漏

### 4. 做关联判断

- 高错误率 + `service_up=0` + 重启次数高 + 内存打满，通常指向内存泄漏导致服务崩溃
- 如果只有错误率升高而资源正常，再考虑下游依赖或业务逻辑异常
- 用正常服务做基线对照，避免把全局流量波动误判为单服务故障

### 5. 输出诊断结论

- 明确指出异常服务名称
- 写出支撑结论的关键指标
- 总结根因判断和业务影响范围
- 给出后续修复建议，但保持只读诊断

## 常见查询模式

| 场景 | 建议查询 |
|------|----------|
| 服务错误率 | `sum by (service, status) (http_requests_total)` |
| 服务存活 | `service_up` |
| Pod 重启次数 | `pod_restart_count` |
| 内存使用 | `container_memory_usage_bytes` |
| 内存上限 | `container_memory_limit_bytes` |

## 安全注意事项

- 只读查询，不修改告警规则或指标源
- 先做聚合查询，再按服务下钻，避免一次性拉取无关高基数数据
