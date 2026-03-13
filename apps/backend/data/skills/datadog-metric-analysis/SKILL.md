---
name: "Datadog 指标分析"
description: "当事件指向 Datadog 指标、日志、APM 链路、延迟升高、错误率异常或基础设施资源波动时使用。通过只读 Datadog MCP 查询时间序列、tags、日志和 traces 定位根因。"
mcpServers:
  - datadog
applicableServiceTypes:
  - datadog
riskLevel: read-only
---

# Datadog 指标分析

## 任务目标

- 用只读 Datadog 查询确认异常服务、异常指标、相关日志或 trace，并给出可验证的根因证据。

## 运行上下文

- 该 skill 在 Chronos 后端容器中执行，不依赖用户本机环境。
- 优先使用 Datadog MCP；只有当 MCP 不足时才考虑 `runContainerCommand` 作为辅助。
- 先收敛时间范围、环境和服务标签，再做下钻。

## 推荐流程

1. 用告警信息先锁定时间窗口、环境和候选服务。
2. 激活 MCP 后优先查看可用指标、tags、日志源或 trace 维度，不要先猜指标名。
3. 先做聚合趋势，找异常最大的服务、主机或容器，再查看单条日志和单条 trace。
4. 只有在指标已经指向某个服务或依赖后，才做更细的链路和日志关联。
5. 输出结论时同时给出指标证据与上下文证据。

## 查询策略

- 先确认 tags 和资源维度，再查询具体 metric，避免盲目枚举高基数字段。
- 对延迟、错误率、资源压力等问题先做聚合趋势，再按 service、host、container 等维度拆分。
- 指标异常后再补日志或 trace，避免只凭单条错误日志下结论。
- 如果多个服务同时异常，优先找最早出现拐点的维度，避免把级联故障误判为根因。

## 风险边界

- 默认只读，不创建或修改 Dashboard、Monitor、SLO 或告警规则。
- 如果缺少 Datadog API Key、权限不足或站点配置不正确，直接报告阻塞。

## 输出要求

- 最终回复必须写明：时间范围、异常服务或维度、关键指标和日志或 trace 证据、根因判断，以及是否已经激活 MCP。
