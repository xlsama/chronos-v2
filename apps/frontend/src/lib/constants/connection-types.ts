import type { ConnectionType } from '@chronos/shared'

import mysqlIcon from '@/assets/icons/services/mysql.svg'
import postgresqlIcon from '@/assets/icons/services/postgresql.svg'
import mongodbIcon from '@/assets/icons/services/mongodb.svg'
import clickhouseIcon from '@/assets/icons/services/clickhouse.svg'
import redisIcon from '@/assets/icons/services/redis.svg'
import kafkaIcon from '@/assets/icons/services/kafka.svg'
import rabbitmqIcon from '@/assets/icons/services/rabbitmq.svg'
import elasticsearchIcon from '@/assets/icons/services/elasticsearch.svg'
import kubernetesIcon from '@/assets/icons/services/kubernetes.svg'
import dockerIcon from '@/assets/icons/services/docker.svg'
import argocdIcon from '@/assets/icons/services/argocd.svg'
import grafanaIcon from '@/assets/icons/services/grafana.svg'
import prometheusIcon from '@/assets/icons/services/prometheus.svg'
import sentryIcon from '@/assets/icons/services/sentry.svg'
import jenkinsIcon from '@/assets/icons/services/jenkins.svg'
import datadogIcon from '@/assets/icons/services/datadog.svg'
import pagerdutyIcon from '@/assets/icons/services/pagerduty.svg'
import opsgenieIcon from '@/assets/icons/services/opsgenie.svg'
import apisixIcon from '@/assets/icons/services/apisix.svg'
import kongIcon from '@/assets/icons/services/kong.svg'
import airflowIcon from '@/assets/icons/services/airflow.svg'
import lokiIcon from '@/assets/icons/services/loki.svg'
import sshIcon from '@/assets/icons/services/ssh.svg'

export interface ConnectionTypeMetadata {
  type: ConnectionType
  label: string
  description: string
  icon: string
  category: string
  mcpSource: 'official' | 'community'
}

export const CONNECTION_CATEGORIES = [
  '数据库',
  '缓存与消息',
  '容器与编排',
  '可观测性',
  '事件管理',
  'API 网关',
  '自动化',
  '远程管理',
] as const

export const connectionTypeMetadata: ConnectionTypeMetadata[] = [
  // 数据库
  {
    type: 'mysql',
    label: 'MySQL',
    description: '开源关系型数据库，广泛用于 Web 应用',
    icon: mysqlIcon,
    category: '数据库',
    mcpSource: 'community',
  },
  {
    type: 'postgresql',
    label: 'PostgreSQL',
    description: '功能强大的开源对象关系型数据库',
    icon: postgresqlIcon,
    category: '数据库',
    mcpSource: 'community',
  },
  {
    type: 'mongodb',
    label: 'MongoDB',
    description: '面向文档的 NoSQL 数据库',
    icon: mongodbIcon,
    category: '数据库',
    mcpSource: 'official',
  },
  {
    type: 'clickhouse',
    label: 'ClickHouse',
    description: '高性能列式 OLAP 数据库',
    icon: clickhouseIcon,
    category: '数据库',
    mcpSource: 'official',
  },

  // 缓存与消息
  {
    type: 'redis',
    label: 'Redis',
    description: '高性能键值存储与缓存',
    icon: redisIcon,
    category: '缓存与消息',
    mcpSource: 'official',
  },
  {
    type: 'kafka',
    label: 'Kafka',
    description: '分布式事件流平台',
    icon: kafkaIcon,
    category: '缓存与消息',
    mcpSource: 'community',
  },
  {
    type: 'rabbitmq',
    label: 'RabbitMQ',
    description: '开源消息代理与队列服务',
    icon: rabbitmqIcon,
    category: '缓存与消息',
    mcpSource: 'community',
  },

  // 容器与编排
  {
    type: 'kubernetes',
    label: 'Kubernetes',
    description: '容器编排与自动化部署平台',
    icon: kubernetesIcon,
    category: '容器与编排',
    mcpSource: 'community',
  },
  {
    type: 'docker',
    label: 'Docker',
    description: '容器化应用管理平台',
    icon: dockerIcon,
    category: '容器与编排',
    mcpSource: 'community',
  },
  {
    type: 'argocd',
    label: 'Argo CD',
    description: 'Kubernetes 声明式 GitOps 持续交付',
    icon: argocdIcon,
    category: '容器与编排',
    mcpSource: 'official',
  },

  // 可观测性
  {
    type: 'elasticsearch',
    label: 'Elasticsearch',
    description: '分布式搜索与分析引擎',
    icon: elasticsearchIcon,
    category: '可观测性',
    mcpSource: 'official',
  },
  {
    type: 'grafana',
    label: 'Grafana',
    description: '可视化监控与数据分析平台',
    icon: grafanaIcon,
    category: '可观测性',
    mcpSource: 'official',
  },
  {
    type: 'prometheus',
    label: 'Prometheus',
    description: '开源系统监控与告警工具',
    icon: prometheusIcon,
    category: '可观测性',
    mcpSource: 'community',
  },
  {
    type: 'loki',
    label: 'Loki',
    description: '日志聚合与查询系统（通过 Grafana API）',
    icon: lokiIcon,
    category: '可观测性',
    mcpSource: 'community',
  },
  {
    type: 'datadog',
    label: 'Datadog',
    description: '云端基础设施与应用监控平台',
    icon: datadogIcon,
    category: '可观测性',
    mcpSource: 'community',
  },
  {
    type: 'sentry',
    label: 'Sentry',
    description: '应用错误追踪与性能监控',
    icon: sentryIcon,
    category: '可观测性',
    mcpSource: 'official',
  },

  // 事件管理
  {
    type: 'pagerduty',
    label: 'PagerDuty',
    description: '事件响应与值班管理平台',
    icon: pagerdutyIcon,
    category: '事件管理',
    mcpSource: 'official',
  },
  {
    type: 'opsgenie',
    label: 'OpsGenie',
    description: '告警管理与事件响应平台',
    icon: opsgenieIcon,
    category: '事件管理',
    mcpSource: 'community',
  },

  // API 网关
  {
    type: 'apisix',
    label: 'APISIX',
    description: '云原生 API 网关',
    icon: apisixIcon,
    category: 'API 网关',
    mcpSource: 'official',
  },
  {
    type: 'kong',
    label: 'Kong',
    description: '云原生 API 网关与服务网格（需手动安装 MCP Server）',
    icon: kongIcon,
    category: 'API 网关',
    mcpSource: 'official',
  },

  // 自动化
  {
    type: 'jenkins',
    label: 'Jenkins',
    description: '开源自动化构建与 CI/CD 服务器',
    icon: jenkinsIcon,
    category: '自动化',
    mcpSource: 'community',
  },
  {
    type: 'airflow',
    label: 'Airflow',
    description: '工作流编排与任务调度平台',
    icon: airflowIcon,
    category: '自动化',
    mcpSource: 'community',
  },

  // 远程管理
  {
    type: 'ssh',
    label: 'SSH',
    description: '安全远程登录与命令执行',
    icon: sshIcon,
    category: '远程管理',
    mcpSource: 'community',
  },
]

export const connectionTypeMap = new Map(
  connectionTypeMetadata.map((m) => [m.type, m]),
)

export function getConnectionMeta(type: ConnectionType) {
  return connectionTypeMap.get(type) ?? connectionTypeMetadata[0]
}
