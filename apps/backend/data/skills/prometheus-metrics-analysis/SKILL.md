---
name: "Prometheus 指标分析"
description: "当事件指向 Prometheus 指标、服务可用性下降、错误率升高、重启激增、资源压力或监控告警验证时使用。通过只读 Prometheus MCP 查询标签、时间序列和聚合结果定位根因。"
mcpServers:
  - prometheus
applicableServiceTypes:
  - prometheus
riskLevel: read-only
---

# Prometheus 指标分析

## 任务目标

- 用只读 Prometheus 查询确认异常服务、关键指标变化、影响范围和时间线，避免只凭告警文案推断根因。

## 运行上下文

- 该 skill 在 Chronos 服务端容器内执行，不依赖用户本机环境。
- 优先使用 Prometheus MCP；如需补充工具，只能在说明用途后使用 `runContainerCommand`。
- 查询前先确认可用标签和指标，再写 PromQL，不要硬编码业务命名。

## 推荐流程

1. 确认项目中存在 Prometheus 服务，并激活 MCP。
2. 先查看目标、可用标签和值，锁定服务、job、namespace、pod 或实例范围。
3. 先做聚合趋势，识别最早和最明显异常的服务或资源，再下钻到具体维度。
4. 对可用性、错误率、重启、CPU、内存等常见方向分别验证，不要混在一条查询里。
5. 拿到足够指标证据后，再输出根因和影响面。

## 查询策略

- 先确认真实指标和标签存在，再写查询，不要假设一定有 `service_up`、`pod_restart_count` 或某个固定 label。
- 先用短时间窗聚合找趋势，再按 service、pod、instance 等维度拆分。
- 对 OOM 或崩溃问题，优先关联重启次数和资源压力；对 5xx 问题，优先看错误率和上游依赖。
- 如果多个服务同时异常，优先找最早出现异常的指标和维度，避免把级联故障误判为源头。

## 风险边界

- 默认只读，不修改规则、target、recording rule 或告警配置。
- 如果 Prometheus 指标保留不足、标签缺失或权限不足，应明确说明不确定性。

## 输出要求

- 最终回复必须写明：时间范围、异常服务或资源、关键 PromQL 证据、根因判断，以及是否已经激活 MCP。
