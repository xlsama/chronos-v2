---
name: "Kubernetes 工作负载诊断"
description: "当事件指向 Kubernetes Pod 崩溃、滚动发布失败、服务不可达、资源不足、探针失败或工作负载异常时使用。通过只读 Kubernetes MCP 查询工作负载、事件、日志和资源状态定位根因。"
mcpServers:
  - kubernetes
applicableServiceTypes:
  - kubernetes
riskLevel: read-only
---

# Kubernetes 工作负载诊断

## 任务目标

- 用只读 Kubernetes MCP 确认异常 namespace、workload、Pod、事件和日志证据，形成可验证的根因判断。

## 运行上下文

- 该 skill 在 Chronos 服务端容器内执行，不依赖用户本机环境。
- 优先使用 Kubernetes MCP；如果 MCP 激活失败，可使用 `runContainerCommand` 检查 kubeconfig 或容器内工具，但不要伪造集群结果。
- 先定位 namespace 和 workload，再下钻到 Pod 和事件。

## 推荐流程

1. 先确认项目中存在 Kubernetes 服务，并激活 MCP。
2. 查看 namespace、Deployment、StatefulSet、Pod 概览，定位状态异常或最近变更对象。
3. 优先查 Pod 状态、事件和最近日志，再看 ReplicaSet、Service、Node 或 HPA。
4. 把 `CrashLoopBackOff`、`OOMKilled`、`Pending`、`ImagePullBackOff`、探针失败等症状分开判断。
5. 有证据后再输出结论，不把旧的健康状态缓存当成事实。

## 查询策略

- 先确定受影响的 namespace 和 workload，避免全量扫集群。
- 事件优先于猜测：调度失败看 events，应用崩溃看 logs，副本不齐看 rollout / ReplicaSet，资源不足看 Node 与 requests/limits。
- 对网络或依赖问题，优先判断是 Pod 自身异常、Service 配置问题还是下游依赖异常。
- 如果需要补充 CLI，只能用来辅助检查本容器能力，不替代集群查询。

## 风险边界

- 默认只读，不执行 delete、scale、rollout restart、patch 或 exec。
- 如果 kubeconfig、token、证书或网络访问缺失，直接报告阻塞。

## 输出要求

- 最终回复必须写明：异常 namespace / workload / Pod、关键事件或日志证据、根因判断，以及是否已经激活 MCP。
