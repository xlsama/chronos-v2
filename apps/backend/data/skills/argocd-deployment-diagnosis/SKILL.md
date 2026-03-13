---
name: "ArgoCD 部署诊断"
description: "诊断 ArgoCD 应用部署异常，包括同步失败、健康检查异常、配置漂移"
mcpServers:
  - argocd
applicableServiceTypes:
  - argocd
riskLevel: read-only
---

# ArgoCD 部署诊断方法论

## 适用场景

- 应用同步（Sync）失败
- 应用健康状态异常（Degraded/Missing）
- Git 仓库到集群的配置漂移（OutOfSync）
- 部署后服务不正常
- Rollback 需求分析

## 诊断步骤

### 1. 检查应用状态

- 列出所有 ArgoCD Application
- 关注 sync status（Synced/OutOfSync）和 health status（Healthy/Degraded/Missing）
- 找到与告警相关的应用

### 2. 查看同步详情

- 获取应用的详细同步状态
- 查看最近的同步操作结果
- 检查同步错误信息和失败的资源

### 3. 分析资源状态

- 查看应用管理的 Kubernetes 资源列表
- 检查每个资源的健康状态
- 关注 Degraded 或 Missing 状态的资源

### 4. 检查配置差异

- 对比 Git 仓库中的期望状态和集群中的实际状态
- 找出配置漂移的具体字段
- 确认是否有人手动修改了集群资源

### 5. 查看历史记录

- 查看应用的部署历史
- 对比上一次成功部署和当前失败部署的差异
- 分析是哪个变更导致了问题

### 6. 输出诊断结论

- 总结部署失败或异常的根因
- 列出受影响的资源和服务
- 建议修复措施（回滚、修复配置等）

## 常见模式

| 状态 | 含义 | 诊断方向 |
|------|------|----------|
| OutOfSync | 配置漂移 | 检查 diff 找出变更 |
| Degraded | 资源不健康 | 检查 Pod/Deployment 状态 |
| Missing | 资源缺失 | 检查是否被手动删除 |
| SyncFailed | 同步失败 | 查看错误日志 |

## 安全注意事项

- 只读操作，不触发 Sync/Rollback 等操作
- 不修改应用配置或仓库
