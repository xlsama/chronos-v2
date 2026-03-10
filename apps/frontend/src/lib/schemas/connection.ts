import { z } from 'zod/v4'

export const connectionFormSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  type: z.enum(['mysql', 'postgresql', 'redis', 'grafana', 'elasticsearch', 'kubernetes', 'prometheus']),
  config: z.record(z.string(), z.string()),
})

export type ConnectionFormValues = z.infer<typeof connectionFormSchema>

export const connectionConfigFields: Record<string, { key: string; label: string; type: 'text' | 'password' | 'number' | 'textarea' }[]> = {
  mysql: [
    { key: 'host', label: '主机', type: 'text' },
    { key: 'port', label: '端口', type: 'number' },
    { key: 'database', label: '数据库', type: 'text' },
    { key: 'username', label: '用户名', type: 'text' },
    { key: 'password', label: '密码', type: 'password' },
  ],
  postgresql: [
    { key: 'host', label: '主机', type: 'text' },
    { key: 'port', label: '端口', type: 'number' },
    { key: 'database', label: '数据库', type: 'text' },
    { key: 'username', label: '用户名', type: 'text' },
    { key: 'password', label: '密码', type: 'password' },
  ],
  redis: [
    { key: 'host', label: '主机', type: 'text' },
    { key: 'port', label: '端口', type: 'number' },
    { key: 'password', label: '密码', type: 'password' },
    { key: 'db', label: '数据库编号', type: 'number' },
  ],
  grafana: [
    { key: 'url', label: 'URL', type: 'text' },
    { key: 'apiKey', label: 'API Key', type: 'password' },
  ],
  elasticsearch: [
    { key: 'url', label: 'URL', type: 'text' },
    { key: 'username', label: '用户名', type: 'text' },
    { key: 'password', label: '密码', type: 'password' },
  ],
  kubernetes: [
    { key: 'kubeconfig', label: 'Kubeconfig', type: 'textarea' },
  ],
  prometheus: [
    { key: 'url', label: 'URL', type: 'text' },
  ],
}
