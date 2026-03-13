import type { ConnectionType } from '@chronos/shared'
import { z } from 'zod/v4'

export type ConnectionConfigField = {
  key: string
  label: string
  type: 'text' | 'password' | 'number' | 'textarea'
  placeholder?: string
}

export type ConnectionFormValues = {
  name: string
} & Record<string, string>

export const connectionConfigFields: Record<ConnectionType, ConnectionConfigField[]> = {
  mysql: [
    { key: 'host', label: '主机', type: 'text', placeholder: 'localhost' },
    { key: 'port', label: '端口', type: 'number', placeholder: '3306' },
    { key: 'database', label: '数据库', type: 'text' },
    { key: 'username', label: '用户名', type: 'text' },
    { key: 'password', label: '密码', type: 'password' },
  ],
  postgresql: [
    { key: 'host', label: '主机', type: 'text', placeholder: 'localhost' },
    { key: 'port', label: '端口', type: 'number', placeholder: '5432' },
    { key: 'database', label: '数据库', type: 'text' },
    { key: 'username', label: '用户名', type: 'text' },
    { key: 'password', label: '密码', type: 'password' },
  ],
  redis: [
    { key: 'host', label: '主机', type: 'text', placeholder: 'localhost' },
    { key: 'port', label: '端口', type: 'number', placeholder: '6379' },
    { key: 'password', label: '密码', type: 'password' },
    { key: 'db', label: '数据库编号', type: 'number', placeholder: '0' },
  ],
  mongodb: [
    { key: 'host', label: '主机', type: 'text', placeholder: 'localhost' },
    { key: 'port', label: '端口', type: 'number', placeholder: '27017' },
    { key: 'database', label: '数据库', type: 'text' },
    { key: 'username', label: '用户名', type: 'text' },
    { key: 'password', label: '密码', type: 'password' },
  ],
  clickhouse: [
    { key: 'host', label: '主机', type: 'text', placeholder: 'localhost' },
    { key: 'port', label: '端口', type: 'number', placeholder: '8123' },
    { key: 'database', label: '数据库', type: 'text' },
    { key: 'username', label: '用户名', type: 'text', placeholder: 'default' },
    { key: 'password', label: '密码', type: 'password' },
  ],
  elasticsearch: [
    { key: 'url', label: '地址', type: 'text', placeholder: 'http://localhost:9200' },
    { key: 'apiKey', label: 'API 密钥', type: 'password' },
    { key: 'username', label: '用户名', type: 'text' },
    { key: 'password', label: '密码', type: 'password' },
  ],
  kafka: [
    { key: 'brokers', label: 'Broker 列表', type: 'text', placeholder: 'localhost:9092' },
    { key: 'username', label: '用户名', type: 'text' },
    { key: 'password', label: '密码', type: 'password' },
    { key: 'mechanism', label: 'SASL 机制', type: 'text', placeholder: 'PLAIN' },
  ],
  rabbitmq: [
    { key: 'host', label: '主机', type: 'text', placeholder: 'localhost' },
    { key: 'port', label: '端口', type: 'number', placeholder: '5672' },
    { key: 'vhost', label: '虚拟主机', type: 'text', placeholder: '/' },
    { key: 'username', label: '用户名', type: 'text', placeholder: 'guest' },
    { key: 'password', label: '密码', type: 'password' },
  ],
  kubernetes: [
    { key: 'kubeconfig', label: '集群配置', type: 'textarea' },
  ],
  docker: [
    { key: 'socketPath', label: '套接字路径', type: 'text', placeholder: '/var/run/docker.sock' },
  ],
  argocd: [
    { key: 'url', label: '地址', type: 'text', placeholder: 'https://argocd.example.com' },
    { key: 'authToken', label: '认证令牌', type: 'password' },
  ],
  grafana: [
    { key: 'url', label: '地址', type: 'text', placeholder: 'http://localhost:3000' },
    { key: 'apiKey', label: '服务账号令牌', type: 'password' },
  ],
  prometheus: [
    { key: 'url', label: '地址', type: 'text', placeholder: 'http://localhost:9090' },
  ],
  sentry: [
    { key: 'authToken', label: '访问令牌', type: 'password' },
  ],
  jenkins: [
    { key: 'url', label: '地址', type: 'text', placeholder: 'http://localhost:8080' },
    { key: 'username', label: '用户名', type: 'text' },
    { key: 'apiToken', label: 'API 令牌', type: 'password' },
  ],
  datadog: [
    { key: 'apiKey', label: 'API 密钥', type: 'password' },
    { key: 'appKey', label: '应用密钥', type: 'password' },
    { key: 'site', label: '站点域名', type: 'text', placeholder: 'datadoghq.com' },
  ],
  pagerduty: [
    { key: 'apiKey', label: 'API 密钥', type: 'password' },
  ],
  opsgenie: [
    { key: 'apiKey', label: 'API 密钥', type: 'password' },
    { key: 'apiUrl', label: 'API 地址', type: 'text', placeholder: 'https://api.opsgenie.com' },
  ],
  apisix: [
    { key: 'host', label: '主机', type: 'text', placeholder: 'localhost' },
    { key: 'port', label: '端口', type: 'number', placeholder: '9080' },
    { key: 'adminApiPort', label: '管理 API 端口', type: 'number', placeholder: '9180' },
    { key: 'adminKey', label: '管理密钥', type: 'password' },
  ],
  kong: [
    { key: 'accessToken', label: '访问令牌', type: 'password' },
    { key: 'region', label: '区域', type: 'text', placeholder: 'us' },
    { key: 'binaryPath', label: 'MCP 二进制路径', type: 'text', placeholder: 'mcp-konnect' },
  ],
  airflow: [
    { key: 'url', label: '地址', type: 'text', placeholder: 'http://localhost:8080' },
    { key: 'username', label: '用户名', type: 'text' },
    { key: 'password', label: '密码', type: 'password' },
  ],
  loki: [
    { key: 'url', label: 'Grafana 地址', type: 'text', placeholder: 'http://localhost:3000' },
    { key: 'apiKey', label: 'Grafana API 密钥', type: 'password' },
  ],
  ssh: [
    { key: 'host', label: '主机', type: 'text', placeholder: '192.168.1.100' },
    { key: 'port', label: '端口', type: 'number', placeholder: '22' },
    { key: 'username', label: '用户名', type: 'text' },
    { key: 'password', label: '密码', type: 'password' },
    { key: 'privateKey', label: '私钥', type: 'textarea' },
  ],
}

