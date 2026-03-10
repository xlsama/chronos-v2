import { Link } from '@tanstack/react-router'
import type { Connection } from '@chronos/shared'
import { Pencil, TestTube } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getConnectionMeta } from '@/lib/constants/connection-types'

const statusConfig = {
  connected: { label: '已连接', className: 'bg-green-500' },
  disconnected: { label: '未连接', className: 'bg-gray-400' },
  error: { label: '错误', className: 'bg-red-500' },
}

interface ServiceCardProps {
  connection: Connection
  onTest: (id: string) => void
  isTesting?: boolean
}

export function ServiceCard({ connection, onTest, isTesting }: ServiceCardProps) {
  const meta = getConnectionMeta(connection.type)
  const status = statusConfig[connection.status]
  const Icon = meta.icon

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn('rounded-lg bg-muted p-2.5', meta.color)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{connection.name}</span>
            <div className={cn('size-2 rounded-full', status.className)} title={status.label} />
          </div>
          <div className="mt-1">
            <Badge variant="secondary" className="text-xs">
              {meta.label}
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
            asChild
          >
            <Link to="/connections/$id/edit" params={{ id: connection.id }}>
              <Pencil className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
