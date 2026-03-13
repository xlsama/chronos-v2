---
name: "Loki 日志分析"
description: "通过 Grafana Loki 查询和分析应用日志，定位错误根因和异常模式"
mcpServers:
  - loki
applicableServiceTypes:
  - loki
riskLevel: read-only
---

# Loki 日志分析方法论

## 适用场景

- 应用错误日志集中排查
- 按标签过滤特定服务/Pod 的日志
- 分析日志中的错误模式
- 结合时间范围追踪事件链
- 日志量异常检测

## 诊断步骤

### 1. 确定查询范围

- 根据告警信息确定目标服务/容器的标签
- 确定时间范围（告警前后 30 分钟通常足够）
- 常用标签：`{app="service-name", namespace="production"}`

### 2. 查询错误日志

- 使用 LogQL 查询错误级别日志
- `{app="payment-service"} |= "error"` 基本过滤
- `{app="payment-service"} | json | level="error"` JSON 日志解析
- 按时间顺序查看，找到最早的错误

### 3. 分析错误模式

- 使用 `| pattern` 或正则提取错误类型
- 使用 `count_over_time` 统计错误频率
- 对比不同 Pod 的错误分布

### 4. 关联上下文

- 通过 trace_id 查询完整调用链日志
- 查看错误前后的相关日志（debug/info 级别）
- 关联多个服务的日志，重建事件时间线

### 5. 输出诊断结论

- 总结错误模式和根因
- 提供关键日志片段作为证据
- 建议修复方向

## 常用 LogQL 查询

| 场景 | LogQL |
|------|-------|
| 错误日志 | `{app="svc"} \|= "error"` |
| JSON 过滤 | `{app="svc"} \| json \| level="error"` |
| 错误计数 | `count_over_time({app="svc"} \|= "error" [5m])` |
| 正则提取 | `{app="svc"} \|~ "Exception: .*"` |

## 安全注意事项

- 只执行日志查询，不修改日志流配置
- 日志中可能包含敏感数据，注意保护
