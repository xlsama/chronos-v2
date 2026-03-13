---
name: "Grafana 仪表板诊断"
description: "通过 Grafana 仪表板和其数据源代理查询指标，诊断服务性能问题、异常告警和资源使用。仅在项目中存在 Grafana 服务时使用本技能。"
mcpServers:
  - grafana
applicableServiceTypes:
  - grafana
riskLevel: read-only
---

# Grafana 仪表板诊断方法论

## 适用场景

- 监控告警触发需要排查
- 服务 SLA 下降需要定位原因
- 资源使用异常（CPU/内存/磁盘）
- 需要通过指标数据辅助诊断
- Prometheus 指标分析

## 诊断步骤

### 1. 搜索相关仪表板

- 根据告警信息中的服务名搜索对应的 Dashboard
- 列出可用的 Dashboard，找到最相关的面板
- 获取 Dashboard 详情，了解包含的面板和数据源

### 2. 查询关键指标

- 通过 Grafana 数据源代理执行 PromQL 查询
- 常用查询：
  - 错误率：`rate(http_requests_total{status=~"5.."}[5m])`
  - CPU 使用：`rate(container_cpu_usage_seconds_total[5m])`
  - 内存使用：`container_memory_usage_bytes / container_memory_limit_bytes`
  - 请求延迟：`histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))`

### 3. 分析时间序列

- 对比告警前后的指标变化趋势
- 确定异常开始的精确时间点
- 与部署事件时间线对比

### 4. 服务间关联

- 查询上下游服务的指标
- 通过服务依赖关系确定是否是级联故障
- 检查数据库连接池、外部 API 响应时间等

### 5. 输出诊断结论

- 基于指标数据给出根因判断
- 提供关键指标的数值变化
- 建议后续排查方向或修复措施

## 常见 PromQL 模式

| 场景 | PromQL |
|------|--------|
| 服务错误率 | `rate(http_requests_total{status="500"}[5m]) / rate(http_requests_total[5m])` |
| Pod 重启次数 | `increase(kube_pod_container_status_restarts_total[1h])` |
| 内存使用率 | `container_memory_usage_bytes / container_memory_limit_bytes * 100` |
| 请求 P99 延迟 | `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))` |

## 安全注意事项

- 只读操作，不修改 Dashboard 或告警规则
- Grafana API Key 权限应限制为 Viewer
