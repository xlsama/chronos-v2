import { z } from 'zod/v4'

export const connectionFormSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  type: z.enum([
    'mysql', 'postgresql', 'redis', 'mongodb', 'clickhouse',
    'elasticsearch', 'kafka', 'rabbitmq',
    'kubernetes', 'docker', 'argocd',
    'grafana', 'prometheus', 'sentry', 'jenkins',
  ]),
  config: z.record(z.string(), z.string()),
})

export type ConnectionFormValues = z.infer<typeof connectionFormSchema>

export const connectionConfigFields: Record<string, { key: string; label: string; type: 'text' | 'password' | 'number' | 'textarea'; placeholder?: string }[]> = {
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
    { key: 'url', label: 'URL', type: 'text', placeholder: 'http://localhost:9200' },
    { key: 'apiKey', label: 'API Key', type: 'password' },
    { key: 'username', label: '用户名', type: 'text' },
    { key: 'password', label: '密码', type: 'password' },
  ],
  kafka: [
    { key: 'brokers', label: 'Brokers', type: 'text', placeholder: 'localhost:9092' },
    { key: 'username', label: '用户名', type: 'text' },
    { key: 'password', label: '密码', type: 'password' },
    { key: 'mechanism', label: 'SASL 机制', type: 'text', placeholder: 'PLAIN' },
  ],
  rabbitmq: [
    { key: 'host', label: '主机', type: 'text', placeholder: 'localhost' },
    { key: 'port', label: '端口', type: 'number', placeholder: '5672' },
    { key: 'vhost', label: 'Virtual Host', type: 'text', placeholder: '/' },
    { key: 'username', label: '用户名', type: 'text', placeholder: 'guest' },
    { key: 'password', label: '密码', type: 'password' },
  ],
  kubernetes: [
    { key: 'kubeconfig', label: 'Kubeconfig', type: 'textarea' },
  ],
  docker: [
    { key: 'socketPath', label: 'Socket 路径', type: 'text', placeholder: '/var/run/docker.sock' },
  ],
  argocd: [
    { key: 'url', label: 'URL', type: 'text', placeholder: 'https://argocd.example.com' },
    { key: 'authToken', label: 'Auth Token', type: 'password' },
  ],
  grafana: [
    { key: 'url', label: 'URL', type: 'text', placeholder: 'http://localhost:3000' },
    { key: 'apiKey', label: 'Service Account Token', type: 'password' },
  ],
  prometheus: [
    { key: 'url', label: 'URL', type: 'text', placeholder: 'http://localhost:9090' },
  ],
  sentry: [
    { key: 'authToken', label: 'Access Token', type: 'password' },
  ],
  jenkins: [
    { key: 'url', label: 'URL', type: 'text', placeholder: 'http://localhost:8080' },
    { key: 'username', label: '用户名', type: 'text' },
    { key: 'apiToken', label: 'API Token', type: 'password' },
  ],
}
