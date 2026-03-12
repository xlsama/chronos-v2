# Case 3: Kubernetes ConfigMap 错误导致 Pod CrashLoopBackOff

模拟场景：user-service Deployment 的 ConfigMap 中 DATABASE_URL 有拼写错误（`postgressql` + 错误端口 `54321`），导致所有 3 个 Pod 启动时连接数据库失败，进入 CrashLoopBackOff。

**预期结果**：Chronos Agent 通过 K8s MCP 工具诊断出 ConfigMap 配置错误，修正 DATABASE_URL 并重启 Deployment，最终生成 Runbook。

## 前置条件

- Chronos 后端和前端已启动（`pnpm dev:backend` + `pnpm dev:frontend`）
- 本机已安装 `kubectl`、`curl`、`python3`
- K8s 集群可用（kind / minikube / Docker Desktop K8s / 云集群均可）
- `kubectl` 已配置且能连接集群

---

## Step 1: 部署故障应用

```bash
cd tests/case-3
bash seed.sh
```

该脚本做 3 件事：

1. **部署 K8s 资源**：创建 `chronos-case3` namespace，部署含错误 ConfigMap 的 user-service（3 replicas）
2. **等待故障出现**：等待 Pod 进入 CrashLoopBackOff 状态
3. **Chronos 平台**：创建 Skill（CrashLoopBackOff 诊断）和 Service Map（User Service 部署拓扑）

可手动验证故障已就位：

```bash
# Pod 应显示 CrashLoopBackOff
kubectl get pods -n chronos-case3

# 查看 ConfigMap 中的错误配置
kubectl get configmap app-config -n chronos-case3 -o yaml | grep DATABASE_URL
# 应显示 postgressql://...:54321/... （拼写错误+端口错误）

# 查看 Pod 日志
kubectl logs -n chronos-case3 -l app=user-service --previous 2>/dev/null || \
  kubectl logs -n chronos-case3 -l app=user-service
```

---

## Step 2: 在 Chronos 页面添加连接

打开 Chronos 前端「连接管理」页面，添加 K8s 连接：

| 字段 | 值 |
|------|----|
| 名称 | `K8s 集群` |
| 类型 | Kubernetes |
| Kubeconfig | 粘贴 `cat ~/.kube/config` 的完整内容 |

添加后，Chronos 会自动注册 K8s MCP 工具。

---

## Step 3: 触发告警事件

```bash
bash trigger.sh
```

脚本会收集当前 Pod 状态和 Warning 事件，通过 webhook 发送一条 P1 告警。

---

## Step 4: 验证

### 观察 Agent 处理过程

查看后端日志，Agent 预期会调用以下 MCP 工具：

1. `searchSkills` — 查找 CrashLoopBackOff 诊断 Skill
2. `getServiceMap` — 了解 User Service 部署拓扑
3. `K8s集群_get_pods` — 查看 Pod 状态（CrashLoopBackOff）
4. `K8s集群_describe_pod` — 查看 Pod Events 和 exit code
5. `K8s集群_get_logs` — 查看容器日志（连接失败信息）
6. `K8s集群_get_configmap` — 发现 DATABASE_URL 拼写错误
7. `K8s集群_patch_configmap` — 修正为 `postgresql://...:5432/...`
8. `K8s集群_rollout_restart` — 重启 Deployment
9. `createRunbook` — 生成诊断 Runbook

### 验证事件状态

```
new → triaging → in_progress → resolved
```

### 验证修复结果

```bash
# ConfigMap 已修正
kubectl get configmap app-config -n chronos-case3 -o yaml | grep DATABASE_URL
# 应显示 postgresql://app_user:s3cret@db-primary.internal:5432/user_db

# Deployment 已重启（Pod 仍会 crash，因为 db-primary.internal 不存在，但 ConfigMap 已正确）
kubectl get pods -n chronos-case3
```

> **注意**: Pod 修复后仍会 crash（因为 `db-primary.internal` 不存在），但 ConfigMap 已被正确修复。在真实环境中 DB 存在则会完全恢复。

---

## 清理

```bash
bash cleanup.sh
```

该脚本会删除 `chronos-case3` namespace 及其所有资源。Chronos 平台中的测试数据需在前端手动删除。