export function createConnectionFormDefaultValues(type: ConnectionType): ConnectionFormValues {
  return {
    name: '',
    ...Object.fromEntries(
      (connectionConfigFields[type] ?? []).map((field) => [field.key, '']),
    ),
  }
}

export function createConnectionFormSchema(type: ConnectionType) {
  return z.object({
    name: z.string(),
    ...Object.fromEntries(
      (connectionConfigFields[type] ?? []).map((field) => [
        field.key,
        field.type === 'number'
          ? z
            .string()
            .trim()
            .refine((value) => value.length === 0 || /^-?\d+$/.test(value), '请输入有效数字')
          : z.string(),
      ]),
    ),
  })
}

export function parseConnectionConfig(
  config: Record<string, unknown>,
  type: ConnectionType,
): ConnectionFormValues {
  const fields = connectionConfigFields[type] ?? []
  return {
    name: '',
    ...Object.fromEntries(
      fields.map((field) => [field.key, String(config[field.key] ?? '')]),
    ),
  }
}

export function buildConnectionConfig(values: ConnectionFormValues, type: ConnectionType) {
  return Object.fromEntries(
    (connectionConfigFields[type] ?? [])
      .map((field) => [field.key, values[field.key]?.trim() ?? ''] as const)
      .filter(([, value]) => Boolean(value)),
  )
}
