---
name: k8s-pod-crash
description: "诊断和修复 Kubernetes Pod CrashLoopBackOff、OOMKilled 等问题"
category: kubernetes
tags: ["k8s", "pod", "crash", "oom", "crashloopbackoff"]
required_mcp_servers: []
risk_level: high
---

# Kubernetes Pod 崩溃诊断

## 排查思路
1. 查看 Pod 状态和事件
2. 检查容器日志
3. 分析退出码
4. 检查资源限制

## 常用命令
- `kubectl get pods -n {namespace} -o wide` - 查看 Pod 状态
- `kubectl describe pod {pod} -n {namespace}` - 查看 Pod 详情和事件
- `kubectl logs {pod} -n {namespace} --previous` - 查看上一次容器日志
- `kubectl top pod {pod} -n {namespace}` - 查看资源使用
- `kubectl get events -n {namespace} --sort-by=.lastTimestamp` - 查看事件

## 常见退出码
- Exit Code 0: 正常退出
- Exit Code 1: 应用错误
- Exit Code 137 (SIGKILL): OOMKilled 或被强制终止
- Exit Code 139 (SIGSEGV): 段错误
- Exit Code 143 (SIGTERM): 优雅终止

## 常见原因及修复
### OOMKilled (Exit 137)
- 增加 `resources.limits.memory`
- 检查应用内存泄漏
- 调整 JVM/Runtime 内存参数

### CrashLoopBackOff
- 检查应用日志定位错误
- 验证配置文件/环境变量
- 检查依赖服务是否可用

### ImagePullBackOff
- 检查镜像名称和 tag
- 验证镜像仓库凭证

## 风险提示
- `kubectl delete pod` 会导致短暂服务中断
- 修改 Deployment 资源限制会触发滚动更新
- 生产环境避免直接 `kubectl exec` 修改容器
