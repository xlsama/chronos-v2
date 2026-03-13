---
name: "ArgoCD 部署诊断"
description: "当事件指向 ArgoCD Application、同步失败、健康状态异常、配置漂移或发布后服务异常时使用。通过只读 ArgoCD MCP 查询应用状态、资源健康和部署历史定位根因。"
mcpServers:
  - argocd
applicableServiceTypes:
  - argocd
riskLevel: read-only
---

# ArgoCD 部署诊断

## 任务目标

- 用只读 ArgoCD MCP 确认异常 Application、失败资源、配置漂移和变更时间线，给出可验证的发布根因。

## 运行上下文

- 该 skill 运行在 Chronos 服务端容器内，不依赖用户本机环境。
- 优先使用 MCP 获取应用、资源和历史信息；只在 MCP 能力不足时才考虑 `runContainerCommand` 辅助探测。
- 如果确需安装额外 CLI，先说明原因和影响，再执行。

## 推荐流程

1. 先确认项目中存在 ArgoCD 服务，并记录 URL、命名空间或项目范围。
2. 激活 MCP 后先列出 Application，筛出 `OutOfSync`、`Degraded`、`Missing` 或最近同步失败的对象。
3. 对异常 Application 查看资源清单、健康状态、同步结果和部署历史。
4. 将失败资源与最近变更、集群漂移或下游 Kubernetes 事件关联。
5. 拿到证据后再输出结论，避免只凭状态名下判断。

## 查询策略

- 先从 Application 概览收敛目标，再下钻到单个资源和单次同步。
- 将 `OutOfSync` 与 `Degraded` 区分处理：前者优先看 diff，后者优先看不健康资源和错误消息。
- 结合历史记录判断问题是“当前变更引入”还是“集群被外部修改后产生漂移”。
- 如果还需要更多集群证据，再考虑切换到 Kubernetes 相关 skill 做交叉验证。

## 风险边界

- 默认只读，不执行 Sync、Rollback、Delete 或手动修正。
- 如果缺少 ArgoCD token、URL 或服务不可达，直接报告阻塞。

## 输出要求

- 最终回复必须写明：异常 Application、关键资源状态、关键同步或 diff 证据、根因判断，以及是否已经激活 MCP。
