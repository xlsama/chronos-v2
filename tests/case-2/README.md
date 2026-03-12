# Case 2: Elasticsearch 磁盘水位线触发级联支付故障

模拟场景：ES 集群磁盘超过 flood_stage 水位线 → 索引被设为 read_only → log-ingestor 写入阻塞 → payment-service 欺诈检测查询超时 → 交易进入 dead_letter_queue → Kafka 消费 lag 飙升 → checkout 会话过期。

**根因链**: ES 磁盘满 → 索引只读 → 欺诈检测超时 → 支付失败 → 用户结算中断

**预期结果**：Chronos Agent 自动诊断出 ES 索引阻塞是根因，通过 MCP 工具跨 4 个数据源查询，解除 ES 阻塞、清除熔断器和锁，最终生成 Runbook。

## 复杂度对比 Case 1

| 维度 | Case 1 | Case 2 |
|------|--------|--------|
| 数据源 | 2 (PG+Redis) | 4 (PG+MySQL+ES+Redis) |
| 根因 | 单一 (key 类型错误) | 级联 (ES→支付→结算) |
| 修复步骤 | 1 (DEL+SET) | 3+ (解除ES阻塞+重置熔断器+清理锁) |
| Agent 能力 | Skills + ServiceMap | Skills(2) + ServiceMap(10节点) + KB + 4连接 |

## 前置条件

- Chronos 后端和前端已启动（`pnpm dev:backend` + `pnpm dev:frontend`）
- 本机已安装 `psql`、`mysql`（或 `mariadb-client`）、`curl`、`python3`
- Docker 已启动

---

## Step 1: 启动模拟生产环境

```bash
cd tests/case-2
docker compose up -d --wait
```

启动 4 个独立容器（与 Chronos 平台 DB 完全隔离）：

| 容器 | 端口 | 说明 |
|------|------|------|
| case2-postgres | 25432 | 应用错误日志 DB (platform_logs) |
| case2-mysql | 23306 | 支付业务 DB (payment_db) |
| case2-elasticsearch | 29200 | 日志搜索 + 欺诈检测索引 |
| case2-redis | 26379 | 会话缓存 + 熔断器状态 |

---

## Step 2: 初始化模拟故障数据

```bash
bash seed.sh
```

该脚本做 5 件事：

1. **模拟生产 PostgreSQL**：创建 `app_errors` 表，插入 10 条错误日志（ES 写入失败、欺诈检测超时、Kafka lag、checkout 完成率骤降）
2. **模拟生产 MySQL**：创建 `transactions` 和 `dead_letter_queue` 表，模拟 5 条积压记录
3. **模拟生产 Elasticsearch**：创建索引并设为 `read_only_allow_delete`，模拟磁盘满阻塞
4. **模拟生产 Redis**：写入会话 key、卡住的 checkout 锁、OPEN 状态熔断器
5. **Chronos 平台**：创建 2 个 Skills、1 个 Service Map、1 个 KB 项目+文档

可手动验证故障已就位：

```bash
# ES 索引应显示 read_only_allow_delete: true
curl -s localhost:29200/transaction-patterns/_settings | python3 -m json.tool | grep read_only

# Redis 熔断器状态应为 OPEN
redis-cli -p 26379 GET circuit:payment-service:es-fraud

# MySQL dead_letter_queue 应有 5 条记录
mysql -h 127.0.0.1 -P 23306 -u payment -ppayment123 payment_db -e "SELECT COUNT(*) FROM dead_letter_queue"
```

---

## Step 3: 在 Chronos 页面添加连接

打开 Chronos 前端「连接管理」页面，手动添加以下 4 个连接：

### PostgreSQL 连接

| 字段 | 值 |
|------|----|
| 名称 | `生产日志数据库` |
| 类型 | PostgreSQL |
| Host | `localhost` |
| Port | `25432` |
| Username | `prod` |
| Password | `prod123` |
| Database | `platform_logs` |

### MySQL 连接

| 字段 | 值 |
|------|----|
| 名称 | `支付数据库` |
| 类型 | MySQL |
| Host | `localhost` |
| Port | `23306` |
| Username | `payment` |
| Password | `payment123` |
| Database | `payment_db` |

### Elasticsearch 连接

| 字段 | 值 |
|------|----|
| 名称 | `日志ES集群` |
| 类型 | Elasticsearch |
| URL | `http://localhost:29200` |

### Redis 连接

| 字段 | 值 |
|------|----|
| 名称 | `会话Redis` |
| 类型 | Redis |
| Host | `localhost` |
| Port | `26379` |

添加后，Chronos 会自动为每个连接注册对应的 MCP 工具，Agent 就能通过这些工具直接操作模拟生产环境。

---

## Step 4: 触发告警事件

```bash
bash trigger.sh
```

脚本会通过 webhook 接口发送一条 P1 级联故障告警。

---

## Step 5: 验证

### 观察 Agent 处理过程

查看后端日志，Agent 预期会调用以下 MCP 工具：

1. `searchSkills` — 查找 ES 诊断和 Kafka 相关知识
2. `searchKnowledgeBase` — 搜索支付链路架构文档
3. `getServiceMap` / `getServiceNeighbors` — 了解 10 节点拓扑
4. `生产日志数据库_query` — 查询 app_errors 表，时间线分析
5. `日志ES集群_*` — 检查集群健康状态、索引设置
6. `支付数据库_*` — 查询 dead_letter_queue 确认业务影响
7. `会话Redis_*` — 检查熔断器状态、checkout 锁
8. `日志ES集群_*` — 解除索引 read_only 阻塞
9. `会话Redis_*` — DEL 熔断器 key + checkout 锁
10. `createRunbook` — 生成级联故障诊断 Runbook

### 验证事件状态

在前端 Inbox 页面观察事件状态流转：

```
new → triaging → in_progress → resolved
```

### 验证修复结果

```bash
# ES 索引阻塞已解除
curl -s localhost:29200/transaction-patterns/_settings | python3 -m json.tool | grep read_only

# Redis 熔断器已清除
redis-cli -p 26379 GET circuit:payment-service:es-fraud
# 应返回 (nil)

# checkout 锁已清除
redis-cli -p 26379 EXISTS checkout:lock:user-42
# 应返回 0
```

---

## 清理

```bash
bash cleanup.sh
```

该脚本会停止并删除模拟环境的 Docker 容器和数据卷。Chronos 平台中的测试数据（连接、Skills、Service Map、KB、事件）需在前端手动删除。
