import type { ConnectionType } from '@chronos/shared'

export const SERVICE_CATEGORIES = {
  Database: ['mysql', 'postgresql', 'mongodb', 'clickhouse'],
  'Cache & Queue': ['redis', 'kafka', 'rabbitmq'],
  Container: ['kubernetes', 'docker', 'argocd'],
  Monitoring: ['grafana', 'prometheus', 'sentry', 'datadog', 'loki', 'elasticsearch'],
  Alerting: ['pagerduty', 'opsgenie'],
  'CI/CD': ['jenkins', 'airflow'],
  'API Gateway': ['apisix', 'kong'],
  Infrastructure: ['ssh'],
} as const satisfies Record<string, readonly ConnectionType[]>

export type ServiceCategory = keyof typeof SERVICE_CATEGORIES

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  Database: '数据库',
  'Cache & Queue': '缓存与队列',
  Container: '容器与编排',
  Monitoring: '监控与可观测',
  Alerting: '告警平台',
  'CI/CD': 'CI/CD',
  'API Gateway': 'API 网关',
  Infrastructure: '基础设施',
}

export const SERVICE_TYPE_META: Record<ConnectionType, { label: string; category: ServiceCategory }> = {
  mysql: { label: 'MySQL', category: 'Database' },
  postgresql: { label: 'PostgreSQL', category: 'Database' },
  mongodb: { label: 'MongoDB', category: 'Database' },
  clickhouse: { label: 'ClickHouse', category: 'Database' },
  redis: { label: 'Redis', category: 'Cache & Queue' },
  kafka: { label: 'Kafka', category: 'Cache & Queue' },
  rabbitmq: { label: 'RabbitMQ', category: 'Cache & Queue' },
  kubernetes: { label: 'Kubernetes', category: 'Container' },
  docker: { label: 'Docker', category: 'Container' },
  argocd: { label: 'Argo CD', category: 'Container' },
  grafana: { label: 'Grafana', category: 'Monitoring' },
  prometheus: { label: 'Prometheus', category: 'Monitoring' },
  sentry: { label: 'Sentry', category: 'Monitoring' },
  datadog: { label: 'Datadog', category: 'Monitoring' },
  loki: { label: 'Loki', category: 'Monitoring' },
  elasticsearch: { label: 'Elasticsearch', category: 'Monitoring' },
  pagerduty: { label: 'PagerDuty', category: 'Alerting' },
  opsgenie: { label: 'OpsGenie', category: 'Alerting' },
  jenkins: { label: 'Jenkins', category: 'CI/CD' },
  airflow: { label: 'Airflow', category: 'CI/CD' },
  apisix: { label: 'APISIX', category: 'API Gateway' },
  kong: { label: 'Kong', category: 'API Gateway' },
  ssh: { label: 'SSH', category: 'Infrastructure' },
}

const iconModules = import.meta.glob<string>('../../assets/icons/services/*.svg', {
  eager: true,
  import: 'default',
})

export function getServiceIconUrl(type: string): string {
  const key = Object.keys(iconModules).find((k) => k.endsWith(`/${type}.svg`))
  return key ? iconModules[key] : ''
}
