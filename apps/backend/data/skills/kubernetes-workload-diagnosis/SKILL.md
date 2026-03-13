---
name: "Kubernetes 工作负载诊断"
description: "诊断 Kubernetes 集群工作负载异常，包括 Pod 崩溃、部署失败、资源不足、网络问题"
mcpServers:
  - kubernetes
applicableServiceTypes:
  - kubernetes
riskLevel: read-only
---

# Kubernetes 工作负载诊断方法论

## 适用场景

- Pod CrashLoopBackOff 或 OOMKilled
- Deployment 滚动更新失败
- Service 不可达
- 节点资源不足
- HPA 扩缩容异常

## 诊断步骤

### 1. 检查 Pod 状态

- 列出目标 namespace 下的 Pod 状态
- 关注 STATUS 列：CrashLoopBackOff、Error、Pending、ImagePullBackOff
- 查看 RESTARTS 列，频繁重启说明应用持续崩溃

### 2. 查看 Pod 日志

- 获取异常 Pod 的日志，查找错误信息
- 如果 Pod 已重启，查看前一个容器的日志（previous container logs）
- 关注 OOM、panic、connection refused 等关键词

### 3. 检查 Pod 事件

- 查看 Pod 的 Events，了解调度和启动过程
- 关注 FailedScheduling（资源不足）、FailedMount（卷挂载失败）等事件
- 检查 Liveness/Readiness 探针失败信息

### 4. 检查 Deployment 状态

- 查看 Deployment 的 replicas 状态（desired vs ready）
- 检查 rollout 历史，是否有失败的发布
- 查看 ReplicaSet 状态

### 5. 检查节点资源

- 查看节点 CPU/内存使用情况
- 检查是否有节点处于 NotReady 状态
- 确认是否有资源配额限制

### 6. 输出诊断结论

- 总结根因（资源不足、配置错误、镜像问题等）
- 列出受影响的服务和 Pod
- 提供修复建议

## 常见模式

| 症状 | 根因 | 诊断方向 |
|------|------|----------|
| CrashLoopBackOff | 应用启动失败 | 查看 Pod 日志 |
| OOMKilled | 内存限制太低 | 检查 resources.limits |
| Pending | 资源不足 | 检查节点资源 |
| ImagePullBackOff | 镜像拉取失败 | 检查镜像名和拉取策略 |

## 安全注意事项

- 只读操作，不执行 kubectl delete/scale/rollout 等修改操作
- 查看敏感 Secret 时注意保护敏感信息
