import type { Incident, IncidentMessage } from '@chronos/shared'

export const mockIncidents: Incident[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    title: 'MySQL 慢查询导致 API 响应超时',
    description: '订单服务数据库出现大量慢查询，P99 延迟超过 5s，影响用户下单流程',
    source: 'Grafana',
    sourceId: 'alert-grafana-001',
    severity: 'critical',
    status: 'in_progress',
    processingMode: 'semi_automatic',
    category: 'database',
    threadId: 'thread-001',
    metadata: { alertUrl: 'https://grafana.example.com/alert/001' },
    createdAt: '2026-03-09T08:15:00Z',
    updatedAt: '2026-03-09T08:45:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    title: 'Redis 内存使用率超过 90%',
    description: '缓存集群 redis-cluster-01 内存持续增长，已触发告警阈值',
    source: 'Prometheus',
    sourceId: 'alert-prom-042',
    severity: 'high',
    status: 'triaging',
    processingMode: 'automatic',
    category: 'cache',
    threadId: 'thread-002',
    metadata: null,
    createdAt: '2026-03-09T07:30:00Z',
    updatedAt: '2026-03-09T08:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    title: 'K8s Pod CrashLoopBackOff: payment-service',
    description: 'payment-service 的 3 个 Pod 持续崩溃重启，OOM Killed',
    source: 'Kubernetes',
    sourceId: 'k8s-event-payment-crash',
    severity: 'critical',
    status: 'waiting_human',
    processingMode: 'semi_automatic',
    category: 'kubernetes',
    threadId: 'thread-003',
    metadata: { namespace: 'production', deployment: 'payment-service' },
    createdAt: '2026-03-09T06:45:00Z',
    updatedAt: '2026-03-09T07:20:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    title: '用户登录接口 502 错误率升高',
    description: 'auth-service 网关返回 502 比例从 0.1% 升至 15%',
    source: 'Datadog',
    sourceId: 'dd-alert-auth-502',
    severity: 'high',
    status: 'new',
    processingMode: null,
    category: 'api',
    threadId: null,
    metadata: null,
    createdAt: '2026-03-09T09:00:00Z',
    updatedAt: '2026-03-09T09:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    title: 'Elasticsearch 集群 Yellow 状态',
    description: '日志集群部分分片未分配，可能影响日志检索',
    source: 'ElasticSearch',
    sourceId: 'es-cluster-health-001',
    severity: 'medium',
    status: 'resolved',
    processingMode: 'automatic',
    category: 'search',
    threadId: 'thread-005',
    metadata: null,
    createdAt: '2026-03-08T22:00:00Z',
    updatedAt: '2026-03-09T01:30:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440006',
    title: 'SSL 证书即将过期 (3天)',
    description: 'api.example.com 的 SSL 证书将在 3 天后过期',
    source: 'CertManager',
    sourceId: 'cert-expiry-api',
    severity: 'medium',
    status: 'new',
    processingMode: null,
    category: 'security',
    threadId: null,
    metadata: null,
    createdAt: '2026-03-09T06:00:00Z',
    updatedAt: '2026-03-09T06:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440007',
    title: '磁盘空间不足: node-worker-03',
    description: '/data 分区使用率达到 95%，主要是日志文件堆积',
    source: 'Zabbix',
    sourceId: 'zabbix-disk-003',
    severity: 'low',
    status: 'closed',
    processingMode: 'automatic',
    category: 'infrastructure',
    threadId: 'thread-007',
    metadata: null,
    createdAt: '2026-03-07T14:00:00Z',
    updatedAt: '2026-03-07T15:30:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440008',
    title: 'RabbitMQ 消息队列积压',
    description: 'notification-queue 积压消息超过 50000 条，消费者处理能力不足',
    source: 'Prometheus',
    sourceId: 'prom-rabbitmq-backlog',
    severity: 'high',
    status: 'in_progress',
    processingMode: 'semi_automatic',
    category: 'queue',
    threadId: 'thread-008',
    metadata: null,
    createdAt: '2026-03-09T08:50:00Z',
    updatedAt: '2026-03-09T09:10:00Z',
  },
]

