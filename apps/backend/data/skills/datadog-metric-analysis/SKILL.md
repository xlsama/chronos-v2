---
name: "Datadog 指标分析"
description: "通过 Datadog 查询指标、日志和 APM 数据，诊断服务性能和可用性问题"
mcpServers:
  - datadog
applicableServiceTypes:
  - datadog
riskLevel: read-only
---

# Datadog 指标分析方法论

## 适用场景

- 监控告警触发需要排查指标
- 服务延迟或错误率异常
- 基础设施资源使用分析
- APM 调用链性能分析
- 日志与指标关联分析

## 诊断步骤

### 1. 查询相关指标

- 根据告警信息确定需要查询的指标名
- 使用 Datadog 指标查询 API 获取时间序列数据
- 常用指标前缀：
  - `system.*`：CPU、内存、磁盘
  - `docker.*`：容器指标
  - `trace.*`：APM 指标

### 2. 分析指标趋势

- 对比告警前后的指标变化
- 使用聚合函数（avg/max/sum）分析趋势
- 按 tag 分组（service/host/env）定位异常维度

### 3. 检查日志

- 搜索与告警时间范围匹配的日志
- 按服务和严重级别过滤
- 查看错误日志的上下文

### 4. APM 调用链分析

- 查看服务间调用关系
- 检查慢请求的调用链详情
- 分析延迟分布和错误率

### 5. 输出诊断结论

- 基于指标和日志数据给出根因判断
- 提供关键指标数值和变化趋势
- 建议后续行动

## 常用查询模式

| 场景 | 指标 |
|------|------|
| CPU 使用率 | `system.cpu.user{service:xxx}` |
| 内存使用 | `system.mem.used{service:xxx}` |
| 请求错误率 | `trace.http.request.errors{service:xxx}` |
| 请求延迟 | `trace.http.request.duration{service:xxx}` |

## 安全注意事项

- 只读操作，不创建或修改 Monitor/Dashboard
- API Key 应使用只读权限
