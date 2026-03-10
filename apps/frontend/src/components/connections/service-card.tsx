import type { Connection, ConnectionType } from '@chronos/shared'
import {
  Activity,
  BarChart3,
  Container,
  Database,
  Pencil,
  Search,
  TestTube,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const serviceTypeConfig: Record<
  ConnectionType,
  { label: string; icon: typeof Database; color: string }
> = {
  mysql: { label: 'MySQL', icon: Database, color: 'text-blue-500' },
  postgresql: { label: 'PostgreSQL', icon: Database, color: 'text-sky-600' },
  redis: { label: 'Redis', icon: Database, color: 'text-red-500' },
  grafana: { label: 'Grafana', icon: BarChart3, color: 'text-orange-500' },
  elasticsearch: { label: 'Elasticsearch', icon: Search, color: 'text-yellow-500' },
  kubernetes: { label: 'Kubernetes', icon: Container, color: 'text-blue-600' },
  prometheus: { label: 'Prometheus', icon: Activity, color: 'text-orange-600' },
}

const statusConfig = {
  connected: { label: '已连接', className: 'bg-green-500' },
  disconnected: { label: '未连接', className: 'bg-gray-400' },
  error: { label: '错误', className: 'bg-red-500' },
}

interface ServiceCardProps {
  connection: Connection
  onEdit: (connection: Connection) => void
  onTest: (id: string) => void
  isTesting?: boolean
}

export function ServiceCard({ connection, onEdit, onTest, isTesting }: ServiceCardProps) {
  const typeConfig = serviceTypeConfig[connection.type]
  const status = statusConfig[connection.status]
  const Icon = typeConfig.icon

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn('rounded-lg bg-muted p-2.5', typeConfig.color)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{connection.name}</span>
            <div className={cn('size-2 rounded-full', status.className)} title={status.label} />
          </div>
          <div className="mt-1">
            <Badge variant="secondary" className="text-xs">
              {typeConfig.label}
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onTest(connection.id)}
            disabled={isTesting}
          >
            <TestTube className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onEdit(connection)}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export { serviceTypeConfig }