export const mockMessages: Record<string, IncidentMessage[]> = {
  '550e8400-e29b-41d4-a716-446655440001': [
    {
      id: 'msg-001-01',
      incidentId: '550e8400-e29b-41d4-a716-446655440001',
      role: 'system',
      content: '收到告警：MySQL 慢查询导致 API 响应超时 (来源: Grafana, 严重程度: Critical)',
      contentParts: null,
      attachments: null,
      userId: null,
      createdAt: '2026-03-09T08:15:00Z',
    },
    {
      id: 'msg-001-02',
      incidentId: '550e8400-e29b-41d4-a716-446655440001',
      role: 'assistant',
      content: `## 🔍 分析中

我正在分析这个 MySQL 慢查询问题。让我先检查一下当前的数据库状态。

### 执行命令
\`\`\`bash
mysql -u monitor -h db-master-01 -e "SHOW PROCESSLIST" | head -20
\`\`\`

### 发现
当前有 **47 个活跃连接**，其中 12 个处于 \`Sending data\` 状态，平均执行时间 8.3s。

主要慢查询集中在以下表：
- \`orders\` - 全表扫描，缺少索引
- \`order_items\` - JOIN 查询未走索引

### 建议方案
1. 为 \`orders.user_id\` 添加索引
2. 为 \`order_items.order_id\` 添加复合索引
3. 临时 kill 超过 30s 的查询

是否需要我执行这些操作？`,
      contentParts: null,
      attachments: null,
      userId: null,
      createdAt: '2026-03-09T08:16:30Z',
    },
    {
      id: 'msg-001-03',
      incidentId: '550e8400-e29b-41d4-a716-446655440001',
      role: 'user',
      content: '先执行第3步，kill 掉超时查询。然后再添加索引。',
      contentParts: null,
      attachments: null,
      userId: 'user-001',
      createdAt: '2026-03-09T08:20:00Z',
    },
    {
      id: 'msg-001-04',
      incidentId: '550e8400-e29b-41d4-a716-446655440001',
      role: 'assistant',
      content: `## ⚡ 执行中

### Step 1: Kill 超时查询

\`\`\`bash
mysql -u admin -h db-master-01 -e "
SELECT GROUP_CONCAT(id) INTO @ids
FROM information_schema.processlist
WHERE time > 30 AND command != 'Sleep';
SET @sql = CONCAT('KILL ', REPLACE(@ids, ',', '; KILL '));
PREPARE stmt FROM @sql; EXECUTE stmt;
"
\`\`\`

✅ 已终止 **8 个超时查询**，当前活跃连接数降至 31。

### Step 2: 添加索引

\`\`\`sql
ALTER TABLE orders ADD INDEX idx_user_id (user_id);
ALTER TABLE order_items ADD INDEX idx_order_id_product (order_id, product_id);
\`\`\`

索引创建中，预计需要 2-3 分钟...`,
      contentParts: null,
      attachments: null,
      userId: null,
      createdAt: '2026-03-09T08:21:00Z',
    },
  ],
  '550e8400-e29b-41d4-a716-446655440003': [
    {
      id: 'msg-003-01',
      incidentId: '550e8400-e29b-41d4-a716-446655440003',
      role: 'system',
      content: '收到告警：K8s Pod CrashLoopBackOff: payment-service (来源: Kubernetes, 严重程度: Critical)',
      contentParts: null,
      attachments: null,
      userId: null,
      createdAt: '2026-03-09T06:45:00Z',
    },
    {
      id: 'msg-003-02',
      incidentId: '550e8400-e29b-41d4-a716-446655440003',
      role: 'assistant',
      content: `## 🔍 分析 Pod 崩溃原因

### 检查 Pod 状态
\`\`\`bash
kubectl get pods -n production -l app=payment-service
\`\`\`

| POD | STATUS | RESTARTS | AGE |
|-----|--------|----------|-----|
| payment-service-7d4f8b-x2k9j | CrashLoopBackOff | 15 | 2h |
| payment-service-7d4f8b-m3n7p | CrashLoopBackOff | 14 | 2h |
| payment-service-7d4f8b-q8w2r | CrashLoopBackOff | 13 | 2h |

### 查看日志
\`\`\`bash
kubectl logs payment-service-7d4f8b-x2k9j -n production --previous --tail=50
\`\`\`

**关键错误**: \`java.lang.OutOfMemoryError: Java heap space\`

### 根因分析
- Pod 内存限制: **512Mi**
- JVM 堆内存实际使用: **~480MB**
- 最近一次部署 (v2.3.1) 引入了新的批量处理逻辑，内存消耗显著增加

### 建议方案
1. **临时方案**: 将 Pod 内存限制提升到 1Gi
2. **根本方案**: 回滚到 v2.3.0 或修复批量处理的内存泄漏

⚠️ 需要您确认要采用哪种方案。提升内存限制可能导致节点资源紧张。`,
      contentParts: null,
      attachments: null,
      userId: null,
      createdAt: '2026-03-09T06:47:00Z',
    },
    {
      id: 'msg-003-03',
      incidentId: '550e8400-e29b-41d4-a716-446655440003',
      role: 'user',
      content: '先提升内存限制到 1Gi 让服务恢复，同时通知开发团队修复内存泄漏。',
      contentParts: null,
      attachments: null,
      userId: 'user-001',
      createdAt: '2026-03-09T07:00:00Z',
    },
    {
      id: 'msg-003-04',
      incidentId: '550e8400-e29b-41d4-a716-446655440003',
      role: 'assistant',
      content: `## ⚡ 执行临时修复

\`\`\`bash
kubectl patch deployment payment-service -n production -p '{"spec":{"template":{"spec":{"containers":[{"name":"payment-service","resources":{"limits":{"memory":"1Gi"},"requests":{"memory":"768Mi"}}}]}}}}'
\`\`\`

✅ Deployment 已更新，Pod 正在滚动重启...

### 当前状态
等待新 Pod 启动完成。需要您确认服务恢复后再关闭此事件。`,
      contentParts: null,
      attachments: null,
      userId: null,
      createdAt: '2026-03-09T07:02:00Z',
    },
  ],
  '550e8400-e29b-41d4-a716-446655440002': [
    {
      id: 'msg-002-01',
      incidentId: '550e8400-e29b-41d4-a716-446655440002',
      role: 'system',
      content: '收到告警：Redis 内存使用率超过 90% (来源: Prometheus, 严重程度: High)',
      contentParts: null,
      attachments: null,
      userId: null,
      createdAt: '2026-03-09T07:30:00Z',
    },
    {
      id: 'msg-002-02',
      incidentId: '550e8400-e29b-41d4-a716-446655440002',
      role: 'assistant',
      content: `## 🔍 正在自动分析 Redis 内存问题

模式：**全自动** - 正在执行诊断流程

\`\`\`bash
redis-cli -h redis-cluster-01 INFO memory
\`\`\`

### 内存分析结果
- **used_memory**: 13.8 GB / 15 GB (92%)
- **maxmemory-policy**: noeviction
- **最大键占用**: session:* (4.2GB), cache:product:* (3.8GB), temp:batch:* (2.1GB)

发现 \`temp:batch:*\` 存在大量过期但未清理的临时键。正在执行清理...`,
      contentParts: null,
      attachments: null,
      userId: null,
      createdAt: '2026-03-09T07:31:00Z',
    },
  ],
}
