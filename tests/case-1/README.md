# Case 1: Redis 配置损坏导致订单服务故障

模拟场景：订单服务读取 Redis 配置时报 `WRONGTYPE` 错误，导致限流配置失效、延迟飙升、健康检查失败。

**预期结果**：Chronos Agent 自动诊断出 Redis key 类型错误，通过 MCP 工具查询错误日志 + 检查 Redis key 类型，最终修复数据并生成 Runbook。

## 前置条件

- Chronos 后端和前端已启动（`pnpm dev:backend` + `pnpm dev:frontend`）
- 本机已安装 `psql`、`redis-cli`、`curl`、`python3`
- Docker 已启动

---

## Step 1: 启动模拟生产环境

```bash
cd tests/case-1
docker compose up -d --wait
```

启动两个独立容器（与 Chronos 平台 DB 完全隔离）：

| 容器 | 端口 | 说明 |
|------|------|------|
| case1-postgres | 15432 | 模拟生产 PostgreSQL（order_service 数据库） |
| case1-redis | 16379 | 模拟生产 Redis |

---

## Step 2: 初始化模拟故障数据

```bash
bash seed.sh
```

该脚本做 3 件事：

1. **模拟生产 PostgreSQL**：创建 `app_errors` 表，插入 7 条错误日志（WRONGTYPE 报错、熔断器打开、延迟告警等）
2. **模拟生产 Redis**：将 `config:order-service:rate_limit` 写成 hash 类型（正确应为 string 类型的 JSON），导致应用 `GET` 时报 `WRONGTYPE` 错误
3. **Chronos 平台**：通过 API 创建 Skill（Redis 诊断方法论）和 Service Map（订单服务拓扑）

可手动验证故障已就位：

```bash
# 查看 key 类型 — 应该显示 "hash"（正确应为 "string"）
redis-cli -p 16379 TYPE config:order-service:rate_limit

# 模拟应用的 GET 操作 — 应该报 WRONGTYPE 错误
redis-cli -p 16379 GET config:order-service:rate_limit
```

---

## Step 3: 在 Chronos 页面添加连接

打开 Chronos 前端「连接管理」页面，手动添加以下两个连接：

### PostgreSQL 连接

| 字段 | 值 |
|------|----|
| 名称 | `生产数据库` |
| 类型 | PostgreSQL |
| Host | `localhost` |
| Port | `15432` |
| Username | `prod` |
| Password | `prod123` |
| Database | `order_service` |

### Redis 连接

| 字段 | 值 |
|------|----|
| 名称 | `生产 Redis` |
| 类型 | Redis |
| Host | `localhost` |
| Port | `16379` |

添加后，Chronos 会自动为每个连接注册对应的 MCP 工具，Agent 就能通过这些工具直接操作模拟生产环境。

---

## Step 4: 触发告警事件

```bash
bash trigger.sh
```

脚本会通过 webhook 接口发送一条 P1 告警，内容包含：
- order-service 健康检查失败
- Redis WRONGTYPE 错误详情
- 延迟飙升数据
- 相关 Redis key 信息

也可以在 Chronos 前端 Inbox 页面点击「新建事件」，手动粘贴告警内容。

---

## Step 5: 验证

### 观察 Agent 处理过程

查看后端日志，Agent 预期会调用以下 MCP 工具：

1. `searchSkills` — 查找 Redis 相关的诊断知识
2. `getServiceMap` / `getServiceNeighbors` — 了解 order-service 的依赖拓扑
3. `生产数据库_query` — 查询 app_errors 表中的错误日志
4. `生产Redis_*` — 检查 Redis key 类型、读取内容
5. `生产Redis_*` — 修复 key：DEL + SET 正确的 JSON 字符串
6. `createRunbook` — 生成诊断修复 Runbook

### 验证事件状态

在前端 Inbox 页面观察事件状态流转：

```
new → triaging → in_progress → resolved
```

### 验证 Redis 修复结果

```bash
# key 类型应该变为 "string"
redis-cli -p 16379 TYPE config:order-service:rate_limit

# 值应该是正确的 JSON
redis-cli -p 16379 GET config:order-service:rate_limit
```

---

## 清理

```bash
bash cleanup.sh
```

该脚本会停止并删除模拟环境的 Docker 容器和数据卷。Chronos 平台中的测试数据（连接、Skill、Service Map、事件）需在前端手动删除。
