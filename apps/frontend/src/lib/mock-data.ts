import type { Incident, IncidentMessage } from '@chronos/shared'

export const mockIncidents: Incident[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    content: 'MySQL 慢查询导致 API 响应超时\n订单服务数据库出现大量慢查询，P99 延迟超过 5s，影响用户下单流程',
    summary: '订单服务 MySQL 慢查询导致 P99 延迟超 5s，影响下单流程',
    attachments: [
      { type: 'image', url: 'https://picsum.photos/seed/mysql1/800/400', name: '慢查询统计.png', mimeType: 'image/png' },
      { type: 'image', url: 'https://picsum.photos/seed/mysql2/800/400', name: 'P99延迟趋势.png', mimeType: 'image/png' },
      { type: 'file', url: '/uploads/slow-query-analysis.md', name: '慢查询分析报告.md', mimeType: 'text/markdown' },
    ],
    source: 'webhook',
    status: 'in_progress',
    processingMode: 'semi_automatic',
    threadId: 'thread-001',
    createdAt: '2026-03-09T08:15:00Z',
    updatedAt: '2026-03-09T08:45:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    content: 'Redis 内存使用率超过 90%\n缓存集群 redis-cluster-01 内存持续增长，已触发告警阈值',
    summary: 'Redis 集群 redis-cluster-01 内存使用率超 90%，持续增长',
    attachments: null,
    source: 'webhook',
    status: 'triaging',
    processingMode: 'automatic',
    threadId: 'thread-002',
    createdAt: '2026-03-09T07:30:00Z',
    updatedAt: '2026-03-09T08:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    content: 'K8s Pod CrashLoopBackOff: payment-service\npayment-service 的 3 个 Pod 持续崩溃重启，OOM Killed',
    summary: 'payment-service Pod 因 OOM 持续崩溃重启',
    attachments: [
      { type: 'image', url: 'https://picsum.photos/seed/k8s1/800/400', name: 'Pod状态截图.png', mimeType: 'image/png' },
      { type: 'file', url: '/uploads/pod-logs.txt', name: 'pod-crash-logs.txt', mimeType: 'text/plain' },
    ],
    source: 'webhook',
    status: 'waiting_human',
    processingMode: 'semi_automatic',
    threadId: 'thread-003',
    createdAt: '2026-03-09T06:45:00Z',
    updatedAt: '2026-03-09T07:20:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    content: '用户登录接口 502 错误率升高\nauth-service 网关返回 502 比例从 0.1% 升至 15%',
    summary: 'auth-service 网关 502 错误率从 0.1% 飙升至 15%',
    attachments: [
      { type: 'image', url: 'https://picsum.photos/seed/auth1/800/400', name: '错误率趋势.png', mimeType: 'image/png' },
      { type: 'image', url: 'https://picsum.photos/seed/auth2/800/400', name: '网关日志截图.png', mimeType: 'image/png' },
      { type: 'image', url: 'https://picsum.photos/seed/auth3/800/400', name: '服务拓扑图.png', mimeType: 'image/png' },
    ],
    source: 'manual',
    status: 'new',
    processingMode: null,
    threadId: null,
    createdAt: '2026-03-09T09:00:00Z',
    updatedAt: '2026-03-09T09:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    content: 'Elasticsearch 集群 Yellow 状态\n日志集群部分分片未分配，可能影响日志检索',
    summary: 'ES 日志集群 Yellow 状态，部分分片未分配',
    attachments: null,
    source: 'webhook',
    status: 'resolved',
    processingMode: 'automatic',
    threadId: 'thread-005',
    createdAt: '2026-03-08T22:00:00Z',
    updatedAt: '2026-03-09T01:30:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440006',
    content: 'SSL 证书即将过期 (3天)\napi.example.com 的 SSL 证书将在 3 天后过期',
    summary: 'api.example.com SSL 证书 3 天后过期',
    attachments: null,
    source: 'webhook',
    status: 'new',
    processingMode: null,
    threadId: null,
    createdAt: '2026-03-09T06:00:00Z',
    updatedAt: '2026-03-09T06:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440007',
    content: '磁盘空间不足: node-worker-03\n/data 分区使用率达到 95%，主要是日志文件堆积',
    summary: 'node-worker-03 磁盘 /data 分区使用率达 95%',
    attachments: null,
    source: 'manual',
    status: 'closed',
    processingMode: 'automatic',
    threadId: 'thread-007',
    createdAt: '2026-03-07T14:00:00Z',
    updatedAt: '2026-03-07T15:30:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440008',
    content: 'RabbitMQ 消息队列积压\nnotification-queue 积压消息超过 50000 条，消费者处理能力不足',
    summary: 'RabbitMQ notification-queue 积压超 5 万条消息',
    attachments: [
      { type: 'image', url: '/uploads/rabbitmq-dashboard.png', name: 'RabbitMQ 监控面板截图.png', mimeType: 'image/png' },
    ],
    source: 'webhook',
    status: 'in_progress',
    processingMode: 'semi_automatic',
    threadId: 'thread-008',
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
      content: '收到告警：MySQL 慢查询导致 API 响应超时',
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
  ],
  '550e8400-e29b-41d4-a716-446655440003': [
    {
      id: 'msg-003-01',
      incidentId: '550e8400-e29b-41d4-a716-446655440003',
      role: 'system',
      content: '收到告警：K8s Pod CrashLoopBackOff: payment-service',
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

**关键错误**: \`java.lang.OutOfMemoryError: Java heap space\`

### 根因分析
- Pod 内存限制: **512Mi**
- JVM 堆内存实际使用: **~480MB**
- 最近一次部署 (v2.3.1) 引入了新的批量处理逻辑，内存消耗显著增加

### 建议方案
1. **临时方案**: 将 Pod 内存限制提升到 1Gi
2. **根本方案**: 回滚到 v2.3.0 或修复批量处理的内存泄漏

⚠️ 需要您确认要采用哪种方案。`,
      contentParts: null,
      attachments: null,
      userId: null,
      createdAt: '2026-03-09T06:47:00Z',
    },
  ],
}
