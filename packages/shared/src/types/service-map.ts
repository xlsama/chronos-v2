// ── Service Node Types ──────────────────────────────────────
export type ServiceNodeType =
  | 'service'     // 应用/微服务
  | 'database'    // MySQL, PostgreSQL, MongoDB, ClickHouse
  | 'cache'       // Redis
  | 'queue'       // Kafka, RabbitMQ
  | 'search'      // Elasticsearch
  | 'gateway'     // API 网关、负载均衡
  | 'monitoring'  // Grafana, Prometheus, Sentry
  | 'cicd'        // Jenkins, ArgoCD
  | 'container'   // Kubernetes, Docker
  | 'external'    // 第三方 API

export interface ServiceNodeData {
  label: string
  serviceType: ServiceNodeType
  description?: string
  tags?: string[]
  connectionId?: string     // → Connection → MCP tools
  kbProjectId?: string      // → KB project → 文档上下文
}

// ── Service Edge Types ─────────────────────────────────────
export type EdgeRelationType =
  | 'calls'        // 同步调用 (HTTP, gRPC)
  | 'depends-on'   // 通用依赖
  | 'reads-from'   // 读取数据
  | 'writes-to'    // 写入数据
  | 'publishes'    // 发布消息到队列
  | 'subscribes'   // 消费消息

export type EdgeProtocol = 'http' | 'grpc' | 'tcp' | 'amqp' | 'kafka' | 'redis' | 'sql' | 'custom'

export interface ServiceEdgeData {
  relationType: EdgeRelationType
  protocol?: EdgeProtocol
  description?: string
  critical?: boolean         // 关键路径标记
}

// ── Graph Container ────────────────────────────────────────
export interface ServiceMapNode {
  id: string                 // 用户自定义 ID（如 "order-service"）
  type: string               // React Flow 渲染类型（统一 "serviceNode"）
  position: { x: number; y: number }
  data: ServiceNodeData
}

export interface ServiceMapEdge {
  id: string
  source: string
  target: string
  label?: string
  data?: ServiceEdgeData
}

export interface ServiceMapGraph {
  nodes: ServiceMapNode[]
  edges: ServiceMapEdge[]
}

export interface ServiceMap {
  id: string;
  name: string;
  description: string | null;
  graph: ServiceMapGraph;
  createdAt: string;
  updatedAt: string;
}
