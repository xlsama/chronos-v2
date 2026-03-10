import type { ConnectionType } from '@chronos/shared'
import {
  Activity,
  BarChart3,
  Bug,
  CirclePlay,
  Container,
  Database,
  Dock,
  HardDrive,
  MessageSquare,
  Radar,
  Search,
  Server,
  Ship,
  Workflow,
} from 'lucide-react'

export interface ConnectionTypeMetadata {
  type: ConnectionType
  label: string
  description: string
  icon: typeof Database
  color: string
  category: string
  mcpSource: 'official' | 'community'
}

export const CONNECTION_CATEGORIES = [
  '数据库',
  '缓存与消息',
  '搜索引擎',
  '容器与编排',
  '监控与可观测',
  'CI/CD',
] as const

export const connectionTypeMetadata: ConnectionTypeMetadata[] = [
  // 数据库
  {
    type: 'mysql',
    label: 'MySQL',
    description: '开源关系型数据库，广泛用于 Web 应用',
    icon: Database,
    color: 'text-blue-500',
    category: '数据库',
    mcpSource: 'community',
  },
  {
    type: 'postgresql',
    label: 'PostgreSQL',
    description: '功能强大的开源对象关系型数据库',
    icon: Database,
    color: 'text-sky-600',
    category: '数据库',
    mcpSource: 'community',
  },
  {
    type: 'mongodb',
    label: 'MongoDB',
    description: '面向文档的 NoSQL 数据库',
    icon: Database,
    color: 'text-green-600',
    category: '数据库',
    mcpSource: 'official',
  },
  {
    type: 'clickhouse',
    label: 'ClickHouse',
    description: '高性能列式 OLAP 数据库',
    icon: Database,
    color: 'text-yellow-500',
    category: '数据库',
    mcpSource: 'official',
  },

  // 缓存与消息
  {
    type: 'redis',
    label: 'Redis',
    description: '高性能键值存储与缓存',
    icon: HardDrive,
    color: 'text-red-500',
    category: '缓存与消息',
    mcpSource: 'official',
  },
  {
    type: 'kafka',
    label: 'Kafka',
    description: '分布式事件流平台',
    icon: Workflow,
    color: 'text-slate-700',
    category: '缓存与消息',
    mcpSource: 'community',
  },
  {
    type: 'rabbitmq',
    label: 'RabbitMQ',
    description: '开源消息代理与队列服务',
    icon: MessageSquare,
    color: 'text-orange-500',
    category: '缓存与消息',
    mcpSource: 'community',
  },

  // 搜索引擎
  {
    type: 'elasticsearch',
    label: 'Elasticsearch',
    description: '分布式搜索与分析引擎',
    icon: Search,
    color: 'text-yellow-500',
    category: '搜索引擎',
    mcpSource: 'official',
  },

  // 容器与编排
  {
    type: 'kubernetes',
    label: 'Kubernetes',
    description: '容器编排与自动化部署平台',
    icon: Container,
    color: 'text-blue-600',
    category: '容器与编排',
    mcpSource: 'community',
  },
  {
    type: 'docker',
    label: 'Docker',
    description: '容器化应用管理平台',
    icon: Dock,
    color: 'text-sky-500',
    category: '容器与编排',
    mcpSource: 'community',
  },
  {
    type: 'argocd',
    label: 'Argo CD',
    description: 'Kubernetes 声明式 GitOps 持续交付',
    icon: Ship,
    color: 'text-orange-600',
    category: '容器与编排',
    mcpSource: 'official',
  },

  // 监控与可观测
  {
    type: 'grafana',
    label: 'Grafana',
    description: '可视化监控与数据分析平台',
    icon: BarChart3,
    color: 'text-orange-500',
    category: '监控与可观测',
    mcpSource: 'official',
  },
  {
    type: 'prometheus',
    label: 'Prometheus',
    description: '开源系统监控与告警工具',
    icon: Activity,
    color: 'text-orange-600',
    category: '监控与可观测',
    mcpSource: 'community',
  },
  {
    type: 'sentry',
    label: 'Sentry',
    description: '应用错误追踪与性能监控',
    icon: Bug,
    color: 'text-purple-600',
    category: '监控与可观测',
    mcpSource: 'official',
  },

  // CI/CD
  {
    type: 'jenkins',
    label: 'Jenkins',
    description: '开源自动化构建与 CI/CD 服务器',
    icon: Server,
    color: 'text-red-600',
    category: 'CI/CD',
    mcpSource: 'community',
  },
]

export const connectionTypeMap = new Map(
  connectionTypeMetadata.map((m) => [m.type, m]),
)

export function getConnectionMeta(type: ConnectionType) {
  return connectionTypeMap.get(type) ?? connectionTypeMetadata[0]
}
