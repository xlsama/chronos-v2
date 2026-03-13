---
name: "Sentry 错误分析"
description: "当事件指向 Sentry issue、异常趋势、发布后错误激增、性能回归或用户报错排查时使用。通过只读 Sentry MCP 查询项目、issues、堆栈、breadcrumbs 和 release 上下文定位根因。"
mcpServers:
  - sentry
applicableServiceTypes:
  - sentry
riskLevel: read-only
---

# Sentry 错误分析

## 任务目标

- 用只读 Sentry 查询确认关键 issue、影响范围、堆栈证据和版本关联，给出可验证的根因判断。

## 运行上下文

- 该 skill 在 Chronos 服务端容器内执行，不依赖用户本机环境。
- 优先使用 Sentry MCP；只有在 MCP 不足时才考虑 `runContainerCommand`。
- 先锁定项目、环境和时间范围，再下钻到 issue 和 event。

## 推荐流程

1. 确认项目中存在 Sentry 服务，并激活 MCP。
2. 先定位相关项目、环境和时间范围，不要先猜 issue ID。
3. 先查看突增或新出现的 issue，再下钻到单个 event 的堆栈、breadcrumbs、tags 和 release 信息。
4. 把错误趋势与发布时间线、环境差异和影响用户数结合起来判断。
5. 结论必须同时包含错误证据和版本或环境上下文。

## 查询策略

- 先看 issue 趋势和影响范围，再看单个 event，避免把孤立事件当成主因。
- 对发布后问题优先关联 release 和 environment；对持续问题优先看是否是老 issue 波动。
- 堆栈只作为技术证据，根因判断要结合 breadcrumbs、tags、用户影响和时间线。
- 如果多个 issue 同时激增，优先找共同依赖或共同 release。

## 风险边界

- 默认只读，不修改 Issue 状态、规则、采样配置或项目设置。
- 如果 token、组织权限或目标项目不可见，直接报告阻塞。

## 输出要求

- 最终回复必须写明：目标项目或 issue、关键堆栈或趋势证据、影响范围、根因判断，以及是否已经激活 MCP。
